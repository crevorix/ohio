"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricalService = void 0;
require("dotenv/config");
const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS);
if (!Number.isFinite(LOOKBACK_DAYS) ||
    LOOKBACK_DAYS <= 0) {
    throw new Error("LOOKBACK_DAYS is missing or invalid");
}
class HistoricalService {
    client;
    constructor(client) {
        this.client = client;
    }
    async getDailyCandles(symbol, limit = LOOKBACK_DAYS + 2) {
        const data = await this.client.get("/fapi/v1/klines", {
            symbol,
            interval: "1d",
            limit,
        });
        if (!Array.isArray(data)) {
            throw new Error(`Invalid candle data for ${symbol}`);
        }
        return data
            .map((c) => ({
            openTime: Number(c[0]),
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5]),
            closeTime: Number(c[6]),
        }))
            .filter(candle => Number.isFinite(candle.close) &&
            candle.close > 0);
    }
    async getReferencePrice(symbol) {
        const candles = await this.getDailyCandles(symbol);
        const completed = candles.filter(candle => candle.closeTime <= Date.now());
        const index = completed.length -
            1 -
            LOOKBACK_DAYS;
        if (index < 0) {
            throw new Error(`Not enough historical data for ${symbol}`);
        }
        const candle = completed[index];
        if (!candle) {
            throw new Error(`Not enough historical data for ${symbol}`);
        }
        const price = candle.close;
        if (!Number.isFinite(price) ||
            price <= 0) {
            throw new Error(`Invalid reference price for ${symbol}`);
        }
        return price;
    }
}
exports.HistoricalService = HistoricalService;
//# sourceMappingURL=historical.js.map