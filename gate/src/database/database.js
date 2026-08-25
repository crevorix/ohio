"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotDatabase = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// ============================================================
// DATABASE
// ============================================================
class BotDatabase {
    db;
    // ==========================================================
    // CONSTRUCTOR
    // ==========================================================
    constructor(path = "data/bot.db") {
        this.db =
            new better_sqlite3_1.default(path);
        this.initialize();
    }
    // ==========================================================
    // INITIALIZE DATABASE
    // ==========================================================
    initialize() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS positions (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        symbol TEXT NOT NULL,

        side TEXT NOT NULL,

        margin REAL NOT NULL,

        notional REAL NOT NULL,

        quantity REAL NOT NULL,

        entry_price REAL NOT NULL,

        take_profit_price REAL NOT NULL,

        buy_order_id TEXT,

        status TEXT NOT NULL,

        created_at TEXT NOT NULL,

        closed_at TEXT

      );

      CREATE TABLE IF NOT EXISTS trades (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        symbol TEXT NOT NULL,

        entry_price REAL NOT NULL,

        exit_price REAL NOT NULL,

        quantity REAL NOT NULL,

        margin REAL NOT NULL,

        pnl REAL NOT NULL,

        fees REAL NOT NULL,

        entry_time TEXT NOT NULL,

        exit_time TEXT NOT NULL

      );

      CREATE INDEX IF NOT EXISTS idx_positions_symbol_status
      ON positions(symbol, status);

      CREATE INDEX IF NOT EXISTS idx_trades_symbol
      ON trades(symbol);
    `);
        // --------------------------------------------------------
        // DATABASE MIGRATION
        // --------------------------------------------------------
        this.migratePositionsTable();
    }
    // ==========================================================
    // MIGRATE OLD POSITIONS TABLE
    // ==========================================================
    migratePositionsTable() {
        const columns = this.db
            .prepare(`PRAGMA table_info(positions)`)
            .all();
        const symbolColumn = columns.find((column) => column.name === "symbol");
        // --------------------------------------------------------
        // If symbol is already non-unique, nothing is required.
        // --------------------------------------------------------
        if (!symbolColumn) {
            return;
        }
        // --------------------------------------------------------
        // SQLite does not directly expose the UNIQUE property
        // through this simple check, so inspect indexes.
        // --------------------------------------------------------
        const indexes = this.db
            .prepare(`PRAGMA index_list(positions)`)
            .all();
        const uniqueSymbolIndex = indexes.find((index) => index.unique === 1 &&
            index.name !== "sqlite_autoindex_positions_1");
        // --------------------------------------------------------
        // If the original table has the automatic UNIQUE index,
        // rebuild the table without UNIQUE(symbol).
        // --------------------------------------------------------
        if (indexes.some((index) => index.unique === 1)) {
            try {
                this.db.exec(`
          BEGIN TRANSACTION;

          CREATE TABLE IF NOT EXISTS positions_new (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            symbol TEXT NOT NULL,

            side TEXT NOT NULL,

            margin REAL NOT NULL,

            notional REAL NOT NULL,

            quantity REAL NOT NULL,

            entry_price REAL NOT NULL,

            take_profit_price REAL NOT NULL,

            buy_order_id TEXT,

            status TEXT NOT NULL,

            created_at TEXT NOT NULL,

            closed_at TEXT

          );

          INSERT INTO positions_new (
            id,
            symbol,
            side,
            margin,
            notional,
            quantity,
            entry_price,
            take_profit_price,
            buy_order_id,
            status,
            created_at,
            closed_at
          )

          SELECT
            id,
            symbol,
            side,
            margin,
            notional,
            quantity,
            entry_price,
            take_profit_price,
            buy_order_id,
            status,
            created_at,
            closed_at

          FROM positions;

          DROP TABLE positions;

          ALTER TABLE positions_new
          RENAME TO positions;

          CREATE INDEX IF NOT EXISTS idx_positions_symbol_status
          ON positions(symbol, status);

          COMMIT;
        `);
            }
            catch (err) {
                try {
                    this.db.exec("ROLLBACK");
                }
                catch {
                    // Ignore rollback errors.
                }
                console.error("[DATABASE] Migration failed:", err);
            }
        }
    }
    // ==========================================================
    // GET OPEN POSITION
    // ==========================================================
    getOpenPosition(symbol) {
        const row = this.db
            .prepare(`
          SELECT
            id,

            symbol,

            side,

            margin,

            notional,

            quantity,

            entry_price AS entryPrice,

            take_profit_price AS takeProfitPrice,

            buy_order_id AS buyOrderId,

            status,

            created_at AS createdAt,

            closed_at AS closedAt

          FROM positions

          WHERE symbol = ?

          AND status = 'OPEN'

          ORDER BY id DESC

          LIMIT 1
        `)
            .get(symbol);
        return row;
    }
    // ==========================================================
    // GET ALL OPEN POSITIONS
    // ==========================================================
    getOpenPositions() {
        return this.db
            .prepare(`
        SELECT
          id,

          symbol,

          side,

          margin,

          notional,

          quantity,

          entry_price AS entryPrice,

          take_profit_price AS takeProfitPrice,

          buy_order_id AS buyOrderId,

          status,

          created_at AS createdAt,

          closed_at AS closedAt

        FROM positions

        WHERE status = 'OPEN'

        ORDER BY id ASC
      `)
            .all();
    }
    // ==========================================================
    // CREATE POSITION
    // ==========================================================
    createPosition(position) {
        // --------------------------------------------------------
        // Prevent duplicate OPEN position.
        // --------------------------------------------------------
        const existing = this.getOpenPosition(position.symbol);
        if (existing) {
            throw new Error(`Open position already exists for ${position.symbol}`);
        }
        const statement = this.db.prepare(`
        INSERT INTO positions (

          symbol,

          side,

          margin,

          notional,

          quantity,

          entry_price,

          take_profit_price,

          buy_order_id,

          status,

          created_at

        )

        VALUES (

          @symbol,

          @side,

          @margin,

          @notional,

          @quantity,

          @entryPrice,

          @takeProfitPrice,

          @buyOrderId,

          'OPEN',

          @createdAt

        )
      `);
        return statement.run({
            symbol: position.symbol,
            side: position.side,
            margin: position.margin,
            notional: position.notional,
            quantity: position.quantity,
            entryPrice: position.entryPrice,
            takeProfitPrice: position.takeProfitPrice,
            buyOrderId: position.buyOrderId,
            createdAt: position.createdAt,
        });
    }
    // ==========================================================
    // CLOSE POSITION
    // ==========================================================
    closePosition(symbol, exitPrice, pnl, fees = 0) {
        const position = this.getOpenPosition(symbol);
        if (!position) {
            throw new Error(`No open position for ${symbol}`);
        }
        const now = new Date().toISOString();
        const transaction = this.db.transaction(() => {
            // ----------------------------------------------------
            // CLOSE POSITION
            // ----------------------------------------------------
            const result = this.db
                .prepare(`
              UPDATE positions

              SET
                status = 'CLOSED',

                closed_at = ?

              WHERE symbol = ?

              AND status = 'OPEN'
            `)
                .run(now, symbol);
            if (result.changes !== 1) {
                throw new Error(`Failed to close ${symbol}`);
            }
            // ----------------------------------------------------
            // SAVE TRADE HISTORY
            // ----------------------------------------------------
            this.db
                .prepare(`
            INSERT INTO trades (

              symbol,

              entry_price,

              exit_price,

              quantity,

              margin,

              pnl,

              fees,

              entry_time,

              exit_time

            )

            VALUES (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?
            )
          `)
                .run(symbol, position.entryPrice, exitPrice, position.quantity, position.margin, pnl, fees, position.createdAt, now);
        });
        transaction();
    }
    // ==========================================================
    // CLOSE DATABASE
    // ==========================================================
    close() {
        this.db.close();
    }
}
exports.BotDatabase = BotDatabase;
//# sourceMappingURL=database.js.map