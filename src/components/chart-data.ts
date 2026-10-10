import type { RecordRow } from "@/lib/domain";
import {fixed} from '@/lib/money';

export const chartColors = {
  blue: "#179FE3",
  cyan: "#19BCD0",
  green: "#17A96B",
  amber: "#F2A526",
  red: "#E65353",
  muted: "#8097A1",
};
export type ChartValue = {
  label: string;
  value: number;
  color?: string;
  href?: string;
  detail?: string;
};
export type TrendPoint = { label: string; values: (number | null)[] };
export type TrendSeries = { label: string; color: string; kind?: "bar" | "line"; unit?: string };
export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  status: string;
  href: string;
};

export function statusColor(status: string) {
  if (/Emergency|High|Overdue|Expired|Rejected|Cancelled|Delayed|Out of Service/.test(status))
    return chartColors.red;
  if (/Completed|Resolved|Approved|Available|Active AMC|Warranty|On Schedule/.test(status))
    return chartColors.green;
  if (/Waiting|Pending|Follow-Up|Expiring|On Hold|Busy|Travelling|At Risk/.test(status))
    return chartColors.amber;
  return /Active|Progress|Assigned|On Site|Sent/.test(status) ? chartColors.blue : chartColors.cyan;
}

export function dateKey(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Muscat",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date)
    : "";
}

export function groupValues(
  rows: RecordRow[],
  key: string,
  label: (value: string) => string = (value) => value,
): ChartValue[] {
  const groups = new Map<string, number>();
  rows.forEach((row) => {
    const value = label(String(row[key] ?? "Unspecified"));
    groups.set(value, (groups.get(value) ?? 0) + 1);
  });
  return Array.from(groups, ([name, value]) => ({
    label: name,
    value,
    color: statusColor(name),
  })).sort((a, b) => b.value - a.value);
}

export function datedValues(rows: RecordRow[], key: string, value?: string): TrendPoint[] {
  const groups = new Map<string, bigint>();
  rows.forEach((row) => {
    const date = dateKey(row[key]);
    if (date) groups.set(date, (groups.get(date) ?? 0n) + (value ? fixed(String(row[value]??'0')) : 1000n));
  });
  return Array.from(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      label: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`)),
      // Conversion is confined to chart coordinates; all amount aggregation is exact.
      values: [Number(count) / 1000],
    }));
}

export function expiryValues(rows: RecordRow[], key: string): ChartValue[] {
  const groups = new Map<string, number>();
  rows.forEach((row) => {
    const month = dateKey(row[key]).slice(0, 7);
    if (month) groups.set(month, (groups.get(month) ?? 0) + 1);
  });
  return Array.from(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      label: new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${month}-01T12:00:00Z`)),
      value: count,
      color: month < dateKey(new Date()).slice(0, 7) ? chartColors.red : chartColors.amber,
    }));
}

export function groupedAmounts(rows: RecordRow[], key: string, amount: string): ChartValue[] {
  const groups = new Map<string, bigint>();
  rows.forEach((row) => {
    const label = String(row[key] ?? "Unspecified");
    if (row[amount]!==null&&row[amount]!==undefined)
      groups.set(label, (groups.get(label) ?? 0n) + fixed(String(row[amount])));
  });
  return Array.from(groups, ([label, value]) => ({
    label,
    value: Number(value) / 1000,
    color: statusColor(label),
  })).sort((a, b) => b.value - a.value);
}
