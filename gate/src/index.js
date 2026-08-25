"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("./binance/client");
const futures_1 = require("./binance/futures");
const historical_1 = require("./binance/historical");
const websocket_1 = require("./binance/websocket");
const database_1 = require("./database/database");
const positionManager_1 = require("./trading/positionManager");
const orderManager_1 = require("./trading/orderManager");
const strategy_1 = require("./strategy/strategy");
const logger_1 = require("./utils/logger");
// ============================================================
// ENVIRONMENT NUMBER
// ============================================================
function numberEnv(name) {
    const value = Number(process.env[name]);
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid or missing environment variable: ${name}`);
    }
    return value;
}
// ============================================================
// SYMBOLS
// ============================================================
const symbolsFromEnv = process.env.SYMBOLS ?? "";
const configuredSymbols = symbolsFromEnv
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
// ============================================================
// CONFIGURATION
// ============================================================
const dryRun = process.env.DRY_RUN === "true";
const leverage = numberEnv("LEVERAGE");
const marginPercent = numberEnv("MARGIN_PERCENT");
const lookbackDays = numberEnv("LOOKBACK_DAYS");
const longDropPercent = numberEnv("LONG_DROP_PERCENT");
const shortRisePercent = numberEnv("SHORT_RISE_PERCENT");
const takeProfitPercent = numberEnv("TP_PERCENT");
// ============================================================
// VALIDATE SYMBOLS
// ============================================================
if (configuredSymbols.length === 0) {
    throw new Error("No SYMBOLS configured in .env");
}
// ============================================================
// MAIN
// ============================================================
async function main() {
    // ==========================================================
    // START
    // ==========================================================
    (0, logger_1.log)("Starting Ohio");
    // ==========================================================
    // MODE
    // ==========================================================
    (0, logger_1.log)(`Mode: ${dryRun
        ? "DRY RUN"
        : "LIVE"}`);
    // ==========================================================
    // CONFIG
    // ==========================================================
    (0, logger_1.log)(`Leverage: ${leverage}x`);
    (0, logger_1.log)(`Margin: ${marginPercent}%`);
    (0, logger_1.log)(`Lookback: ${lookbackDays} days`);
    (0, logger_1.log)(`LONG trigger: -${longDropPercent}%`);
    (0, logger_1.log)(`SHORT trigger: +${shortRisePercent}%`);
    (0, logger_1.log)(`Take profit: ${takeProfitPercent}%`);
    // ==========================================================
    // BINANCE CLIENT
    // ==========================================================
    const client = new client_1.BinanceClient();
    // ==========================================================
    // FUTURES
    // ==========================================================
    const futures = new futures_1.FuturesService(client);
    if (!dryRun) {
        await futures.assertOneWayPositionMode();
        (0, logger_1.log)("Position mode: One-way");
    }
    // ==========================================================
    // HISTORICAL
    // ==========================================================
    const historical = new historical_1.HistoricalService(client);
    // ==========================================================
    // DATABASE
    // ==========================================================
    const database = new database_1.BotDatabase();
    // ==========================================================
    // POSITION MANAGER
    // ==========================================================
    const positions = new positionManager_1.PositionManager(database);
    // ==========================================================
    // EXCHANGE INFORMATION
    // ==========================================================
    const exchangeInfo = await futures.getExchangeInfo();
    // ==========================================================
    // SYMBOL RULES
    // ==========================================================
    const rules = futures.parseSymbolRules(exchangeInfo);
    // ==========================================================
    // FILTER SYMBOLS
    // ==========================================================
    const symbols = configuredSymbols.filter((symbol) => rules.has(symbol));
    if (symbols.length === 0) {
        throw new Error("No configured symbols are available on Binance Futures");
    }
    // ==========================================================
    // SYMBOLS
    // ==========================================================
    (0, logger_1.log)(`Trading symbols: ${symbols.join(", ")}`);
    // ==========================================================
    // ORDER MANAGER
    // ==========================================================
    const orders = new orderManager_1.OrderManager(client, rules);
    // ==========================================================
    // STRATEGY
    // ==========================================================
    const strategy = new strategy_1.Strategy(futures, positions, orders);
    // ==========================================================
    // BALANCE
    // ==========================================================
    const balance = await futures.getBalance();
    (0, logger_1.log)(`Available balance: ${balance.availableBalance} USDT`);
    // ==========================================================
    // INITIALIZE SYMBOLS
    // ==========================================================
    for (const symbol of symbols) {
        try {
            // ======================================================
            // REFERENCE PRICE
            // ======================================================
            const reference = await historical.getReferencePrice(symbol);
            strategy.setReference(symbol, reference);
            // ======================================================
            // CURRENT PRICE
            // ======================================================
            const price = await futures.getPrice(symbol);
            // ======================================================
            // CHANGE
            // ======================================================
            const change = ((price -
                reference) /
                reference) *
                100;
            // ======================================================
            // SIGNAL
            // ======================================================
            let signal = "NO TRADE";
            if (change <=
                -longDropPercent) {
                signal =
                    "LONG";
            }
            else if (change >=
                shortRisePercent) {
                signal =
                    "SHORT";
            }
            // ======================================================
            // LOG
            // ======================================================
            (0, logger_1.log)(`${symbol} | ` +
                `Price=${price} | ` +
                `${lookbackDays}D=${reference} | ` +
                `Change=${change.toFixed(2)}% | ` +
                `Signal=${signal}`);
            // ======================================================
            // INITIAL SIGNAL
            // ======================================================
            if (signal === "LONG" ||
                signal === "SHORT") {
                (0, logger_1.log)(`[INITIAL SIGNAL] ${symbol} ${signal} detected`);
                await strategy.onPrice(symbol, price);
            }
        }
        catch (err) {
            (0, logger_1.error)(`${symbol} initialization failed: ${err?.message ??
                err}`);
        }
    }
    // ==========================================================
    // WEBSOCKET
    // ==========================================================
    const websocket = new websocket_1.BinanceWebSocket(symbols, async (symbol, price) => {
        try {
            await strategy.onPrice(symbol, price);
        }
        catch (err) {
            (0, logger_1.error)(`[WS STRATEGY ERROR] ${symbol}: ${err?.message ??
                err}`);
        }
    });
    // ==========================================================
    // CONNECT
    // ==========================================================
    websocket.connect();
    // ==========================================================
    // SHUTDOWN
    // ==========================================================
    let shuttingDown = false;
    const shutdown = () => {
        if (shuttingDown) {
            return;
        }
        shuttingDown =
            true;
        (0, logger_1.log)("Stopping bot...");
        // ------------------------------------------------------
        // CLOSE WEBSOCKET
        // ------------------------------------------------------
        websocket.close();
        // ------------------------------------------------------
        // CLOSE DATABASE
        // ------------------------------------------------------
        try {
            database.close();
        }
        catch {
            // Ignore database close errors.
        }
        // ------------------------------------------------------
        // EXIT
        // ------------------------------------------------------
        process.exit(0);
    };
    // ==========================================================
    // CTRL+C
    // ==========================================================
    process.once("SIGINT", shutdown);
    // ==========================================================
    // SERVER TERMINATION
    // ==========================================================
    process.once("SIGTERM", shutdown);
}
// ============================================================
// START
// ============================================================
main().catch((err) => {
    (0, logger_1.error)(`Fatal: ${err?.message ??
        err}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map