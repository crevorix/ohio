import "dotenv/config";

import { BinanceClient } from "./client";

export interface Candle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const LOOKBACK_DAYS = Number(
  process.env.LOOKBACK_DAYS
);

// Cache historical candles for 12 hours
const CACHE_DURATION_MS =
  12 * 60 * 60 * 1000;

if (
  !Number.isFinite(LOOKBACK_DAYS) ||
  LOOKBACK_DAYS <= 0
) {
  throw new Error(
    "LOOKBACK_DAYS is missing or invalid"
  );
}

export class HistoricalService {
  private readonly candleCache = new Map<
    string,
    {
      candles: Candle[];
      timestamp: number;
    }
  >();

  constructor(
    private readonly client: BinanceClient
  ) {}

  async getDailyCandles(
    symbol: string,
    limit = LOOKBACK_DAYS + 2
  ): Promise<Candle[]> {

    // ============================================================
    // CHECK 12-HOUR CACHE
    // ============================================================

    const cached =
      this.candleCache.get(symbol);

    if (
      cached &&
      Date.now() - cached.timestamp <
        CACHE_DURATION_MS
    ) {
      return cached.candles;
    }

    // ============================================================
    // FETCH FROM BINANCE
    // ============================================================

    console.log(
      `[HISTORY] Fetching ${symbol} ${LOOKBACK_DAYS}D candles`
    );

    const data =
      await this.client.get(
        "/fapi/v1/klines",
        {
          symbol,
          interval: "1d",
          limit,
        }
      );

    if (!Array.isArray(data)) {
      throw new Error(
        `Invalid candle data for ${symbol}`
      );
    }

    const candles: Candle[] =
      data
        .map((c: any[]) => ({
          openTime: Number(c[0]),
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4]),
          volume: Number(c[5]),
          closeTime: Number(c[6]),
        }))
        .filter(
          candle =>
            Number.isFinite(candle.close) &&
            candle.close > 0
        );

    // ============================================================
    // SAVE TO 12-HOUR CACHE
    // ============================================================

    this.candleCache.set(symbol, {
      candles,
      timestamp: Date.now(),
    });

    return candles;
  }

  async getReferencePrice(
    symbol: string
  ): Promise<number> {

    const candles =
      await this.getDailyCandles(symbol);

    const completed =
      candles.filter(
        candle =>
          candle.closeTime <= Date.now()
      );

    const index =
      completed.length -
      1 -
      LOOKBACK_DAYS;

    if (index < 0) {
      throw new Error(
        `Not enough historical data for ${symbol}`
      );
    }

    const candle =
      completed[index];

    if (!candle) {
      throw new Error(
        `Not enough historical data for ${symbol}`
      );
    }

    const price =
      candle.close;

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        `Invalid reference price for ${symbol}`
      );
    }

    return price;
  }
}