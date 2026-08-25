export interface SymbolRules {
  symbol: string;
  status: string;
  contractType: string;
  priceTickSize: number;
  contractMultiplier: number;
  contractStepSize: number;
  quantityStepSize: number;
  minQuantity: number;
  minNotional: number;
}

export interface Position {
  id?: number;
  symbol: string;
  side: "LONG" | "SHORT";
  margin: number;
  notional: number;
  quantity: number;
  entryPrice: number;
  takeProfitPrice: number;
  buyOrderId?: string;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  closedAt?: string;
}

export interface Trade {
  id?: number;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  margin: number;
  pnl: number;
  fees: number;
  entryTime: string;
  exitTime: string;
}
