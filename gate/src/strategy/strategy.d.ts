import "dotenv/config";
import { PositionManager } from "../trading/positionManager";
import { OrderManager } from "../trading/orderManager";
import { FuturesService } from "../binance/futures";
export declare class Strategy {
    private readonly futures;
    private readonly positions;
    private readonly orders;
    private readonly references;
    private readonly buying;
    private readonly closing;
    private readonly processing;
    private readonly awaitingSignalReset;
    constructor(futures: FuturesService, positions: PositionManager, orders: OrderManager);
    setReference(symbol: string, price: number): void;
    getReference(symbol: string): number | undefined;
    onPrice(symbol: string, price: number): Promise<void>;
    private openPosition;
    private calculateTakeProfit;
    private closePosition;
}
//# sourceMappingURL=strategy.d.ts.map