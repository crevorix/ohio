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
export declare class HistoricalService {
    private readonly client;
    constructor(client: BinanceClient);
    getDailyCandles(symbol: string, limit?: number): Promise<Candle[]>;
    getReferencePrice(symbol: string): Promise<number>;
}
//# sourceMappingURL=historical.d.ts.map