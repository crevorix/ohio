import "dotenv/config";

import WebSocket from "ws";

import {
  log,
  error,
} from "../utils/logger";

export class BinanceWebSocket {
  private ws?: WebSocket;

  private reconnectTimer?: NodeJS.Timeout;

  private reconnectAttempts = 0;

  private manuallyClosed = false;

  private readonly symbols: string[];

  private readonly onPriceCallback: (
    symbol: string,
    price: number
  ) => Promise<void>;

  constructor(
    symbols: string[],
    onPrice: (
      symbol: string,
      price: number
    ) => Promise<void>
  ) {

    this.symbols = [
      ...new Set(
        symbols.map(
          symbol =>
            symbol
              .trim()
              .toUpperCase()
        )
      ),
    ];

    this.onPriceCallback =
      onPrice;
  }

  // ============================================================
  // CONNECT
  // ============================================================

  connect(): void {

    this.manuallyClosed =
      false;

    // ----------------------------------------------------------
    // CLOSE OLD SOCKET
    // ----------------------------------------------------------

    if (this.ws) {

      try {

        this.ws.removeAllListeners();

        this.ws.close();

      } catch {
        // Ignore old socket errors.
      }

      this.ws =
        undefined;
    }

    // ----------------------------------------------------------
    // CLEAR OLD RECONNECT TIMER
    // ----------------------------------------------------------

    if (
      this.reconnectTimer
    ) {

      clearTimeout(
        this.reconnectTimer
      );

      this.reconnectTimer =
        undefined;
    }

    // ----------------------------------------------------------
    // VALIDATE SYMBOLS
    // ----------------------------------------------------------

    if (
      this.symbols.length === 0
    ) {

      throw new Error(
        "No WebSocket symbols configured"
      );
    }

    // ----------------------------------------------------------
    // CREATE STREAM LIST
    // ----------------------------------------------------------

    const streams =
      this.symbols
        .map(
          symbol =>
            `${symbol.toLowerCase()}@markPrice`
        )
        .join("/");

    // ----------------------------------------------------------
    // BINANCE WEBSOCKET URL
    // ----------------------------------------------------------

    const baseUrl =
      process.env.BINANCE_WS_URL ||
      "wss://fstream.binance.com";

    const url =
      `${baseUrl}/stream?streams=${streams}`;

    // ----------------------------------------------------------
    // LOG
    // ----------------------------------------------------------

    log(
      `[WS] Connecting | ${this.symbols.length} symbols`
    );

    log(
      `[WS] Endpoint: ${baseUrl}`
    );

    // ----------------------------------------------------------
    // CREATE SOCKET
    // ----------------------------------------------------------

    this.ws =
      new WebSocket(url);

    // ==========================================================
    // OPEN
    // ==========================================================

    this.ws.on(
      "open",
      () => {

        this.reconnectAttempts =
          0;

        log(
          `[WS] Connected | ` +
          `Listening to ${this.symbols.length} symbols`
        );

        log(
          `[WS] Streams: ${streams}`
        );
      }
    );

    // ==========================================================
    // MESSAGE
    // ==========================================================

    this.ws.on(
      "message",
      async raw => {

        try {

          const message =
            JSON.parse(
              raw.toString()
            );

          const data =
            message?.data;

          if (!data) {
            return;
          }

          // ----------------------------------------------------
          // ONLY MARK PRICE EVENTS
          // ----------------------------------------------------

          if (
            data.e !==
            "markPriceUpdate"
          ) {
            return;
          }

          // ----------------------------------------------------
          // SYMBOL
          // ----------------------------------------------------

          const symbol =
            String(
              data.s ?? ""
            ).toUpperCase();

          // ----------------------------------------------------
          // PRICE
          // ----------------------------------------------------

          const price =
            Number(data.p);

          // ----------------------------------------------------
          // VALIDATE
          // ----------------------------------------------------

          if (
            !symbol ||
            !Number.isFinite(price) ||
            price <= 0
          ) {
            return;
          }

          // ----------------------------------------------------
          // LOG
          // ----------------------------------------------------

          log(
            `[WS] ${symbol} price=${price}`
          );

          // ----------------------------------------------------
          // SEND TO STRATEGY
          // ----------------------------------------------------

          try {

            await this.onPriceCallback(
              symbol,
              price
            );

          } catch (
            callbackError: any
          ) {

            error(
              `[WS] Strategy error ${symbol}: ` +
              `${
                callbackError?.message ??
                callbackError
              }`
            );
          }

        } catch (
          parseError: any
        ) {

          error(
            `[WS] Message parse error: ` +
            `${
              parseError?.message ??
              parseError
            }`
          );
        }
      }
    );

    // ==========================================================
    // ERROR
    // ==========================================================

    this.ws.on(
      "error",
      err => {

        error(
          `[WS] Error: ${err.message}`
        );
      }
    );

    // ==========================================================
    // CLOSE
    // ==========================================================

    this.ws.on(
      "close",
      (code, reason) => {

        const reasonText =
          reason?.toString() ||
          "none";

        error(
          `[WS] Disconnected | ` +
          `code=${code} | ` +
          `reason=${reasonText}`
        );

        if (
          !this.manuallyClosed
        ) {

          this.scheduleReconnect();
        }
      }
    );

    // ==========================================================
    // PING
    // ==========================================================

    this.ws.on(
      "ping",
      data => {

        try {

          this.ws?.pong(
            data
          );

        } catch {
          // Socket may already be closed.
        }
      }
    );
  }

  // ============================================================
  // RECONNECT
  // ============================================================

  private scheduleReconnect(): void {

    if (
      this.manuallyClosed ||
      this.reconnectTimer
    ) {
      return;
    }

    this.reconnectAttempts++;

    const delay =
      Math.min(
        2000 *
          Math.pow(
            2,
            this.reconnectAttempts - 1
          ),
        30000
      );

    log(
      `[WS] Reconnecting in ` +
      `${delay / 1000}s | ` +
      `attempt=${this.reconnectAttempts}`
    );

    this.reconnectTimer =
      setTimeout(
        () => {

          this.reconnectTimer =
            undefined;

          if (
            !this.manuallyClosed
          ) {

            this.connect();
          }

        },
        delay
      );
  }

  // ============================================================
  // CLOSE
  // ============================================================

  close(): void {

    this.manuallyClosed =
      true;

    // ----------------------------------------------------------
    // CANCEL RECONNECT
    // ----------------------------------------------------------

    if (
      this.reconnectTimer
    ) {

      clearTimeout(
        this.reconnectTimer
      );

      this.reconnectTimer =
        undefined;
    }

    // ----------------------------------------------------------
    // CLOSE SOCKET
    // ----------------------------------------------------------

    if (this.ws) {

      try {

        this.ws.close();

      } catch {
        // Ignore close errors.
      }

      this.ws =
        undefined;
    }

    log(
      "[WS] Closed"
    );
  }
}