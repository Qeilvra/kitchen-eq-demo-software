// OMR amounts are strings at the boundary and integer baisa during calculation.
// PostgreSQL numeric is authoritative; this engine provides identical previews.
export type DecimalInput = string | number | bigint;
const powers = [1n, 10n, 100n, 1000n, 10000n, 100000n, 1000000n];
export function fixed(value: DecimalInput, scale = 3, signed = false): bigint {
  const text = String(value).trim();
  const pattern = signed ? /^(-?)(\d+)(?:\.(\d+))?$/ : /^()(\d+)(?:\.(\d+))?$/;
  const match = pattern.exec(text);
  if (!match || (match[3]?.length ?? 0) > scale || match[2].length > 15) throw new Error(`Enter a valid decimal with at most ${scale} decimal places.`);
  const amount = BigInt(match[2]) * powers[scale] + BigInt((match[3] ?? "").padEnd(scale, "0") || "0");
  return match[1] === "-" ? -amount : amount;
}
export function decimal(value: bigint, scale = 3): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / powers[scale]}${scale ? `.${String(absolute % powers[scale]).padStart(scale, "0")}` : ""}`;
}
export function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Invalid divisor.");
  const sign = numerator < 0n ? -1n : 1n;
  const value = numerator < 0n ? -numerator : numerator;
  return sign * ((value + denominator / 2n) / denominator);
}
export function canonicalDecimal(value: string, scale = 3): string { return decimal(fixed(value, scale), scale); }
export function addMoney(values: DecimalInput[]): string { return decimal(values.reduce<bigint>((sum, value) => sum + fixed(value, 3, true), 0n)); }
export function subtractMoney(left: DecimalInput, right: DecimalInput): string { return decimal(fixed(left, 3, true) - fixed(right, 3, true)); }
export function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = fixed(String(value), 3, true);
  const text = decimal(amount);
  const [whole, fraction] = text.split(".");
  return `OMR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
export type MoneyItem = { quantity: DecimalInput; unit_price: DecimalInput; discount?: DecimalInput; tax?: DecimalInput };
export function calculateLine(item: MoneyItem) {
  const quantity = fixed(item.quantity), price = fixed(item.unit_price);
  const discount = fixed(item.discount ?? "0", 4), tax = fixed(item.tax ?? "0", 4);
  if (quantity <= 0n || discount > 1000000n || tax > 1000000n) throw new Error("Quantity must be positive and percentages must be between 0 and 100.");
  const subtotal = roundedDivide(quantity * price, 1000n);
  const discountAmount = roundedDivide(subtotal * discount, 1000000n);
  const taxable = subtotal - discountAmount;
  const taxAmount = roundedDivide(taxable * tax, 1000000n);
  return { subtotal: decimal(subtotal), discount: decimal(discountAmount), taxable: decimal(taxable), tax: decimal(taxAmount), total: decimal(taxable + taxAmount) };
}
export function calculateTotals(items: MoneyItem[]) {
  const lines = items.map(calculateLine);
  return { subtotal: addMoney(lines.map((line) => line.subtotal)), discount: addMoney(lines.map((line) => line.discount)), taxable: addMoney(lines.map((line) => line.taxable)), tax: addMoney(lines.map((line) => line.tax)), total: addMoney(lines.map((line) => line.total)) };
}
