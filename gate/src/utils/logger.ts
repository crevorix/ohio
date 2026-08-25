function prefix(): string {
  return `[${new Date().toISOString()}]`;
}

export function log(message: string): void {
  console.log(`${prefix()} ${message}`);
}

export function warn(message: string): void {
  console.warn(`${prefix()} WARNING: ${message}`);
}

export function error(message: string): void {
  console.error(`${prefix()} ERROR: ${message}`);
}