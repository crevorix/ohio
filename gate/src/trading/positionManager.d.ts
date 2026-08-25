import { BotDatabase } from "../database/database";
import { Position } from "../types";
export declare class PositionManager {
    private readonly database;
    constructor(database: BotDatabase);
    getPosition(symbol: string): Position | undefined;
    hasPosition(symbol: string): boolean;
    getOpenPositions(): Position[];
    createPosition(position: Position): import("better-sqlite3").RunResult;
    closePosition(symbol: string, exitPrice: number, pnl: number, fees?: number): void;
}
//# sourceMappingURL=positionManager.d.ts.map