"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceWebSocket = void 0;
require("dotenv/config");
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../utils/logger");
class BinanceWebSocket {
    ws;
    reconnectTimer;
    reconnectAttempts = 0;
    manuallyClosed = false;
    symbols;
    onPriceCallback;
    constructor(symbols, onPrice) {
        this.symbols = [
            ...new Set(symbols.map(symbol => symbol
                .trim()
                .toUpperCase())),
        ];
        this.onPriceCallback =
            onPrice;
    }
    // ============================================================
    // CONNECT
    // ============================================================
    connect() {
        this.manuallyClosed =
            false;
        // ----------------------------------------------------------
        // CLOSE OLD SOCKET
        // ----------------------------------------------------------
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                this.ws.close();
            }
            catch {
                // Ignore old socket errors.
            }
            this.ws =
                undefined;
        }
        // ----------------------------------------------------------
        // CLEAR OLD RECONNECT TIMER
        // ----------------------------------------------------------
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer =
                undefined;
        }
        // ----------------------------------------------------------
        // VALIDATE SYMBOLS
        // ----------------------------------------------------------
        if (this.symbols.length === 0) {
            throw new Error("No WebSocket symbols configured");
        }
        // ----------------------------------------------------------
        // CREATE STREAM LIST
        // ----------------------------------------------------------
        const streams = this.symbols
            .map(symbol => `${symbol.toLowerCase()}@markPrice`)
            .join("/");
        // ----------------------------------------------------------
        // BINANCE WEBSOCKET URL
        // ----------------------------------------------------------
        const baseUrl = process.env.BINANCE_WS_URL ||
            "wss://fstream.binance.com";
        const url = `${baseUrl}/stream?streams=${streams}`;
        // ----------------------------------------------------------
        // LOG
        // ----------------------------------------------------------
        (0, logger_1.log)(`[WS] Connecting | ${this.symbols.length} symbols`);
        (0, logger_1.log)(`[WS] Endpoint: ${baseUrl}`);
        // ----------------------------------------------------------
        // CREATE SOCKET
        // ----------------------------------------------------------
        this.ws =
            new ws_1.default(url);
        // ==========================================================
        // OPEN
        // ==========================================================
        this.ws.on("open", () => {
            this.reconnectAttempts =
                0;
            (0, logger_1.log)(`[WS] Connected | ` +
                `Listening to ${this.symbols.length} symbols`);
            (0, logger_1.log)(`[WS] Streams: ${streams}`);
        });
        // ==========================================================
        // MESSAGE
        // ==========================================================
        this.ws.on("message", async (raw) => {
            try {
                const message = JSON.parse(raw.toString());
                const data = message?.data;
                if (!data) {
                    return;
                }
                // ----------------------------------------------------
                // ONLY MARK PRICE EVENTS
                // ----------------------------------------------------
                if (data.e !==
                    "markPriceUpdate") {
                    return;
                }
                // ----------------------------------------------------
                // SYMBOL
                // ----------------------------------------------------
                const symbol = String(data.s ?? "").toUpperCase();
                // ----------------------------------------------------
                // PRICE
                // ----------------------------------------------------
                const price = Number(data.p);
                // ----------------------------------------------------
                // VALIDATE
                // ----------------------------------------------------
                if (!symbol ||
                    !Number.isFinite(price) ||
                    price <= 0) {
                    return;
                }
                // ----------------------------------------------------
                // LOG
                // ----------------------------------------------------
                (0, logger_1.log)(`[WS] ${symbol} price=${price}`);
                // ----------------------------------------------------
                // SEND TO STRATEGY
                // ----------------------------------------------------
                try {
                    await this.onPriceCallback(symbol, price);
                }
                catch (callbackError) {
                    (0, logger_1.error)(`[WS] Strategy error ${symbol}: ` +
                        `${callbackError?.message ??
                            callbackError}`);
                }
            }
            catch (parseError) {
                (0, logger_1.error)(`[WS] Message parse error: ` +
                    `${parseError?.message ??
                        parseError}`);
            }
        });
        // ==========================================================
        // ERROR
        // ==========================================================
        this.ws.on("error", err => {
            (0, logger_1.error)(`[WS] Error: ${err.message}`);
        });
        // ==========================================================
        // CLOSE
        // ==========================================================
        this.ws.on("close", (code, reason) => {
            const reasonText = reason?.toString() ||
                "none";
            (0, logger_1.error)(`[WS] Disconnected | ` +
                `code=${code} | ` +
                `reason=${reasonText}`);
            if (!this.manuallyClosed) {
                this.scheduleReconnect();
            }
        });
        // ==========================================================
        // PING
        // ==========================================================
        this.ws.on("ping", data => {
            try {
                this.ws?.pong(data);
            }
            catch {
                // Socket may already be closed.
            }
        });
    }
    // ============================================================
    // RECONNECT
    // ============================================================
    scheduleReconnect() {
        if (this.manuallyClosed ||
            this.reconnectTimer) {
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(2000 *
            Math.pow(2, this.reconnectAttempts - 1), 30000);
        (0, logger_1.log)(`[WS] Reconnecting in ` +
            `${delay / 1000}s | ` +
            `attempt=${this.reconnectAttempts}`);
        this.reconnectTimer =
            setTimeout(() => {
                this.reconnectTimer =
                    undefined;
                if (!this.manuallyClosed) {
                    this.connect();
                }
            }, delay);
    }
    // ============================================================
    // CLOSE
    // ============================================================
    close() {
        this.manuallyClosed =
            true;
        // ----------------------------------------------------------
        // CANCEL RECONNECT
        // ----------------------------------------------------------
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer =
                undefined;
        }
        // ----------------------------------------------------------
        // CLOSE SOCKET
        // ----------------------------------------------------------
        if (this.ws) {
            try {
                this.ws.close();
            }
            catch {
                // Ignore close errors.
            }
            this.ws =
                undefined;
        }
        (0, logger_1.log)("[WS] Closed");
    }
}
exports.BinanceWebSocket = BinanceWebSocket;
//# sourceMappingURL=websocket.js.map