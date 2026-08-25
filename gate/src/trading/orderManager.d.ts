import { BinanceClient } from "../binance/client";
import { SymbolRules } from "../types";
export declare class OrderManager {
    private readonly client;
    private readonly rules;
    constructor(client: BinanceClient, rules: Map<string, SymbolRules>);
    buyMarket(symbol: string, quantity: number, price: number): Promise<any>;
    sellMarket(symbol: string, quantity: number, price: number): Promise<any>;
    closeMarket(symbol: string, positionSide: "LONG" | "SHORT", quantity: number, price: number): Promise<any>;
    private marketOrder;
}
//# sourceMappingURL=orderManager.d.ts.map