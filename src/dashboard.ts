import express from "express";
import path from "path";
import Database from "better-sqlite3";

const app = express();
const PORT = Number(process.env.DASHBOARD_PORT || 3000);

const db = new Database(
  path.join(process.cwd(), "data", "bot.db"),
  { readonly: true }
);

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/stats", (_req, res) => {
  const totalPositions = db
    .prepare("SELECT COUNT(*) AS count FROM positions")
    .get() as { count: number };

  const openPositions = db
    .prepare("SELECT COUNT(*) AS count FROM positions WHERE status = 'OPEN'")
    .get() as { count: number };

  const closedPositions = db
    .prepare("SELECT COUNT(*) AS count FROM positions WHERE status = 'CLOSED'")
    .get() as { count: number };

  const tradeStats = db.prepare(`
    SELECT
      COUNT(*) AS trades,
      COALESCE(SUM(pnl), 0) AS pnl,
      COALESCE(SUM(fees), 0) AS fees,
      COALESCE(SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END), 0) AS wins,
      COALESCE(SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END), 0) AS losses
    FROM trades
  `).get() as {
    trades: number;
    pnl: number;
    fees: number;
    wins: number;
    losses: number;
  };

  const netPnl = tradeStats.pnl - tradeStats.fees;

  const winRate =
    tradeStats.trades > 0
      ? (tradeStats.wins / tradeStats.trades) * 100
      : 0;

  res.json({
    positions: {
      total: totalPositions.count,
      open: openPositions.count,
      closed: closedPositions.count,
    },
    trades: {
      total: tradeStats.trades,
      wins: tradeStats.wins,
      losses: tradeStats.losses,
      winRate,
      pnl: tradeStats.pnl,
      fees: tradeStats.fees,
      netPnl,
    },
  });
});

app.get("/api/positions/open", (_req, res) => {
  const positions = db.prepare(`
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
      created_at
    FROM positions
    WHERE status = 'OPEN'
    ORDER BY created_at DESC
  `).all();

  res.json(positions);
});

app.get("/api/positions/closed", (_req, res) => {
  const positions = db.prepare(`
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
    FROM positions
    WHERE status = 'CLOSED'
    ORDER BY closed_at DESC
  `).all();

  res.json(positions);
});

app.get("/api/trades", (_req, res) => {
  const trades = db.prepare(`
    SELECT
      id,
      symbol,
      entry_price,
      exit_price,
      quantity,
      margin,
      pnl,
      fees,
      entry_time,
      exit_time
    FROM trades
    ORDER BY exit_time DESC
  `).all();

  res.json(trades);
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    time: new Date().toISOString(),
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dashboard running on port ${PORT}`);
});