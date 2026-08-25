"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.percentageChange = percentageChange;
exports.takeProfitPrice = takeProfitPrice;
exports.quantityFromNotional = quantityFromNotional;
exports.roundDown = roundDown;
exports.formatQuantity = formatQuantity;
function percentageChange(current, reference) {
    if (!Number.isFinite(current) ||
        !Number.isFinite(reference) ||
        reference <= 0) {
        throw new Error("Invalid prices");
    }
    return ((current - reference) / reference) * 100;
}
function takeProfitPrice(entryPrice, profitPercent) {
    if (!Number.isFinite(entryPrice) ||
        entryPrice <= 0) {
        throw new Error("Invalid entry price");
    }
    return entryPrice * (1 + profitPercent / 100);
}
function quantityFromNotional(notional, price) {
    if (!Number.isFinite(notional) ||
        notional <= 0) {
        throw new Error("Invalid notional");
    }
    if (!Number.isFinite(price) ||
        price <= 0) {
        throw new Error("Invalid price");
    }
    return notional / price;
}
function roundDown(value, step) {
    if (!Number.isFinite(value) ||
        value <= 0) {
        throw new Error(`Invalid value: ${value}`);
    }
    if (!Number.isFinite(step) ||
        step <= 0) {
        throw new Error(`Invalid step: ${step}`);
    }
    const precision = decimalPlaces(step);
    const factor = 10 ** precision;
    const scaledValue = Math.floor(value * factor + 1e-9);
    const scaledStep = Math.round(step * factor);
    return (Math.floor(scaledValue / scaledStep) *
        scaledStep) / factor;
}
function formatQuantity(quantity, step) {
    const normalized = roundDown(quantity, step);
    const precision = decimalPlaces(step);
    return normalized
        .toFixed(precision)
        .replace(/\.?0+$/, "");
}
function decimalPlaces(value) {
    const string = String(value);
    if (string.includes("e-")) {
        const [coefficient = "", exponent = "0"] = string.split("e-");
        const decimalPart = coefficient.split(".")[1] ?? "";
        const coefficientDecimals = coefficient.includes(".")
            ? decimalPart.length
            : 0;
        return (Number(exponent) +
            coefficientDecimals);
    }
    const decimalIndex = string.indexOf(".");
    return decimalIndex === -1
        ? 0
        : string.length - decimalIndex - 1;
}
//# sourceMappingURL=calculations.js.map