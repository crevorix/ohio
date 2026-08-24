import { BinanceClient } from "./client";

import { SymbolRules } from "../types";

export class FuturesService {
  constructor(
    private readonly client: BinanceClient
  ) {}

  // ============================================================
  // ACCOUNT
  // ============================================================

  async getAccount() {
    return this.client.signedGet(
      "/fapi/v3/account"
    );
  }

  // ============================================================
  // BALANCE
  // ============================================================

  async getBalance() {
    const account =
      await this.getAccount();

    if (
      !account ||
      !Array.isArray(account.assets)
    ) {
      throw new Error(
        "Invalid Futures account response"
      );
    }

    const usdt =
      account.assets.find(
        (asset: any) =>
          asset.asset === "USDT"
      );

    if (!usdt) {
      throw new Error(
        "USDT balance not found"
      );
    }

    const walletBalance =
      Number(
        usdt.walletBalance
      );

    const availableBalance =
      Number(
        usdt.availableBalance
      );

    const marginBalance =
      Number(
        usdt.marginBalance
      );

    if (
      !Number.isFinite(walletBalance) ||
      !Number.isFinite(availableBalance) ||
      !Number.isFinite(marginBalance)
    ) {
      throw new Error(
        "Invalid USDT balance received from Binance"
      );
    }

    return {
      walletBalance,
      availableBalance,
      marginBalance,
    };
  }

  // ============================================================
  // EXCHANGE INFORMATION
  // ============================================================

  async getExchangeInfo() {
    return this.client.get(
      "/fapi/v1/exchangeInfo"
    );
  }

  // ============================================================
  // CURRENT PRICE
  // ============================================================

  async getPrice(
    symbol: string
  ): Promise<number> {

    const data =
      await this.client.get(
        "/fapi/v1/ticker/price",
        { symbol }
      );

    const price =
      Number(data.price);

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        `Invalid price received for ${symbol}`
      );
    }

    return price;
  }

  // ============================================================
  // 24H TICKER
  // ============================================================

  async getTicker(
    symbol: string
  ) {
    return this.client.get(
      "/fapi/v1/ticker/24hr",
      { symbol }
    );
  }

  // ============================================================
  // SET LEVERAGE
  // ============================================================

  async setLeverage(
    symbol: string,
    leverage: number
  ) {

    if (
      !Number.isFinite(leverage) ||
      leverage <= 0
    ) {
      throw new Error(
        `Invalid leverage: ${leverage}`
      );
    }

    return this.client.signedPost(
      "/fapi/v1/leverage",
      {
        symbol,
        leverage,
      }
    );
  }

  // ============================================================
  // SET CROSS MARGIN
  // ============================================================

  async setCrossMargin(
    symbol: string
  ) {

    try {

      return await this.client.signedPost(
        "/fapi/v1/marginType",
        {
          symbol,
          marginType: "CROSSED",
        }
      );

    } catch (error: any) {

      const message =
        error?.response?.data?.msg ??
        error?.message ??
        "";

      // Binance returns this when
      // Cross Margin is already enabled.

      if (
        message.includes(
          "No need to change margin type"
        )
      ) {
        return {
          alreadyCross: true,
        };
      }

      throw error;
    }
  }

  // ============================================================
  // POSITION RISK
  // ============================================================

  async getPositionRisk() {

    return this.client.signedGet(
      "/fapi/v3/positionRisk"
    );
  }

  // ============================================================
  // POSITION MODE
  // ============================================================

  async assertOneWayPositionMode(): Promise<void> {

    const data =
      await this.client.signedGet(
        "/fapi/v1/positionSide/dual"
      );

    if (
      !data ||
      typeof data.dualSidePosition !== "boolean"
    ) {
      throw new Error(
        "Invalid Binance position-mode response"
      );
    }

    if (data.dualSidePosition) {
      throw new Error(
        "Binance Hedge Mode is not supported. " +
        "Switch the Futures account to One-way Mode before running this bot."
      );
    }
  }

  // ============================================================
  // GET OPEN POSITION
  // ============================================================

  async getOpenPosition(
    symbol: string
  ): Promise<any | null> {

    const positions =
      await this.getPositionRisk();

    if (
      !Array.isArray(positions)
    ) {
      throw new Error(
        "Invalid position risk response"
      );
    }

    const position =
      positions.find(
        (item: any) =>
          item.symbol === symbol &&
          Number(item.positionAmt) !== 0
      );

    return position ?? null;
  }

  // ============================================================
  // GET ALL OPEN POSITIONS
  // ============================================================

  async getOpenPositions(): Promise<any[]> {

    const positions =
      await this.getPositionRisk();

    if (
      !Array.isArray(positions)
    ) {
      throw new Error(
        "Invalid position risk response"
      );
    }

    return positions.filter(
      (position: any) =>
        Number(position.positionAmt) !== 0
    );
  }

  // ============================================================
  // GET POSITION SIDE
  // ============================================================

  async getOpenPositionSide(
    symbol: string
  ): Promise<
    "LONG" | "SHORT" | null
  > {

    const position =
      await this.getOpenPosition(
        symbol
      );

    if (!position) {
      return null;
    }

    const amount =
      Number(
        position.positionAmt
      );

    if (
      !Number.isFinite(amount) ||
      amount === 0
    ) {
      return null;
    }

    return amount > 0
      ? "LONG"
      : "SHORT";
  }

  // ============================================================
  // OPEN ORDERS
  // ============================================================

  async getOpenOrders(
    symbol?: string
  ) {

    if (symbol) {

      return this.client.signedGet(
        "/fapi/v1/openOrders",
        { symbol }
      );
    }

    return this.client.signedGet(
      "/fapi/v1/openOrders"
    );
  }

  // ============================================================
  // USER TRADES
  // ============================================================

  async getUserTrades(
    symbol: string
  ) {

    return this.client.signedGet(
      "/fapi/v1/userTrades",
      {
        symbol,
        limit: 100,
      }
    );
  }

  // ============================================================
  // GET ORDER
  // ============================================================

  async getOrder(
    symbol: string,
    orderId: string | number
  ) {

    return this.client.signedGet(
      "/fapi/v1/order",
      {
        symbol,
        orderId,
      }
    );
  }

  // ============================================================
  // ORDER AVERAGE PRICE
  // ============================================================

  async getOrderAveragePrice(
    symbol: string,
    orderId: string | number
  ): Promise<number> {

    const trades =
      await this.getUserTrades(
        symbol
      );

    if (
      !Array.isArray(trades)
    ) {
      throw new Error(
        `Invalid trade response for ${symbol}`
      );
    }

    const matchingTrades =
      trades.filter(
        (trade: any) =>
          String(trade.orderId) ===
          String(orderId)
      );

    if (
      matchingTrades.length === 0
    ) {
      throw new Error(
        `No execution trades found for ` +
        `${symbol} order ${orderId}`
      );
    }

    let totalQty = 0;
    let totalValue = 0;

    for (
      const trade of matchingTrades
    ) {

      const qty =
        Number(trade.qty);

      const price =
        Number(trade.price);

      if (
        !Number.isFinite(qty) ||
        !Number.isFinite(price) ||
        qty <= 0 ||
        price <= 0
      ) {
        continue;
      }

      totalQty += qty;

      totalValue +=
        qty * price;
    }

    if (
      totalQty <= 0 ||
      totalValue <= 0
    ) {
      throw new Error(
        `Invalid execution data for ` +
        `${symbol} order ${orderId}`
      );
    }

    return (
      totalValue /
      totalQty
    );
  }

  // ============================================================
  // PARSE SYMBOL RULES
  // ============================================================

  parseSymbolRules(
    exchangeInfo: any
  ): Map<string, SymbolRules> {

    const result =
      new Map<string, SymbolRules>();

    if (
      !exchangeInfo ||
      !Array.isArray(
        exchangeInfo.symbols
      )
    ) {
      throw new Error(
        "Invalid Binance exchange information"
      );
    }

    for (
      const symbol of exchangeInfo.symbols
    ) {

      // --------------------------------------------------------
      // ONLY PERPETUAL CONTRACTS
      // --------------------------------------------------------

      if (
        symbol.contractType !==
        "PERPETUAL"
      ) {
        continue;
      }

      // --------------------------------------------------------
      // ONLY TRADING SYMBOLS
      // --------------------------------------------------------

      if (
        symbol.status !==
        "TRADING"
      ) {
        continue;
      }

      if (
        !Array.isArray(
          symbol.filters
        )
      ) {
        continue;
      }

      // --------------------------------------------------------
      // PRICE FILTER
      // --------------------------------------------------------

      const priceFilter =
        symbol.filters.find(
          (filter: any) =>
            filter.filterType ===
            "PRICE_FILTER"
        );

      // --------------------------------------------------------
      // LOT SIZE
      // --------------------------------------------------------

      const lotFilter =
        symbol.filters.find(
          (filter: any) =>
            filter.filterType ===
            "LOT_SIZE"
        );

      // --------------------------------------------------------
      // MARKET LOT SIZE
      // --------------------------------------------------------

      const marketLotFilter =
        symbol.filters.find(
          (filter: any) =>
            filter.filterType ===
            "MARKET_LOT_SIZE"
        );

      const quantityFilter =
        marketLotFilter ??
        lotFilter;

      // --------------------------------------------------------
      // NOTIONAL FILTER
      // --------------------------------------------------------

      const notionalFilter =
        symbol.filters.find(
          (filter: any) =>
            filter.filterType ===
              "MIN_NOTIONAL" ||
            filter.filterType ===
              "NOTIONAL"
        );

      // --------------------------------------------------------
      // VALUES
      // --------------------------------------------------------

      const priceTickSize =
        Number(
          priceFilter?.tickSize ?? 0
        );

      const quantityStepSize =
        Number(
          quantityFilter?.stepSize ?? 0
        );

      const minQuantity =
        Number(
          quantityFilter?.minQty ?? 0
        );

      const minNotional =
        Number(
          notionalFilter?.notional ??
          notionalFilter?.minNotional ??
          0
        );

      // --------------------------------------------------------
      // SAVE RULES
      // --------------------------------------------------------

      result.set(
        symbol.symbol,
        {
          symbol:
            symbol.symbol,

          status:
            symbol.status,

          contractType:
            symbol.contractType,

          priceTickSize,

          quantityStepSize,

          minQuantity,

          minNotional,
        }
      );
    }

    return result;
  }

  // ============================================================
  // NORMALIZE QUANTITY
  // ============================================================

  normalizeQuantity(
    quantity: number,
    stepSize: number
  ): number {

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `Invalid quantity: ${quantity}`
      );
    }

    if (
      !Number.isFinite(stepSize) ||
      stepSize <= 0
    ) {
      throw new Error(
        `Invalid quantity step size: ${stepSize}`
      );
    }

    const precision =
      this.getDecimalPrecision(
        stepSize
      );

    const multiplier =
      10 ** precision;

    const scaledQuantity =
      Math.floor(
        quantity *
          multiplier +
          1e-9
      );

    const scaledStep =
      Math.round(
        stepSize *
          multiplier
      );

    if (
      scaledStep <= 0
    ) {
      throw new Error(
        `Invalid scaled step size: ${stepSize}`
      );
    }

    const normalized =
      (
        Math.floor(
          scaledQuantity /
          scaledStep
        ) *
        scaledStep
      ) /
      multiplier;

    return Number(
      normalized.toFixed(
        precision
      )
    );
  }

  // ============================================================
  // FORMAT QUANTITY
  // ============================================================

  formatQuantity(
    quantity: number,
    stepSize: number
  ): string {

    const normalized =
      this.normalizeQuantity(
        quantity,
        stepSize
      );

    const precision =
      this.getDecimalPrecision(
        stepSize
      );

    return normalized
      .toFixed(precision)
      .replace(
        /\.?0+$/,
        ""
      );
  }

  // ============================================================
  // DECIMAL PRECISION
  // ============================================================

  private getDecimalPrecision(
    value: number
  ): number {

    const stringValue =
      String(value);

    if (
      stringValue.includes("e-")
    ) {

      const [
        coefficient = "",
        exponent = "0",
      ] =
        stringValue.split("e-");

      const decimalPart =
        coefficient.split(".")[1] ?? "";

      const coefficientDecimals =
        coefficient.includes(".")
          ? decimalPart.length
          : 0;

      return (
        Number(exponent) +
        coefficientDecimals
      );
    }

    const decimalIndex =
      stringValue.indexOf(".");

    if (
      decimalIndex === -1
    ) {
      return 0;
    }

    return (
      stringValue.length -
      decimalIndex -
      1
    );
  }

  // ============================================================
  // GET VALID QUANTITY
  // ============================================================

  async getValidQuantity(
    symbol: string,
    quantity: number
  ): Promise<number> {

    const rules =
      await this.getSymbolRules(
        symbol
      );

    const valid =
      this.normalizeQuantity(
        quantity,
        rules.quantityStepSize
      );

    if (
      valid <
      rules.minQuantity
    ) {
      throw new Error(
        `${symbol} quantity ${valid} ` +
        `is below minimum ${rules.minQuantity}`
      );
    }

    return valid;
  }

  // ============================================================
  // GET VALID QUANTITY STRING
  // ============================================================

  async getValidQuantityString(
    symbol: string,
    quantity: number
  ): Promise<string> {

    const rules =
      await this.getSymbolRules(
        symbol
      );

    const valid =
      this.normalizeQuantity(
        quantity,
        rules.quantityStepSize
      );

    if (
      valid <
      rules.minQuantity
    ) {
      throw new Error(
        `${symbol} quantity ${valid} ` +
        `is below minimum ${rules.minQuantity}`
      );
    }

    return this.formatQuantity(
      valid,
      rules.quantityStepSize
    );
  }

  // ============================================================
  // GET SYMBOL RULES
  // ============================================================

  private async getSymbolRules(
    symbol: string
  ): Promise<SymbolRules> {

    const exchangeInfo =
      await this.getExchangeInfo();

    const rules =
      this.parseSymbolRules(
        exchangeInfo
      );

    const rule =
      rules.get(symbol);

    if (!rule) {
      throw new Error(
        `No trading rules found for ${symbol}`
      );
    }

    return rule;
  }

  // ============================================================
  // VALIDATE NOTIONAL
  // ============================================================

  async validateOrderNotional(
    symbol: string,
    quantity: number,
    price: number
  ): Promise<void> {

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `Invalid quantity: ${quantity}`
      );
    }

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        `Invalid price: ${price}`
      );
    }

    const rules =
      await this.getSymbolRules(
        symbol
      );

    const notional =
      quantity * price;

    if (
      rules.minNotional > 0 &&
      notional <
        rules.minNotional
    ) {
      throw new Error(
        `${symbol} order notional ${notional} ` +
        `is below minimum ${rules.minNotional}`
      );
    }
  }
}
