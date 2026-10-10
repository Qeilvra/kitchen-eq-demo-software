import { columnLabels } from "@/lib/company";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  ArrowRight,
  Inbox,
  House,
  ChevronRight as BreadcrumbChevron,
  Users,
} from "lucide-react";
import { getEntity } from "@/lib/catalog";
import type { RecordRow } from "@/lib/domain";
import type { Lookup } from "@/lib/data";
import { recordLayouts, type RecordColumn } from "./record-layout";
import { FilterSheet } from "./ui";
import {moneyKeys} from '@/lib/finance-catalog';
import {formatMoney} from '@/lib/money';
export function Badge({ value }: { value: string | number | boolean | null | undefined }) {
  const text = String(value ?? "—");
  const style = /Emergency|High|Overdue|Expired|Rejected|Cancelled|Out of Service/.test(text)
    ? "danger"
    : /Completed|Resolved|Active|Approved|Available|Warranty|Covered/.test(text)
      ? "success"
      : /Pending|Waiting|Sent|Due|Expiring|Follow-Up|Leave|Busy|Travelling/.test(text)
        ? "warning"
        : /Progress|Assigned|On Site|New/.test(text)
          ? "info"
          : "neutral";
  return (
    <span className={`badge ${style}`}>
      <span />
      {text}
    </span>
  );
}
export function formatDate(value: unknown, withTime = false) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Muscat",
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : { year: "numeric" }),
  }).format(date);
}
export function display(entity: string, key: string, row: RecordRow, lookup: Lookup) {
  const field = getEntity(entity).fields.find((f) => f.key === key);
  const value = row[key];
  if(moneyKeys.has(key)) return <span className="money-value">{formatMoney(value)}</span>;
  if (key === "engineer_id" && !field?.ref) {
    const engineer = lookup.engineers?.find((record) => record.id === value);
    return engineer ? (
      <Link className="reference-link" href={`/engineers/${engineer.id}`}>
        {engineer.name}
      </Link>
    ) : (
      <span>{value ? "Assigned" : "Unassigned"}</span>
    );
  }
  if (key === "type") return <span className="type-chip">{String(value ?? "—")}</span>;
  if (field?.ref) {
    const reference = lookup[field.ref]?.find((r) => r.id === value);
    return reference ? (
      <Link
        className="reference-link"
        href={field.ref === "profiles" ? "/settings" : `/${field.ref}/${reference.id}`}
      >
        {reference.name}
      </Link>
    ) : (
      "—"
    );
  }
  if (field?.type === "date" || field?.type === "datetime-local" || key.endsWith("_at"))
    return formatDate(value, field?.type === "datetime-local");
  if (key === "priority" || key === "classification") return <Badge value={value} />;
  if (key === "progress")
    return (
      <div className="progress-inline">
        <div>
          <i style={{ width: `${Number(value ?? 0)}%` }} />
        </div>
        <span>{value ?? 0}%</span>
      </div>
    );
  return String(value ?? "—");
}
export function RecordTable({
  entity,
  rows,
  lookup = {},
  compact = false,
}: {
  entity: string;
  rows: RecordRow[];
  lookup?: Lookup;
  compact?: boolean;
}) {
  const meta = getEntity(entity);
  if (!rows.length)
    return (
      <Empty
        title="No records here yet"
        detail="Add a record or adjust your filters to get started."
      />
    );
  const label = (key: string) =>
    (
      ({ engineer_id: "Engineer", quotation_amount: "Amount", mime_type: "File type" }) as Record<
        string,
        string
      >
    )[key] ??
    columnLabels[key] ??
    meta.fields.find((field) => field.key === key)?.label ??
    key.replaceAll("_", " ");
  const layout =
    recordLayouts[entity] ?? meta.columns.map((key) => ({ label: label(key), keys: [key] }));
  const columns = compact ? layout.slice(0, 2) : layout;
  const mobileKeys = columns.map(column => column.keys[0]).filter(key => entity !== "invoices" || key !== "source_type").slice(0, 5);
  const plainValue = (key: string, row: RecordRow) => {
    const field = meta.fields.find((field) => field.key === key);
    const value = row[key];
    if(moneyKeys.has(key))return formatMoney(value);
    if (field?.ref) return lookup[field.ref]?.find((record) => record.id === value)?.name ?? "—";
    if (key === "engineer_id")
      return (
        lookup.engineers?.find((record) => record.id === value)?.name ??
        (value ? "Assigned" : "Unassigned")
      );
    if (field?.type === "date" || field?.type === "datetime-local" || key.endsWith("_at"))
      return formatDate(value, field?.type === "datetime-local");
    if (key === "progress") return `${value ?? 0}%`;
    return String(value ?? "—");
  };
  const cell = (column: RecordColumn, row: RecordRow) => (
    <div className="record-cell">
      {column.keys.map((key, index) => (
        <div key={key} className={index ? "cell-secondary" : "cell-primary"}>
          {(key.endsWith("_count") ||
            ["active_projects", "open_complaints", "valid_until"].includes(key)) &&
          column.keys.length > 1 ? (
            <span className="cell-label">{label(key)}: </span>
          ) : null}
          {display(entity, key, row, lookup)}
        </div>
      ))}
    </div>
  );
  return (
    <>
      <div className={`table-wrap record-table record-table-${entity}`}>
        <table aria-label={`${meta.label} records`}>
          <thead>
            <tr>
              <th>{meta.singular}</th>
              {columns.map((column) => (
                <th key={column.label} scope="col">
                  {column.label}
                </th>
              ))}
              <th>Status</th>
              <th className="table-arrow">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link className="record-title" href={`/${entity}/${row.id}`}>
                    <strong>{row.name}</strong>
                    <span className="record-code">{row.code}</span>
                  </Link>
                </td>
                {columns.map((column) => (
                  <td key={column.label}>{cell(column, row)}</td>
                ))}
                <td>
                  <Badge value={derivedStatus(entity, row)} />
                </td>
                <td>
                  <Link
                    href={`/${entity}/${row.id}`}
                    className="icon-button"
                    aria-label={`Open ${row.name}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-record-list">
        {rows.map((row) => (
          <Link
            key={row.id}
            className={`mobile-record mobile-record-${entity}`}
            href={`/${entity}/${row.id}`}
          >
            <div className="record-card-top">
              {entity === "customers" && (
                <span className="customer-card-icon">
                  <Users size={23} />
                </span>
              )}
              <div className="record-card-heading">
                <h3>{row.name}</h3>
                <span className="record-code">{row.code}</span>
              </div>
              <Badge value={derivedStatus(entity, row)} />
            </div>
            <dl className="mobile-record-context">
              {(entity === "customers"
                ? ["type", "primary_contact", "sites_count", "equipment_count", "open_complaints"]
                : mobileKeys
              ).map((key) => (
                <div key={key}>
                  <dt>{label(key)}</dt>
                  <dd>
                    {["priority", "classification"].includes(key) ? (
                      <Badge value={row[key]} />
                    ) : (
                      plainValue(key, row)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="record-card-footer">
              <span>View {meta.singular.toLowerCase()}</span>
              <ArrowRight size={18} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
export function derivedStatus(entity: string, row: RecordRow) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Muscat",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (entity === "amc_contracts" && ["Active", "Expiring"].includes(row.status)) {
    if (String(row.end_date) < today) return "Expired";
    if (new Date(String(row.end_date)).getTime() - new Date(today).getTime() <= 30 * 86400000)
      return "Expiring";
  }
  if (entity === "pm_schedules" && !["Completed", "Assigned"].includes(row.status)) {
    if (String(row.planned_date) < today) return "Overdue";
    if (row.planned_date === today) return "Due";
  }
  return row.status;
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Notice({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`notice ${error ? "notice-error" : "notice-success"}`}
    >
      {error || success}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  module,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  module?: string;
}) {
  return (
    <div className={`page-header${module ? ` module-header module-header-${module}` : ""}`}>
      <div>
        <div className="page-context">
          <Link href="/dashboard" aria-label="Overview">
            <House size={16} />
          </Link>
          <BreadcrumbChevron size={14} />
          <span>{eyebrow ?? "Operations"}</span>
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  );
}
export function AddLink({
  entity,
  parent,
  foreign,
  label,
}: {
  entity: string;
  parent?: string;
  foreign?: string;
  label?: string;
}) {
  return (
    <Link
      className="button"
      href={`/${entity}/new${parent && foreign ? `?${foreign}=${parent}` : ""}`}
    >
      <Plus size={15} />
      {label ?? `New ${getEntity(entity).singular.toLowerCase()}`}
    </Link>
  );
}
export function Pagination({
  entity,
  page,
  count,
  size,
  query,
}: {
  entity: string;
  page: number;
  count: number;
  size: number;
  query: Record<string, string>;
}) {
  const url = (p: number) => `/${entity}?${new URLSearchParams({ ...query, page: String(p) })}`;
  return (
    <div className="pagination">
      <span>
        {count
          ? `${(page - 1) * size + 1}–${Math.min(page * size, count)} of ${count} records`
          : "0 records"}
      </span>
      <div>
        {page > 1 ? (
          <Link className="button secondary small" href={url(page - 1)}>
            <ChevronLeft size={14} />
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span>Page {page}</span>
        {page * size < count && (
          <Link className="button secondary small" href={url(page + 1)}>
            Next
            <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
export function Filters({
  entity,
  q,
  status,
  foreign,
  parent,
}: {
  entity: string;
  q?: string;
  status?: string;
  foreign?: string;
  parent?: string;
}) {
  const meta = getEntity(entity);
  return (
    <form className="filters" action={`/${entity}`}>
      {foreign && parent && (
        <>
          <input type="hidden" name="foreign" value={foreign} />
          <input type="hidden" name="parent" value={parent} />
        </>
      )}
      <label className="list-search">
        <Search size={16} />
        <input
          name="q"
          placeholder={`Search ${meta.label.toLowerCase()}…`}
          defaultValue={q}
          aria-label={`Search ${meta.label}`}
        />
      </label>
      <FilterSheet>
        <select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="">All statuses</option>
          {meta.statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="button secondary small">
          Apply filters
        </button>
        {(q || status) && (
          <Link
            href={`/${entity}${foreign && parent ? `?${new URLSearchParams({ foreign, parent })}` : ""}`}
            className="text-link"
          >
            Clear
          </Link>
        )}
      </FilterSheet>
    </form>
  );
}
