import axios from "axios";
import fs from "fs";
import path from "path";
import { CONFIG } from "./config";

const STABLECOINS = new Set([
  "USDT",
  "USDC",
  "BUSD",
  "FDUSD",
  "TUSD",
  "USDP",
  "DAI",
  "USDE",
  "USD1",
  "FRAX",
  "LUSD",
  "PYUSD",
  "GUSD",
  "EUR",
]);

interface MarketCapCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
}

interface BinanceSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  status: string;
}

export interface TopToken {
  rank: number;
  marketCapRank: number;
  coinId: string;
  name: string;
  baseAsset: string;
  symbol: string;
  price: number;
  marketCap: number;
}

async function getMarketCapCoins(): Promise<MarketCapCoin[]> {
  const response = await axios.get(
    "https://api.coingecko.com/api/v3/coins/markets",
    {
      params: {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: CONFIG.marketCapFetchCount,
        page: 1,
        sparkline: false,
      },
      timeout: 15000,
    }
  );

  return response.data;
}

async function getBinanceFuturesSymbols(): Promise<BinanceSymbol[]> {
  const response = await axios.get(
    `${CONFIG.binanceBaseUrl}/fapi/v1/exchangeInfo`,
    {
      timeout: 15000,
    }
  );

  return response.data.symbols;
}

export async function getTop100(): Promise<TopToken[]> {
  console.log("Fetching market-cap ranking...");
  console.log("Fetching Binance Futures symbols...");

  const [marketCapCoins, binanceSymbols] = await Promise.all([
    getMarketCapCoins(),
    getBinanceFuturesSymbols(),
  ]);

  // Build Binance lookup.
  const binanceMap = new Map<string, BinanceSymbol>();

  for (const symbol of binanceSymbols) {
    if (
      symbol.status === "TRADING" &&
      symbol.contractType === "PERPETUAL" &&
      symbol.quoteAsset === "USDT"
    ) {
      binanceMap.set(symbol.baseAsset.toUpperCase(), symbol);
    }
  }

  const results: TopToken[] = [];

  for (const coin of marketCapCoins) {
    const baseAsset = coin.symbol.toUpperCase();

    // Exclude stablecoins.
    if (STABLECOINS.has(baseAsset)) {
      continue;
    }

    // Find matching Binance Futures contract.
    const binanceSymbol = binanceMap.get(baseAsset);

    if (!binanceSymbol) {
      continue;
    }

    results.push({
      rank: results.length + 1,
      marketCapRank: coin.market_cap_rank,
      coinId: coin.id,
      name: coin.name,
      baseAsset,
      symbol: binanceSymbol.symbol,
      price: coin.current_price,
      marketCap: coin.market_cap,
    });

    if (results.length >= CONFIG.top100Count) {
      break;
    }
  }

  return results;
}

export function saveTop100(tokens: TopToken[]) {
  const filePath = path.join(
    process.cwd(),
    "top100",
    "data",
    "top100.json"
  );

  fs.writeFileSync(
    filePath,
    JSON.stringify(tokens, null, 2),
    "utf8"
  );

  console.log(`\nSaved ${tokens.length} tokens.`);
  console.log(`File: ${filePath}`);
}

export function displayTop100(tokens: TopToken[]) {
  console.log("\n==============================================================");
  console.log("       TOP 100 CRYPTOCURRENCIES BY MARKET CAP");
  console.log("==============================================================\n");

  for (const token of tokens) {
    console.log(
      `${String(token.rank).padStart(3, " ")}. ` +
        `${token.name.padEnd(20, " ")} ` +
        `${token.symbol.padEnd(15, " ")} ` +
        `MC Rank: ${String(token.marketCapRank).padStart(3, " ")} ` +
        `Market Cap: $${token.marketCap.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}`
    );
  }

  console.log("\n==============================================================");
  console.log(`Total: ${tokens.length}`);
  console.log("Ranking: Market capitalization");
  console.log("Stablecoins: EXCLUDED");
  console.log("Binance Futures: REQUIRED");
  console.log("Contract: USDT PERPETUAL");
  console.log("==============================================================\n");
}