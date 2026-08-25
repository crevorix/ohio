"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionManager = void 0;
// ============================================================
// POSITION MANAGER
// ============================================================
class PositionManager {
    database;
    // ==========================================================
    // CONSTRUCTOR
    // ==========================================================
    constructor(database) {
        this.database = database;
    }
    // ==========================================================
    // GET POSITION
    // ==========================================================
    getPosition(symbol) {
        return this.database.getOpenPosition(symbol);
    }
    // ==========================================================
    // HAS POSITION
    // ==========================================================
    hasPosition(symbol) {
        return Boolean(this.getPosition(symbol));
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
    createPosition(position) {
        console.log(`[POSITION] OPEN ${position.symbol} | ` +
            `side=${position.side} | ` +
            `entry=${position.entryPrice} | ` +
            `qty=${position.quantity} | ` +
            `TP=${position.takeProfitPrice}`);
        return this.database.createPosition(position);
    }
    // ==========================================================
    // CLOSE POSITION
    // ==========================================================
    closePosition(symbol, exitPrice, pnl, fees = 0) {
        console.log(`[POSITION] CLOSE ${symbol} | ` +
            `exit=${exitPrice} | ` +
            `PnL=${pnl} | ` +
            `fees=${fees}`);
        return this.database.closePosition(symbol, exitPrice, pnl, fees);
    }
}
exports.PositionManager = PositionManager;
//# sourceMappingURL=positionManager.js.map