import "dotenv/config";

import { BinanceClient } from "./binance/client";
import { FuturesService } from "./binance/futures";
import { HistoricalService } from "./binance/historical";
import { BinanceWebSocket } from "./binance/websocket";

import { BotDatabase } from "./database/database";

import { PositionManager } from "./trading/positionManager";
import { OrderManager } from "./trading/orderManager";

import { Strategy } from "./strategy/strategy";

import {
  log,
  error,
} from "./utils/logger";

// ============================================================
// ENVIRONMENT NUMBER
// ============================================================

function numberEnv(
  name: string
): number {

  const value =
    Number(
      process.env[name]
    );

  if (
    !Number.isFinite(value)
  ) {

    throw new Error(
      `Invalid or missing environment variable: ${name}`
    );
  }

  return value;
}

// ============================================================
// SYMBOLS
// ============================================================

const symbolsFromEnv =
  process.env.SYMBOLS ?? "";

const configuredSymbols =
  symbolsFromEnv
    .split(",")
    .map(
      (symbol) =>
        symbol.trim().toUpperCase()
    )
    .filter(Boolean);

// ============================================================
// CONFIGURATION
// ============================================================

const dryRun =
  process.env.DRY_RUN === "true";

const leverage =
  numberEnv("LEVERAGE");

const marginPercent =
  numberEnv("MARGIN_PERCENT");

const lookbackDays =
  numberEnv("LOOKBACK_DAYS");

const longDropPercent =
  numberEnv("LONG_DROP_PERCENT");

const shortRisePercent =
  numberEnv("SHORT_RISE_PERCENT");

const takeProfitPercent =
  numberEnv("TP_PERCENT");

// ============================================================
// VALIDATE SYMBOLS
// ============================================================

if (
  configuredSymbols.length === 0
) {

  throw new Error(
    "No SYMBOLS configured in .env"
  );
}

// ============================================================
// MAIN
// ============================================================

async function main() {

  // ==========================================================
  // START
  // ==========================================================

  log(
    "Starting Ohio"
  );

  // ==========================================================
  // MODE
  // ==========================================================

  log(
    `Mode: ${
      dryRun
        ? "DRY RUN"
        : "LIVE"
    }`
  );

  // ==========================================================
  // CONFIG
  // ==========================================================

  log(
    `Leverage: ${leverage}x`
  );

  log(
    `Margin: ${marginPercent}%`
  );

  log(
    `Lookback: ${lookbackDays} days`
  );

  log(
    `LONG trigger: -${longDropPercent}%`
  );

  log(
    `SHORT trigger: +${shortRisePercent}%`
  );

  log(
    `Take profit: ${takeProfitPercent}%`
  );

  // ==========================================================
  // BINANCE CLIENT
  // ==========================================================

  const client =
    new BinanceClient();

  // ==========================================================
  // FUTURES
  // ==========================================================

  const futures =
    new FuturesService(
      client
    );

  if (!dryRun) {

    await futures.assertOneWayPositionMode();

    log(
      "Position mode: One-way"
    );
  }

  // ==========================================================
  // HISTORICAL
  // ==========================================================

  const historical =
    new HistoricalService(
      client
    );

  // ==========================================================
  // DATABASE
  // ==========================================================

  const database =
    new BotDatabase();

  // ==========================================================
  // POSITION MANAGER
  // ==========================================================

  const positions =
    new PositionManager(
      database
    );

  // ==========================================================
  // EXCHANGE INFORMATION
  // ==========================================================

  const exchangeInfo =
    await futures.getExchangeInfo();

  // ==========================================================
  // SYMBOL RULES
  // ==========================================================

  const rules =
    futures.parseSymbolRules(
      exchangeInfo
    );

  // ==========================================================
  // FILTER SYMBOLS
  // ==========================================================

  const symbols =
    configuredSymbols.filter(
      (symbol) =>
        rules.has(symbol)
    );

  if (
    symbols.length === 0
  ) {

    throw new Error(
      "No configured symbols are available on Binance Futures"
    );
  }

  // ==========================================================
  // SYMBOLS
  // ==========================================================

  log(
    `Trading symbols: ${symbols.join(", ")}`
  );

  // ==========================================================
  // ORDER MANAGER
  // ==========================================================

  const orders =
    new OrderManager(
      client,
      rules
    );

  // ==========================================================
  // STRATEGY
  // ==========================================================

  const strategy =
    new Strategy(
      futures,
      positions,
      orders
    );

  // ==========================================================
  // BALANCE
  // ==========================================================

  const balance =
    await futures.getBalance();

  log(
    `Available balance: ${
      balance.availableBalance
    } USDT`
  );

  // ==========================================================
  // INITIALIZE SYMBOLS
  // ==========================================================

  for (
    const symbol of symbols
  ) {

    try {

      // ======================================================
      // REFERENCE PRICE
      // ======================================================

      const reference =
        await historical.getReferencePrice(
          symbol
        );

      strategy.setReference(
        symbol,
        reference
      );

      // ======================================================
      // CURRENT PRICE
      // ======================================================

      const price =
        await futures.getPrice(
          symbol
        );

      // ======================================================
      // CHANGE
      // ======================================================

      const change =
        (
          (
            price -
            reference
          ) /
          reference
        ) *
        100;

      // ======================================================
      // SIGNAL
      // ======================================================

      let signal:
        | "LONG"
        | "SHORT"
        | "NO TRADE" =
        "NO TRADE";

      if (
        change <=
        -longDropPercent
      ) {

        signal =
          "LONG";

      } else if (
        change >=
        shortRisePercent
      ) {

        signal =
          "SHORT";
      }

      // ======================================================
      // LOG
      // ======================================================

      log(
        `${symbol} | ` +
        `Price=${price} | ` +
        `${lookbackDays}D=${reference} | ` +
        `Change=${change.toFixed(2)}% | ` +
        `Signal=${signal}`
      );

      // ======================================================
      // INITIAL SIGNAL
      // ======================================================

      if (
        signal === "LONG" ||
        signal === "SHORT"
      ) {

        log(
          `[INITIAL SIGNAL] ${symbol} ${signal} detected`
        );

        await strategy.onPrice(
          symbol,
          price
        );
      }

    } catch (err: any) {

      error(
        `${symbol} initialization failed: ${
          err?.message ??
          err
        }`
      );
    }
  }

  // ==========================================================
  // WEBSOCKET
  // ==========================================================

  const websocket =
    new BinanceWebSocket(

      symbols,

      async (
        symbol,
        price
      ) => {

        try {

          await strategy.onPrice(
            symbol,
            price
          );

        } catch (err: any) {

          error(
            `[WS STRATEGY ERROR] ${symbol}: ${
              err?.message ??
              err
            }`
          );
        }
      }
    );

  // ==========================================================
  // CONNECT
  // ==========================================================

  websocket.connect();

  // ==========================================================
  // SHUTDOWN
  // ==========================================================

  let shuttingDown =
    false;

  const shutdown =
    () => {

      if (
        shuttingDown
      ) {

        return;
      }

      shuttingDown =
        true;

      log(
        "Stopping bot..."
      );

      // ------------------------------------------------------
      // CLOSE WEBSOCKET
      // ------------------------------------------------------

      websocket.close();

      // ------------------------------------------------------
      // CLOSE DATABASE
      // ------------------------------------------------------

      try {

        database.close();

      } catch {
        // Ignore database close errors.
      }

      // ------------------------------------------------------
      // EXIT
      // ------------------------------------------------------

      process.exit(0);
    };

  // ==========================================================
  // CTRL+C
  // ==========================================================

  process.once(
    "SIGINT",
    shutdown
  );

  // ==========================================================
  // SERVER TERMINATION
  // ==========================================================

  process.once(
    "SIGTERM",
    shutdown
  );
}

// ============================================================
// START
// ============================================================

main().catch(
  (err: any) => {

    error(
      `Fatal: ${
        err?.message ??
        err
      }`
    );

    process.exit(1);
  }
);
