import { BotDatabase } from "../database/database";

import { Position } from "../types";

// ============================================================
// POSITION MANAGER
// ============================================================

export class PositionManager {

  // ==========================================================
  // CONSTRUCTOR
  // ==========================================================

  constructor(
    private readonly database: BotDatabase
  ) {}

  // ==========================================================
  // GET POSITION
  // ==========================================================

  getPosition(
    symbol: string
  ) {

    return this.database.getOpenPosition(
      symbol
    );
  }

  // ==========================================================
  // HAS POSITION
  // ==========================================================

  hasPosition(
    symbol: string
  ): boolean {

    return Boolean(
      this.getPosition(symbol)
    );
  }

  // ==========================================================
  // GET OPEN POSITIONS
  // ==========================================================

  getOpenPositions() {

    return this.database.getOpenPositions();
  }

  // ==========================================================
  // CREATE POSITION
  // ==========================================================

  createPosition(
    position: Position
  ) {

    console.log(
      `[POSITION] OPEN ${position.symbol} | ` +
      `side=${position.side} | ` +
      `entry=${position.entryPrice} | ` +
      `qty=${position.quantity} | ` +
      `TP=${position.takeProfitPrice}`
    );

    return this.database.createPosition(
      position
    );
  }

  // ==========================================================
  // CLOSE POSITION
  // ==========================================================

  closePosition(
    symbol: string,
    exitPrice: number,
    pnl: number,
    fees = 0
  ) {

    console.log(
      `[POSITION] CLOSE ${symbol} | ` +
      `exit=${exitPrice} | ` +
      `PnL=${pnl} | ` +
      `fees=${fees}`
    );

    return this.database.closePosition(
      symbol,
      exitPrice,
      pnl,
      fees
    );
  }
}