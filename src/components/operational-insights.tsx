import "server-only";
import { supabase } from "@/lib/supabase";
import { canAccess, type Profile, type RecordRow } from "@/lib/domain";
import {addMoney} from '@/lib/money';
import {MoneyBars} from './finance-charts';
import type { Lookup } from "@/lib/data";
import { derivedStatus } from "./records";
import {
  BarChart,
  TrendChart,
  StatusDonut,
  PipelineChart,
  MaintenanceCalendar,
} from "./operations-charts";
import { ChartPanel } from "./operations-ui";
import {
  chartColors,
  statusColor,
  dateKey,
  groupValues,
  datedValues,
  expiryValues,
  type TrendPoint,
} from "./chart-data";

// Read-only UI projections. The existing record queries and workflow handlers remain intact.
export async function quotationPresentation(rows: RecordRow[]) {
  const db=await supabase();
  return Promise.all(rows.map(async row=>{
    if(typeof row.grand_total==='string')return {...row,quotation_amount:row.grand_total};
    const {data,error}=await db.rpc('am_finance_read',{entity:'quotations',target:row.id});
    if(error)throw new Error('Unable to load persisted quotation totals.');
    return {...row,quotation_amount:data?.records?.[0]?.grand_total??null};
  }));
}

export async function assetPresentation(rows: RecordRow[], profile: Profile) {
  if (!canAccess(profile.role, "amc_contracts")) return rows;
  const ids = [...new Set(rows.map((row) => String(row.amc_id ?? "")).filter(Boolean))];
  if (!ids.length) return rows.map((row) => ({ ...row, active_amc: false }));
  const db = await supabase();
  const { data, error } = await db.from("amc_contracts").select("id,status,end_date").in("id", ids);
  if (error) return rows;
  const active = new Set(
    (data ?? [])
      .filter(
        (contract) =>
          ["Active", "Expiring"].includes(contract.status) &&
          contract.end_date >= dateKey(new Date()),
      )
      .map((contract) => contract.id),
  );
  return rows.map((row) => ({ ...row, active_amc: active.has(String(row.amc_id ?? "")) }));
}

export async function overviewSignals(profile: Profile) {
  const db = await supabase();
  const now = new Date();
  const operatingDate = dateKey(now);
  const start = new Date(
    Date.UTC(Number(operatingDate.slice(0, 4)), Number(operatingDate.slice(5, 7)) - 6, 1),
  );
  const periodStart = `${start.toISOString().slice(0, 10)}T00:00:00+04:00`;
  const [customers, team, assets, opened, completed, resolvedToday] = await Promise.all([
    canAccess(profile.role, "customers")
      ? db.from("customers").select("id", { head: true, count: "exact" })
      : Promise.resolve({ count: 0, error: null }),
    canAccess(profile.role, "engineers")
      ? db.from("engineers").select("status", { count: "exact" }).limit(1000)
      : Promise.resolve({ data: [], count: 0, error: null }),
    canAccess(profile.role, "equipment")
      ? db.from("equipment").select("id", { head: true, count: "exact" })
      : Promise.resolve({ count: 0, error: null }),
    canAccess(profile.role, "complaints")
      ? db
          .from("complaints")
          .select("reported_at", { count: "exact" })
          .gte("reported_at", periodStart)
          .lte("reported_at", now.toISOString())
          .order("reported_at", { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [], count: 0, error: null }),
    canAccess(profile.role, "work_orders") && canAccess(profile.role, "complaints")
      ? db
          .from("work_orders")
          .select("completed_at,complaint_id,complaints(reported_at)", { count: "exact" })
          .eq("status", "Completed")
          .not("complaint_id", "is", null)
          .gte("completed_at", periodStart)
          .lte("completed_at", now.toISOString())
          .order("completed_at", { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [], count: 0, error: null }),
    canAccess(profile.role, "work_orders") && canAccess(profile.role, "complaints")
      ? db
          .from("work_orders")
          .select("id", { head: true, count: "exact" })
          .eq("status", "Completed")
          .not("complaint_id", "is", null)
          .gte("completed_at", `${dateKey(now)}T00:00:00+04:00`)
          .lte("completed_at", now.toISOString())
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (
    customers.error ||
    team.error ||
    assets.error ||
    opened.error ||
    completed.error ||
    resolvedToday.error
  )
    throw new Error("Unable to load operational summaries.");
  const jobs = (completed.data ?? []) as unknown as {
    completed_at: string;
    complaints: { reported_at: string } | null;
  }[];
  const points: TrendPoint[] = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const month = date.toISOString().slice(0, 7);
    const resolved = jobs.filter((job) => dateKey(job.completed_at).startsWith(month));
    const hours = resolved
      .filter(
        (job) =>
          job.complaints?.reported_at &&
          new Date(job.completed_at).getTime() >= new Date(job.complaints.reported_at).getTime(),
      )
      .map(
        (job) =>
          (new Date(job.completed_at).getTime() - new Date(job.complaints!.reported_at).getTime()) /
          3600000,
      );
    return {
      label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date),
      values: [
        (opened.data ?? []).filter((row) => dateKey(row.reported_at).startsWith(month)).length,
        resolved.length,
        hours.length
          ? Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10
          : null,
      ],
    };
  });
  return {
    customers: customers.count ?? 0,
    assets: assets.count ?? 0,
    resolvedToday: resolvedToday.count ?? 0,
    engineerStatuses: (team.data ?? []) as { status: string }[],
    teamLimited: (team.count ?? 0) > 1000,
    trend: points,
    limited: (opened.count ?? 0) > 1000 || (completed.count ?? 0) > 1000,
  };
}

export async function maintenanceView() {
  const db = await supabase();
  const today = dateKey(new Date());
  const start = `${today.slice(0, 7)}-01`;
  const end = new Date(`${start}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const [{ data, count, error }, due, overdue] = await Promise.all([
    db
      .from("pm_schedules")
      .select("id,name,status,planned_date", { count: "exact" })
      .not("status", "in", "(Completed)")
      .order("planned_date")
      .limit(1000),
    db
      .from("pm_schedules")
      .select("id", { head: true, count: "exact" })
      .not("status", "in", "(Completed)")
      .gte("planned_date", start)
      .lt("planned_date", end.toISOString().slice(0, 10)),
    db
      .from("pm_schedules")
      .select("id", { head: true, count: "exact" })
      .not("status", "in", "(Completed)")
      .lt("planned_date", today),
  ]);
  if (error || due.error || overdue.error)
    throw new Error("Unable to load the maintenance calendar.");
  return {
    due: due.count ?? 0,
    overdue: overdue.count ?? 0,
    count: count ?? 0,
    events: (data ?? []).map((row) => ({
      id: row.id,
      date: row.planned_date,
      title: row.name,
      status:
        row.status === "Assigned"
          ? "Assigned"
          : row.planned_date < today
            ? "Overdue"
            : row.planned_date === today
              ? "Due"
              : row.status,
      href: `/pm_schedules/${row.id}`,
    })),
  };
}

export function ServiceTrendPanel({
  signals,
}: {
  signals: Awaited<ReturnType<typeof overviewSignals>>;
}) {
  return (
    <ChartPanel
      title="Service activity"
      question="How do opened and resolved cases compare over time?"
      scope="Workspace Â· last 6 months"
    >
      <TrendChart
        data={signals.trend}
        series={[
          { label: "New cases", color: chartColors.blue, kind: "bar" },
          { label: "Resolved cases", color: chartColors.green, kind: "bar" },
          { label: "Avg. resolution", color: chartColors.amber, kind: "line", unit: "hrs" },
        ]}
      />
      <p className="chart-footnote">
        Resolution time runs from case reporting to completion of the linked work order.
        {signals.limited ? " Latest 1,000 records in the period." : ""}
      </p>
    </ChartPanel>
  );
}

export function ModuleInsights({
  entity,
  rows,
  lookup,
  maintenance,
}: {
  entity: string;
  rows: RecordRow[];
  lookup: Lookup;
  maintenance?: Awaited<ReturnType<typeof maintenanceView>>;
}) {
  const scope = `${rows.length} records on this page`;
  if (entity === "customers") return null;
  if (entity === "enquiries") {
    const points = datedValues(rows, "received_date");
    return (
      <ChartPanel
        title={points.length > 2 ? "Enquiry trend" : "Enquiry categories"}
        question={
          points.length > 2
            ? "When are customer requests arriving?"
            : "What are customers asking for?"
        }
        scope={scope}
      >
        {points.length > 2 ? (
          <TrendChart
            data={points}
            series={[{ label: "Enquiries received", color: chartColors.cyan }]}
          />
        ) : (
          <BarChart data={groupValues(rows, "category")} unit="enquiries" />
        )}
      </ChartPanel>
    );
  }
  if (entity === "quotations") {
    const amounts=new Map<string,string[]>();for(const row of rows){const status=row.status;amounts.set(status,[...(amounts.get(status)??[]),String(row.quotation_amount??row.grand_total??'0')]);}
    return <MoneyBars title="Quotation value by stage" description="Persisted values including tax Â· current page / filter" values={[...amounts].map(([label,values])=>({label,value:addMoney(values)}))}/>;
  }
  if (entity === "projects") {
    const today = dateKey(new Date());
    const categories = ["On schedule", "At risk", "Delayed", "Completed", "No target date"];
    const values = categories.map((label) => ({
      label,
      value: 0,
      color:
        label === "Completed" || label === "On schedule"
          ? chartColors.green
          : label === "Delayed"
            ? chartColors.red
            : chartColors.amber,
    }));
    rows.forEach((row) => {
      if (row.status === "Cancelled") return;
      const date = String(row.target_date ?? "");
      const label =
        row.status === "Completed"
          ? "Completed"
          : date && date < today
            ? "Delayed"
            : row.status === "On Hold"
              ? "At risk"
              : date
                ? "On schedule"
                : "No target date";
      values[categories.indexOf(label)].value++;
    });
    return (
      <ChartPanel
        title="Project delivery"
        question="Which projects are on track or need attention?"
        scope={scope}
      >
        <BarChart data={values} unit="projects" />
        <p className="chart-footnote">
          At risk: on hold. Delayed: target date has passed. Progress remains visible in the
          register.
        </p>
      </ChartPanel>
    );
  }
  if (entity === "complaints") {
    const open = rows.filter((row) => !["Resolved", "Closed"].includes(row.status));
    return (
      <ChartPanel
        title="Live case status"
        question="Where do open service cases stand?"
        scope={scope}
      >
        <StatusDonut data={groupValues(open, "status")} label="Open cases" />
      </ChartPanel>
    );
  }
  if (entity === "equipment") {
    const hasCoverage = rows.every((row) => typeof row.active_amc === "boolean");
    const today = dateKey(new Date());
    const coverage = [
      { label: "Under warranty", value: 0, color: chartColors.green },
      { label: hasCoverage ? "Active AMC" : "AMC linked", value: 0, color: chartColors.cyan },
      {
        label: hasCoverage ? "No active coverage" : "No coverage linked",
        value: 0,
        color: chartColors.amber,
      },
    ];
    rows.forEach(
      (row) =>
        coverage[
          row.warranty_end &&
          String(row.warranty_end) >= today &&
          (!row.warranty_start || String(row.warranty_start) <= today)
            ? 0
            : hasCoverage
              ? row.active_amc
                ? 1
                : 2
              : row.amc_id
                ? 1
                : 2
        ].value++,
    );
    return (
      <>
        <ChartPanel
          title="Asset coverage"
          question="Which assets have warranty or linked AMC coverage?"
          scope={scope}
        >
          <StatusDonut data={coverage} label="Assets" />
        </ChartPanel>
        <ChartPanel
          title="Planned asset maintenance"
          question="Which months have the most scheduled service dates?"
          scope={scope}
        >
          <BarChart data={expiryValues(rows, "next_service")} unit="assets" />
        </ChartPanel>
      </>
    );
  }
  if (entity === "engineers")
    return (
      <ChartPanel
        title="Engineer workload"
        question="How many active jobs are assigned to each engineer?"
        scope={scope}
      >
        <BarChart
          data={rows.map((row) => ({
            label: row.name,
            value: Number(row.assigned_jobs ?? 0),
            color: statusColor(row.status),
            href: `/engineers/${row.id}`,
            detail: row.status,
          }))}
          unit="active jobs"
        />
      </ChartPanel>
    );
  if (entity === "work_orders") {
    const groups = new Map<string, [number, number]>();
    rows.forEach((row) => {
      const date = dateKey(row.scheduled_at).slice(0, 7);
      if (!date || row.status === "Cancelled") return;
      const current = groups.get(date) ?? [0, 0];
      current[0]++;
      if (row.status === "Completed") current[1]++;
      groups.set(date, current);
    });
    return (
      <ChartPanel
        title="Work order completion"
        question="How many scheduled jobs have been completed?"
        scope={scope}
      >
        <TrendChart
          data={Array.from(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, values]) => ({
              label: new Intl.DateTimeFormat("en-GB", {
                month: "short",
                year: "2-digit",
                timeZone: "UTC",
              }).format(new Date(`${month}-01T12:00:00Z`)),
              values,
            }))}
          series={[
            { label: "Scheduled", color: chartColors.blue, kind: "bar" },
            { label: "Completed", color: chartColors.green, kind: "bar" },
          ]}
        />
      </ChartPanel>
    );
  }
  if (["amc_contracts", "pm_schedules"].includes(entity))
    return (
      <ChartPanel
        title="Preventive maintenance calendar"
        question="When are the next customer visits planned?"
        scope={
          maintenance
            ? `${maintenance.count} workspace visits${maintenance.count > 1000 ? " Â· earliest 1,000 shown" : ""}`
            : scope
        }
      >
        <MaintenanceCalendar
          events={
            maintenance?.events ??
            rows
              .filter((row) => row[entity === "amc_contracts" ? "next_visit" : "planned_date"])
              .map((row) => ({
                id: row.id,
                date: String(row[entity === "amc_contracts" ? "next_visit" : "planned_date"]),
                title: row.name,
                status: derivedStatus(entity, row),
                href: `/${entity}/${row.id}`,
              }))
          }
        />
      </ChartPanel>
    );
  void lookup;
  return null;
}

export function ReportVisualization({
  report,
  entity,
  rows,
  lookup,
}: {
  report: string;
  entity: string;
  rows: RecordRow[];
  lookup: Lookup;
}) {
  const scope = `${rows.length} records on this page`;
  if (report === "pipeline")
    return (
      <ChartPanel
        title="Quotation pipeline"
        question="How are commercial records distributed across stages?"
        scope={scope}
      >
        <PipelineChart
          stages={["Draft", "Ready", "Sent", "Follow-Up", "Approved", "Rejected", "Expired"]
            .map((status) => ({
              label: status,
              value: rows.filter((row) => row.status === status).length,
              color: statusColor(status),
            }))
            .filter((stage) => stage.value > 0)}
        />
      </ChartPanel>
    );
  if (report === "active-projects")
    return (
      <ChartPanel
        title="Project delivery status"
        question="How are the selected projects progressing?"
        scope={scope}
      >
        <BarChart
          data={rows.map((row) => ({
            label: row.name,
            value: Number(row.progress ?? 0),
            color: statusColor(row.status),
            href: `/projects/${row.id}`,
          }))}
          percent
        />
      </ChartPanel>
    );
  if (report === "complaints")
    return <ModuleInsights entity="complaints" rows={rows} lookup={lookup} />;
  if (report === "workload") {
    const groups = groupValues(
      rows,
      "engineer_id",
      (id) =>
        lookup.engineers?.find((engineer) => engineer.id === id)?.name ??
        (id === "Unspecified" || id === "" ? "Unassigned" : "Assigned engineer"),
    );
    return (
      <ChartPanel
        title="Engineer workload"
        question="Who has the largest active assignment queue?"
        scope={scope}
      >
        <BarChart data={groups} unit="active jobs" />
      </ChartPanel>
    );
  }
  if (report === "completion" || report === "history" || report === "asset-history")
    return (
      <ChartPanel
        title="Completed service visits"
        question="When was service work completed?"
        scope={scope}
      >
        <TrendChart
          data={datedValues(rows, "visit_date")}
          series={[{ label: "Completed visits", color: chartColors.green, kind: "line" }]}
        />
      </ChartPanel>
    );
  if (report === "amc" || report === "warranty")
    return (
      <ChartPanel
        title={report === "amc" ? "Contract expiry by month" : "Warranty expiry by month"}
        question="Which renewal months need attention?"
        scope={scope}
      >
        <BarChart
          data={expiryValues(rows, report === "amc" ? "end_date" : "warranty_end")}
          unit={report === "amc" ? "contracts" : "assets"}
        />
      </ChartPanel>
    );
  if (report === "pm") return <ModuleInsights entity="pm_schedules" rows={rows} lookup={lookup} />;
  return <ModuleInsights entity={entity} rows={rows} lookup={lookup} />;
}
