import Database from "better-sqlite3";
import { Position } from "../types";
export declare class BotDatabase {
    private readonly db;
    constructor(path?: string);
    private initialize;
    private migratePositionsTable;
    getOpenPosition(symbol: string): Position | undefined;
    getOpenPositions(): Position[];
    createPosition(position: Position): Database.RunResult;
    closePosition(symbol: string, exitPrice: number, pnl: number, fees?: number): void;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map