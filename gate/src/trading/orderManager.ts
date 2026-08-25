import { BinanceClient } from "../binance/client";

import { SymbolRules } from "../types";

import {
  formatQuantity,
  roundDown,
} from "../utils/calculations";

// ============================================================
// ORDER MANAGER
// ============================================================

export class OrderManager {

  // ==========================================================
  // CONSTRUCTOR
  // ==========================================================

  constructor(
    private readonly client: BinanceClient,

    private readonly rules:
      Map<string, SymbolRules>
  ) {}

  // ==========================================================
  // BUY MARKET
  // ==========================================================

  async buyMarket(
    symbol: string,
    quantity: number,
    price: number
  ) {

    return this.marketOrder(
      symbol,
      "BUY",
      quantity,
      price
    );
  }

  // ==========================================================
  // SELL MARKET
  // ==========================================================

  async sellMarket(
    symbol: string,
    quantity: number,
    price: number
  ) {

    return this.marketOrder(
      symbol,
      "SELL",
      quantity,
      price
    );
  }

  // ==========================================================
  // CLOSE MARKET
  // ==========================================================

  async closeMarket(
    symbol: string,
    positionSide: "LONG" | "SHORT",
    quantity: number,
    price: number
  ) {

    return this.marketOrder(
      symbol,
      positionSide === "LONG"
        ? "SELL"
        : "BUY",
      quantity,
      price,
      true
    );
  }

  // ==========================================================
  // MARKET ORDER
  // ==========================================================

  private async marketOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    price: number,
    reduceOnly = false
  ) {

    // ========================================================
    // SYMBOL RULES
    // ========================================================

    const rule =
      this.rules.get(symbol);

    if (!rule) {

      throw new Error(
        `No trading rules for ${symbol}`
      );
    }

    // ========================================================
    // QUANTITY VALIDATION
    // ========================================================

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {

      throw new Error(
        `Invalid quantity for ${symbol}: ${quantity}`
      );
    }

    // ========================================================
    // PRICE VALIDATION
    // ========================================================

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {

      throw new Error(
        `Invalid price for ${symbol}: ${price}`
      );
    }

    // ========================================================
    // ROUND QUANTITY
    // ========================================================

    const adjusted =
      roundDown(
        quantity,
        rule.quantityStepSize
      );

    if (
      !Number.isFinite(adjusted) ||
      adjusted <= 0
    ) {

      throw new Error(
        `Invalid adjusted quantity for ${symbol}: ${adjusted}`
      );
    }

    // ========================================================
    // MINIMUM QUANTITY
    // ========================================================

    if (
      !reduceOnly &&
      adjusted <
        rule.minQuantity
    ) {

      throw new Error(
        `${symbol} quantity ${adjusted} ` +
        `is below minimum ${rule.minQuantity}`
      );
    }

    // ========================================================
    // NOTIONAL
    // ========================================================

    const notional =
      adjusted *
      price;

    if (
      !Number.isFinite(notional) ||
      notional <= 0
    ) {

      throw new Error(
        `Invalid notional for ${symbol}: ${notional}`
      );
    }

    // ========================================================
    // MINIMUM NOTIONAL
    // ========================================================

    if (
      !reduceOnly &&
      rule.minNotional > 0 &&
      notional <
      rule.minNotional
    ) {

      throw new Error(
        `${symbol} notional ${notional} ` +
        `is below minimum ${rule.minNotional}`
      );
    }

    // ========================================================
    // FORMAT QUANTITY
    // ========================================================

    const quantityString =
      formatQuantity(
        adjusted,
        rule.quantityStepSize
      );

    if (!quantityString) {

      throw new Error(
        `Unable to format quantity for ${symbol}`
      );
    }

    // ========================================================
    // SEND LOG
    // ========================================================

    console.log(
      `[ORDER] Sending ${side} ${symbol} | ` +
      `quantity=${quantityString} | ` +
      `price=${price} | ` +
      `notional=${notional}`
    );

    // ========================================================
    // SEND BINANCE ORDER
    // ========================================================

    try {

      const response =
        await this.client.signedPost(
          "/fapi/v1/order",
          {
            symbol,

            side,

            type: "MARKET",

            quantity:
              quantityString,

            ...(reduceOnly
              ? { reduceOnly: "true" }
              : {}),

            newOrderRespType:
              "RESULT",
          }
        );

      // ======================================================
      // SUCCESS
      // ======================================================

      console.log(
        `[ORDER] SUCCESS ${side} ${symbol} | ` +
        `orderId=${response?.orderId ?? "UNKNOWN"} | ` +
        `executedQty=${response?.executedQty ?? "UNKNOWN"}`
      );

      return response;

    } catch (err: any) {

      console.error(
        `[ORDER] FAILED ${side} ${symbol} | ` +
        `${
          err?.response?.data?.msg ??
          err?.message ??
          err
        }`
      );

      throw err;
    }
  }
}
