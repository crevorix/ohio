"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Strategy = void 0;
require("dotenv/config");
const calculations_1 = require("../utils/calculations");
const logger_1 = require("../utils/logger");
// ============================================================
// ENVIRONMENT CONFIGURATION
// ============================================================
const LONG_DROP_PERCENT = Number(process.env.LONG_DROP_PERCENT);
const SHORT_RISE_PERCENT = Number(process.env.SHORT_RISE_PERCENT);
const MARGIN_PERCENT = Number(process.env.MARGIN_PERCENT);
const LEVERAGE = Number(process.env.LEVERAGE);
const TP_PERCENT = Number(process.env.TP_PERCENT);
const DRY_RUN = process.env.DRY_RUN === "true";
// ============================================================
// VALIDATION
// ============================================================
if (!Number.isFinite(LONG_DROP_PERCENT) ||
    LONG_DROP_PERCENT <= 0) {
    throw new Error("LONG_DROP_PERCENT is missing or invalid");
}
if (!Number.isFinite(SHORT_RISE_PERCENT) ||
    SHORT_RISE_PERCENT <= 0) {
    throw new Error("SHORT_RISE_PERCENT is missing or invalid");
}
if (!Number.isFinite(MARGIN_PERCENT) ||
    MARGIN_PERCENT <= 0) {
    throw new Error("MARGIN_PERCENT is missing or invalid");
}
if (!Number.isFinite(LEVERAGE) ||
    LEVERAGE <= 0) {
    throw new Error("LEVERAGE is missing or invalid");
}
if (!Number.isFinite(TP_PERCENT) ||
    TP_PERCENT <= 0) {
    throw new Error("TP_PERCENT is missing or invalid");
}
// ============================================================
// STRATEGY
// ============================================================
class Strategy {
    futures;
    positions;
    orders;
    // ==========================================================
    // REFERENCE PRICES
    // ==========================================================
    references = new Map();
    // ==========================================================
    // OPENING LOCK
    // ==========================================================
    buying = new Set();
    // ==========================================================
    // CLOSING LOCK
    // ==========================================================
    closing = new Set();
    // ==========================================================
    // SYMBOL PROCESSING LOCK
    // ==========================================================
    processing = new Set();
    // ==========================================================
    // RE-ENTRY LOCK
    // ==========================================================
    awaitingSignalReset = new Set();
    // ==========================================================
    // CONSTRUCTOR
    // ==========================================================
    constructor(futures, positions, orders) {
        this.futures = futures;
        this.positions = positions;
        this.orders = orders;
    }
    // ==========================================================
    // SET REFERENCE
    // ==========================================================
    setReference(symbol, price) {
        if (Number.isFinite(price) &&
            price > 0) {
            this.references.set(symbol, price);
            (0, logger_1.log)(`[REFERENCE] ${symbol} = ${price}`);
        }
    }
    // ==========================================================
    // GET REFERENCE
    // ==========================================================
    getReference(symbol) {
        return this.references.get(symbol);
    }
    // ==========================================================
    // PRICE UPDATE
    // ==========================================================
    async onPrice(symbol, price) {
        if (this.processing.has(symbol)) {
            return;
        }
        this.processing.add(symbol);
        try {
            // ------------------------------------------------------
            // VALIDATE PRICE
            // ------------------------------------------------------
            if (!Number.isFinite(price) ||
                price <= 0) {
                return;
            }
            // ======================================================
            // LOCAL POSITION
            // ======================================================
            const localPosition = this.positions.getPosition(symbol);
            // ======================================================
            // LOCAL POSITION EXISTS
            // ======================================================
            if (localPosition) {
                // ----------------------------------------------------
                // VERIFY AGAINST BINANCE
                // ----------------------------------------------------
                const binancePosition = DRY_RUN
                    ? {
                        positionAmt: localPosition.side === "LONG"
                            ? localPosition.quantity
                            : -localPosition.quantity,
                    }
                    : await this.futures.getOpenPosition(symbol);
                // ----------------------------------------------------
                // STALE LOCAL POSITION
                // ----------------------------------------------------
                if (!binancePosition) {
                    (0, logger_1.log)(`[RECONCILE] ${symbol} local position exists ` +
                        `but Binance has no open position. ` +
                        `Closing stale local position.`);
                    let pnl = 0;
                    if (localPosition.side === "LONG") {
                        pnl =
                            (price -
                                localPosition.entryPrice) *
                                localPosition.quantity;
                    }
                    else {
                        pnl =
                            (localPosition.entryPrice -
                                price) *
                                localPosition.quantity;
                    }
                    this.positions.closePosition(symbol, price, pnl, 0);
                    this.awaitingSignalReset.add(symbol);
                    return;
                }
                else {
                    // ==================================================
                    // REAL POSITION EXISTS
                    // ==================================================
                    if (localPosition.side === "LONG") {
                        if (price >=
                            localPosition.takeProfitPrice) {
                            await this.closePosition(localPosition, price);
                        }
                        return;
                    }
                    if (localPosition.side === "SHORT") {
                        if (price <=
                            localPosition.takeProfitPrice) {
                            await this.closePosition(localPosition, price);
                        }
                        return;
                    }
                    return;
                }
            }
            // ======================================================
            // ALREADY OPENING
            // ======================================================
            if (this.buying.has(symbol)) {
                return;
            }
            // ======================================================
            // REFERENCE
            // ======================================================
            const reference = this.references.get(symbol);
            if (!reference) {
                return;
            }
            // ======================================================
            // CHANGE
            // ======================================================
            const change = (0, calculations_1.percentageChange)(price, reference);
            // ======================================================
            // LONG
            // ======================================================
            const longSignal = change <=
                -LONG_DROP_PERCENT;
            // ======================================================
            // SHORT
            // ======================================================
            const shortSignal = change >=
                SHORT_RISE_PERCENT;
            if (!longSignal &&
                !shortSignal) {
                this.awaitingSignalReset.delete(symbol);
                return;
            }
            if (this.awaitingSignalReset.has(symbol)) {
                return;
            }
            // ======================================================
            // LONG SIGNAL
            // ======================================================
            if (longSignal) {
                (0, logger_1.log)(`[SIGNAL] ${symbol} LONG | ` +
                    `reference=${reference} | ` +
                    `price=${price} | ` +
                    `change=${change.toFixed(2)}%`);
                await this.openPosition(symbol, price, "LONG");
                return;
            }
            // ======================================================
            // SHORT SIGNAL
            // ======================================================
            if (shortSignal) {
                (0, logger_1.log)(`[SIGNAL] ${symbol} SHORT | ` +
                    `reference=${reference} | ` +
                    `price=${price} | ` +
                    `change=${change.toFixed(2)}%`);
                await this.openPosition(symbol, price, "SHORT");
                return;
            }
        }
        catch (err) {
            (0, logger_1.error)(`${symbol}: ${err?.message ??
                err}`);
        }
        finally {
            this.processing.delete(symbol);
        }
    }
    // ==========================================================
    // OPEN POSITION
    // ==========================================================
    async openPosition(symbol, price, side) {
        // ========================================================
        // OPENING LOCK
        // ========================================================
        if (this.buying.has(symbol)) {
            return;
        }
        this.buying.add(symbol);
        try {
            // ======================================================
            // LOCAL CHECK
            // ======================================================
            if (this.positions.hasPosition(symbol)) {
                (0, logger_1.log)(`[SKIP] ${symbol} local position already exists`);
                return;
            }
            // ======================================================
            // BINANCE CHECK
            // ======================================================
            const existing = await this.futures.getOpenPosition(symbol);
            if (existing) {
                (0, logger_1.log)(`[SKIP] ${symbol} Binance position already open`);
                return;
            }
            // ======================================================
            // BALANCE
            // ======================================================
            const balance = await this.futures.getBalance();
            if (!Number.isFinite(balance.availableBalance) ||
                balance.availableBalance <= 0) {
                throw new Error("Available Futures balance is invalid");
            }
            // ======================================================
            // MARGIN
            // ======================================================
            const margin = balance.availableBalance *
                MARGIN_PERCENT /
                100;
            if (!Number.isFinite(margin) ||
                margin <= 0) {
                throw new Error(`Invalid margin calculated: ${margin}`);
            }
            // ======================================================
            // NOTIONAL
            // ======================================================
            const notional = margin *
                LEVERAGE;
            if (!Number.isFinite(notional) ||
                notional <= 0) {
                throw new Error(`Invalid notional calculated: ${notional}`);
            }
            // ======================================================
            // QUANTITY
            // ======================================================
            const requestedQuantity = (0, calculations_1.quantityFromNotional)(notional, price);
            if (!Number.isFinite(requestedQuantity) ||
                requestedQuantity <= 0) {
                throw new Error(`Invalid quantity calculated: ${requestedQuantity}`);
            }
            // ======================================================
            // CROSS MARGIN
            // ======================================================
            if (!DRY_RUN) {
                await this.futures.setCrossMargin(symbol);
            }
            // ======================================================
            // LEVERAGE
            // ======================================================
            if (!DRY_RUN) {
                await this.futures.setLeverage(symbol, LEVERAGE);
            }
            // ======================================================
            // DRY RUN
            // ======================================================
            if (DRY_RUN) {
                const tp = this.calculateTakeProfit(price, side);
                this.positions.createPosition({
                    symbol,
                    side,
                    margin,
                    notional,
                    quantity: requestedQuantity,
                    entryPrice: price,
                    takeProfitPrice: tp,
                    buyOrderId: `DRY-${Date.now()}`,
                    status: "OPEN",
                    createdAt: new Date().toISOString(),
                });
                (0, logger_1.log)(`[DRY ${side}] ${symbol} | ` +
                    `entry=${price} | ` +
                    `margin=${margin} | ` +
                    `notional=${notional} | ` +
                    `qty=${requestedQuantity} | ` +
                    `TP=${tp}`);
                return;
            }
            // ======================================================
            // FINAL BINANCE CHECK
            // ======================================================
            const beforeOrder = await this.futures.getOpenPosition(symbol);
            if (beforeOrder) {
                (0, logger_1.log)(`[SKIP] ${symbol} position appeared before order`);
                return;
            }
            // ======================================================
            // MARKET ORDER
            // ======================================================
            let result;
            if (side === "LONG") {
                result =
                    await this.orders.buyMarket(symbol, requestedQuantity, price);
            }
            else {
                result =
                    await this.orders.sellMarket(symbol, requestedQuantity, price);
            }
            // ======================================================
            // ORDER ID
            // ======================================================
            const orderId = result?.orderId;
            if (orderId === undefined ||
                orderId === null) {
                throw new Error(`${side} order did not return an orderId`);
            }
            // ======================================================
            // EXECUTED QUANTITY
            // ======================================================
            const executedQty = Number(result.executedQty);
            if (!Number.isFinite(executedQty) ||
                executedQty <= 0) {
                throw new Error(`${side} executed quantity invalid for ${symbol}`);
            }
            // ======================================================
            // ENTRY PRICE
            // ======================================================
            let entryPrice = Number(result.avgPrice);
            // ------------------------------------------------------
            // FALLBACK 1
            // ------------------------------------------------------
            if (!Number.isFinite(entryPrice) ||
                entryPrice <= 0) {
                const binancePosition = await this.futures.getOpenPosition(symbol);
                entryPrice =
                    Number(binancePosition?.entryPrice);
            }
            // ------------------------------------------------------
            // FALLBACK 2
            // ------------------------------------------------------
            if (!Number.isFinite(entryPrice) ||
                entryPrice <= 0) {
                entryPrice =
                    await this.futures.getOrderAveragePrice(symbol, orderId);
            }
            // ======================================================
            // ENTRY VALIDATION
            // ======================================================
            if (!Number.isFinite(entryPrice) ||
                entryPrice <= 0) {
                throw new Error(`Unable to determine entry price for ${symbol}`);
            }
            // ======================================================
            // TAKE PROFIT
            // ======================================================
            const tp = this.calculateTakeProfit(entryPrice, side);
            // ======================================================
            // ACTUAL NOTIONAL
            // ======================================================
            const actualNotional = entryPrice *
                executedQty;
            // ======================================================
            // SAVE POSITION
            // ======================================================
            this.positions.createPosition({
                symbol,
                side,
                margin,
                notional: actualNotional,
                quantity: executedQty,
                entryPrice,
                takeProfitPrice: tp,
                buyOrderId: String(orderId),
                status: "OPEN",
                createdAt: new Date().toISOString(),
            });
            // ======================================================
            // SUCCESS
            // ======================================================
            (0, logger_1.log)(`[${side}] ${symbol} | ` +
                `entry=${entryPrice} | ` +
                `qty=${executedQty} | ` +
                `notional=${actualNotional} | ` +
                `TP=${tp} | ` +
                `orderId=${orderId}`);
        }
        catch (err) {
            (0, logger_1.error)(`[${side} FAILED] ${symbol}: ` +
                `${err?.response?.data?.msg ??
                    err?.message ??
                    err}`);
        }
        finally {
            this.buying.delete(symbol);
        }
    }
    // ==========================================================
    // TAKE PROFIT
    // ==========================================================
    calculateTakeProfit(entryPrice, side) {
        // TP_PERCENT represents desired leveraged return.
        //
        // Example:
        // TP_PERCENT = 200
        // LEVERAGE = 10
        //
        // Required underlying price movement:
        //
        // 200 / 10 = 20%
        //
        // LONG:
        // entry * 1.20
        //
        // SHORT:
        // entry * 0.80
        const priceMovePercent = TP_PERCENT /
            LEVERAGE;
        let tp;
        if (side === "LONG") {
            tp =
                entryPrice *
                    (1 +
                        priceMovePercent /
                            100);
        }
        else {
            tp =
                entryPrice *
                    (1 -
                        priceMovePercent /
                            100);
        }
        if (!Number.isFinite(tp) ||
            tp <= 0) {
            throw new Error(`Invalid take profit price: ${tp}`);
        }
        return tp;
    }
    // ==========================================================
    // CLOSE POSITION
    // ==========================================================
    async closePosition(position, price) {
        const symbol = position.symbol;
        // ========================================================
        // CLOSING LOCK
        // ========================================================
        if (this.closing.has(symbol)) {
            return;
        }
        this.closing.add(symbol);
        try {
            // ======================================================
            // VERIFY BINANCE POSITION
            // ======================================================
            const binancePosition = await this.futures.getOpenPosition(symbol);
            if (!binancePosition) {
                (0, logger_1.log)(`[RECONCILE] ${symbol} already closed on Binance`);
            }
            else if (!DRY_RUN) {
                const positionAmount = Number(binancePosition.positionAmt);
                if (!Number.isFinite(positionAmount) ||
                    positionAmount === 0) {
                    throw new Error(`Invalid Binance position size for ${symbol}`);
                }
                const liveSide = positionAmount > 0
                    ? "LONG"
                    : "SHORT";
                if (liveSide !== position.side) {
                    throw new Error(`${symbol} local side ${position.side} does not match ` +
                        `Binance side ${liveSide}; refusing to close it`);
                }
                const liveQuantity = Math.abs(positionAmount);
                // ====================================================
                // REDUCE-ONLY CLOSE USING LIVE POSITION SIZE
                // ====================================================
                await this.orders.closeMarket(symbol, liveSide, liveQuantity, price);
                const remainingPosition = await this.futures.getOpenPosition(symbol);
                if (remainingPosition) {
                    throw new Error(`${symbol} still has an open Binance position after close order`);
                }
            }
            // ======================================================
            // PNL
            // ======================================================
            let pnl;
            if (position.side === "LONG") {
                pnl =
                    (price -
                        position.entryPrice) *
                        position.quantity;
            }
            else {
                pnl =
                    (position.entryPrice -
                        price) *
                        position.quantity;
            }
            // ======================================================
            // CLOSE DATABASE POSITION
            // ======================================================
            this.positions.closePosition(symbol, price, pnl, 0);
            this.awaitingSignalReset.add(symbol);
            // ======================================================
            // LOG
            // ======================================================
            (0, logger_1.log)(`[CLOSE] ${symbol} | ` +
                `side=${position.side} | ` +
                `entry=${position.entryPrice} | ` +
                `exit=${price} | ` +
                `qty=${position.quantity} | ` +
                `PnL=${pnl.toFixed(4)}`);
        }
        catch (err) {
            (0, logger_1.error)(`[CLOSE FAILED] ${symbol}: ` +
                `${err?.response?.data?.msg ??
                    err?.message ??
                    err}`);
        }
        finally {
            this.closing.delete(symbol);
        }
    }
}
exports.Strategy = Strategy;
//# sourceMappingURL=strategy.js.map