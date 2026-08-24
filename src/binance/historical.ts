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

if (
  !Number.isFinite(LOOKBACK_DAYS) ||
  LOOKBACK_DAYS <= 0
) {
  throw new Error(
    "LOOKBACK_DAYS is missing or invalid"
  );
}

export class HistoricalService {
  constructor(
    private readonly client: BinanceClient
  ) {}

  async getDailyCandles(
    symbol: string,
    limit = LOOKBACK_DAYS + 2
  ): Promise<Candle[]> {
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

    return data
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
