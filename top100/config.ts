import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

export const CONFIG = {
  binanceBaseUrl:
    process.env.BINANCE_BASE_URL || "https://fapi.binance.com",

  top100Count: Number(process.env.TOP_100_COUNT || 100),

  marketCapFetchCount: 250,
};