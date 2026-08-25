import { BinanceClient } from "./client";
import { SymbolRules } from "../types";
export declare class FuturesService {
    private readonly client;
    constructor(client: BinanceClient);
    getAccount(): Promise<any>;
    getBalance(): Promise<{
        walletBalance: number;
        availableBalance: number;
        marginBalance: number;
    }>;
    getExchangeInfo(): Promise<any>;
    getPrice(symbol: string): Promise<number>;
    getTicker(symbol: string): Promise<any>;
    setLeverage(symbol: string, leverage: number): Promise<any>;
    setCrossMargin(symbol: string): Promise<any>;
    getPositionRisk(): Promise<any>;
    assertOneWayPositionMode(): Promise<void>;
    getOpenPosition(symbol: string): Promise<any | null>;
    getOpenPositions(): Promise<any[]>;
    getOpenPositionSide(symbol: string): Promise<"LONG" | "SHORT" | null>;
    getOpenOrders(symbol?: string): Promise<any>;
    getUserTrades(symbol: string): Promise<any>;
    getOrder(symbol: string, orderId: string | number): Promise<any>;
    getOrderAveragePrice(symbol: string, orderId: string | number): Promise<number>;
    parseSymbolRules(exchangeInfo: any): Map<string, SymbolRules>;
    normalizeQuantity(quantity: number, stepSize: number): number;
    formatQuantity(quantity: number, stepSize: number): string;
    private getDecimalPrecision;
    getValidQuantity(symbol: string, quantity: number): Promise<number>;
    getValidQuantityString(symbol: string, quantity: number): Promise<string>;
    private getSymbolRules;
    validateOrderNotional(symbol: string, quantity: number, price: number): Promise<void>;
}
//# sourceMappingURL=futures.d.ts.map