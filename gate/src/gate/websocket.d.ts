import "dotenv/config";
export declare class BinanceWebSocket {
    private ws;
    private reconnectTimer;
    private reconnectAttempts;
    private manuallyClosed;
    private readonly symbols;
    private readonly onPriceCallback;
    constructor(symbols: string[], onPrice: (symbol: string, price: number) => Promise<void>);
    connect(): void;
    private scheduleReconnect;
    close(): void;
}
//# sourceMappingURL=websocket.d.ts.map