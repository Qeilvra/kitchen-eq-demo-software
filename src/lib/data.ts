import "server-only";
import { supabase } from "./supabase";
import { authorize } from "./auth";
import { catalog, fieldsFor, getEntity } from "./catalog";
import type { RecordRow } from "./domain";
export type Lookup = Record<
  string,
  {
    id: string;
    name: string;
    code: string;
    customer_id?: string;
    site_id?: string;
    status?: string;
  }[]
>;
export async function listRecords(
  entity: string,
  options: {
    q?: string;
    status?: string;
    page?: number;
    foreign?: string;
    parent?: string;
    limit?: number;
  } = {},
) {
  getEntity(entity);
  await authorize(entity);
  const db = await supabase();
  const size = options.limit ?? 20;
  const page = Math.max(1, options.page ?? 1);
  if (entity === "notifications") await db.rpc("am_sync_notifications");
  let query = db
    .from(entity)
    .select(fieldsFor(entity), { count: "exact" })
    .order("created_at", { ascending: false });
  if (options.q) {
    const q = options.q
      .replace(/[%_,().\\]/g, " ")
      .trim()
      .slice(0, 100);
    if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
  }
  if (options.status) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Muscat",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const cutoff = new Date(`${today}T12:00:00Z`);
    cutoff.setDate(cutoff.getDate() + 30);
    if (entity === "amc_contracts" && options.status === "Expiring")
      query = query
        .in("status", ["Active", "Expiring"])
        .gte("end_date", today)
        .lte("end_date", cutoff.toISOString().slice(0, 10));
    else if (entity === "amc_contracts" && options.status === "Expired")
      query = query.in("status", ["Active", "Expiring", "Expired"]).lt("end_date", today);
    else if (entity === "pm_schedules" && ["Due", "Overdue", "Upcoming"].includes(options.status)) {
      query = query.not("status", "in", "(Completed,Assigned)");
      query =
        options.status === "Due"
          ? query.eq("planned_date", today)
          : options.status === "Overdue"
            ? query.lt("planned_date", today)
            : query.gt("planned_date", today);
    } else query = query.eq("status", options.status);
  }
  if (options.foreign && options.parent) {
    const valid = [
      ...getEntity(entity).fields.map((f) => f.key),
      "customer_id",
      "equipment_id",
      "work_order_id",
    ];
    if (!valid.includes(options.foreign)) throw new Error("Invalid record filter.");
    query = query.eq(options.foreign, options.parent);
  }
  const { data, error, count } = await query.range((page - 1) * size, page * size - 1);
  if (error)
    throw new Error(
      "Unable to load workspace records. Confirm the database migrations have been applied.",
    );
  const records = (data ?? []) as unknown as RecordRow[];
  if (["customers", "sites", "engineers"].includes(entity) && records.length) {
    const { data: metrics, error: metricError } = await db.rpc(
      entity === "customers"
        ? "am_customer_metrics"
        : entity === "sites"
          ? "am_site_metrics"
          : "am_engineer_metrics",
      { targets: records.map((row) => row.id) },
    );
    if (metricError) throw new Error("Unable to load connected record summaries.");
    for (const row of records) {
      const metric = (metrics ?? []).find((m: { id: string }) => m.id === row.id);
      if (metric) Object.assign(row, metric);
    }
  }
  return { records, count: count ?? 0, page, size };
}
export async function getRecord(entity: string, id: string) {
  getEntity(entity);
  await authorize(entity);
  const db = await supabase();
  const { data, error } = await db
    .from(entity)
    .select(fieldsFor(entity))
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load this record.");
  return data as unknown as RecordRow | null;
}
export async function lookups(refs: string[], ids?: Record<string, string[]>): Promise<Lookup> {
  const db = await supabase();
  const result: Lookup = {};
  await Promise.all(
    [...new Set(refs)].map(async (ref) => {
      if (ref === "engineers") {
        const { data, error } = await db.rpc("am_engineer_options", {
          targets: ids?.engineers?.length ? [...new Set(ids.engineers)] : null,
        });
        if (!error) result.engineers = data ?? [];
        return;
      }
      const fields =
        ref === "profiles"
          ? "id,full_name"
          : `id,name,code,status${catalog[ref]?.fields.some((f) => f.key === "customer_id") ? ",customer_id" : ""}${catalog[ref]?.fields.some((f) => f.key === "site_id") ? ",site_id" : ""}`;
      let query = db.from(ref).select(fields).limit(200);
      if (ids?.[ref]?.length) query = query.in("id", [...new Set(ids[ref])]);
      const { data, error } = await query;
      if (error) return;
      result[ref] = (data ?? []).map((row) => {
        const value = row as unknown as {
          id: string;
          full_name?: string;
          name: string;
          code: string;
        };
        return { ...value, name: value.name ?? value.full_name ?? "", code: value.code ?? "" };
      });
    }),
  );
  return result;
}
export async function recordLookups(entity: string, rows: RecordRow[]) {
  const fields = getEntity(entity).fields.filter((f) => f.ref);
  const ids: Record<string, string[]> = {};
  fields.forEach((f) => {
    ids[f.ref!] = [
      ...(ids[f.ref!] ?? []),
      ...rows.map((row) => String(row[f.key] ?? "")).filter(Boolean),
    ];
  });
  return lookups(
    Object.keys(ids).filter((key) => ids[key].length),
    ids,
  );
}
