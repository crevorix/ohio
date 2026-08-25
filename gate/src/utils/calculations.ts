export function percentageChange(
  current: number,
  reference: number
): number {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(reference) ||
    reference <= 0
  ) {
    throw new Error("Invalid prices");
  }

  return ((current - reference) / reference) * 100;
}

export function takeProfitPrice(
  entryPrice: number,
  profitPercent: number
): number {
  if (
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0
  ) {
    throw new Error("Invalid entry price");
  }

  return entryPrice * (1 + profitPercent / 100);
}

export function quantityFromNotional(
  notional: number,
  price: number
): number {
  if (
    !Number.isFinite(notional) ||
    notional <= 0
  ) {
    throw new Error("Invalid notional");
  }

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error("Invalid price");
  }

  return notional / price;
}

export function roundDown(
  value: number,
  step: number
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(`Invalid value: ${value}`);
  }

  if (
    !Number.isFinite(step) ||
    step <= 0
  ) {
    throw new Error(`Invalid step: ${step}`);
  }

  const precision = decimalPlaces(step);
  const factor = 10 ** precision;

  const scaledValue =
    Math.floor(value * factor + 1e-9);

  const scaledStep =
    Math.round(step * factor);

  return (
    Math.floor(
      scaledValue / scaledStep
    ) *
    scaledStep
  ) / factor;
}

export function formatQuantity(
  quantity: number,
  step: number
): string {
  const normalized =
    roundDown(quantity, step);

  const precision =
    decimalPlaces(step);

  return normalized
    .toFixed(precision)
    .replace(/\.?0+$/, "");
}

function decimalPlaces(value: number): number {
  const string = String(value);

  if (string.includes("e-")) {
    const [coefficient = "", exponent = "0"] =
      string.split("e-");

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
    string.indexOf(".");

  return decimalIndex === -1
    ? 0
    : string.length - decimalIndex - 1;
}
