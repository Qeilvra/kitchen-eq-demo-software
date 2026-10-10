import {
  Users,
  FileText,
  Wrench,
  BriefcaseBusiness,
  MessageSquare,
  CalendarClock,
  ShieldCheck,
  AirVent,
  UserRound,
  ListChecks,
  CircleCheck,
  Clock3,
  TriangleAlert,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { RecordRow } from "@/lib/domain";
import { derivedStatus } from "./records";
import { dateKey } from "./chart-data";

type Metric = { label: string; value: number; context: string; icon: LucideIcon; tone?: string };

export function MetricCard({ label, value, context, icon: Icon, tone = "teal" }: Metric) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <span className="metric-icon">
        <Icon size={24} strokeWidth={1.8} />
      </span>
      <div className="metric-content">
        <h3>{label}</h3>
        <strong>{value.toLocaleString()}</strong>
        <p>{context}</p>
      </div>
    </article>
  );
}

export function StatsStrip({ metrics, label = "Summary" }: { metrics: Metric[]; label?: string }) {
  return (
    <section className="stats-strip" aria-label={label}>
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </section>
  );
}

// Summaries use only records already loaded by the page. No additional data queries.
export function ModuleSummary({
  entity,
  rows,
  count,
  filtered,
  maintenance,
  resolvedToday,
}: {
  entity: string;
  rows: RecordRow[];
  count: number;
  filtered: boolean;
  maintenance?: { due: number; overdue: number };
  resolvedToday?: number;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Muscat",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  const soon = cutoff.toISOString().slice(0, 10);
  const statusCount = (...statuses: string[]) =>
    rows.filter((row) => statuses.includes(derivedStatus(entity, row))).length;
  const sum = (key: string) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const due = (key: string) =>
    rows.filter(
      (row) =>
        row[key] &&
        String(row[key]).slice(0, 10) <= today &&
        !["Completed", "Cancelled", "Closed", "Lost", "Won", "Rejected", "Expired"].includes(
          row.status,
        ),
    ).length;
  const upcoming = (key: string) =>
    rows.filter(
      (row) =>
        row[key] &&
        String(row[key]).slice(0, 10) >= today &&
        String(row[key]).slice(0, 10) <= soon &&
        !["Completed", "Cancelled", "Rejected", "Expired"].includes(row.status) &&
        !(key === "valid_until" && row.status === "Approved"),
    ).length;
  const current = "On this page";
  const metric = (
    label: string,
    value: number,
    icon: LucideIcon,
    tone = "teal",
    context = current,
  ): Metric => ({ label, value, icon, tone, context });
  const summaries: Record<string, Metric[]> = {
    customers: [
      metric(
        filtered ? "Matching customers" : "Total customers",
        count,
        Users,
        "blue",
        "Across matching records",
      ),
      metric(
        "Active contracts",
        sum("amc_count"),
        FileText,
        "green",
        "Linked to customers on this page",
      ),
      metric(
        "Open service cases",
        sum("open_complaints"),
        Wrench,
        "amber",
        "For customers on this page",
      ),
      metric(
        "Active projects",
        sum("active_projects"),
        BriefcaseBusiness,
        "blue",
        "For customers on this page",
      ),
    ],
    enquiries: [
      metric(
        "Open enquiries",
        rows.filter((row) => !["Won", "Lost", "Closed"].includes(row.status)).length,
        MessageSquare,
        "blue",
      ),
      metric("Follow-ups due", due("followup_date"), CalendarClock, "amber"),
      metric(
        "High priority",
        rows.filter((row) => ["High", "Emergency"].includes(String(row.priority))).length,
        TriangleAlert,
        "red",
      ),
      metric("Won opportunities", statusCount("Won"), CircleCheck, "green"),
    ],
    quotations: [
      metric("Draft", statusCount("Draft"), FileText, "blue"),
      metric("Sent", statusCount("Sent"), Send),
      metric("Follow-up", statusCount("Follow-Up"), CalendarClock, "amber"),
      metric("Approved", statusCount("Approved"), CircleCheck, "green"),
      metric(
        "Expiring soon",
        upcoming("valid_until"),
        Clock3,
        "amber",
        "Within 30 days · on this page",
      ),
    ],
    projects: [
      metric("Active projects", statusCount("Active"), BriefcaseBusiness, "blue"),
      metric(
        "On schedule",
        rows.filter(
          (row) =>
            row.target_date &&
            String(row.target_date) >= today &&
            !["Completed", "Cancelled", "On Hold"].includes(row.status),
        ).length,
        Clock3,
        "green",
      ),
      metric(
        "At risk",
        rows.filter(
          (row) =>
            !["Completed", "Cancelled"].includes(row.status) &&
            (row.status === "On Hold" || (row.target_date && String(row.target_date) < today)),
        ).length,
        CalendarClock,
        "amber",
        "On hold or past target · this page",
      ),
      metric("Completed", statusCount("Completed"), CircleCheck, "green"),
    ],
    complaints: [
      metric(
        "Open cases",
        rows.filter((row) => !["Resolved", "Closed"].includes(row.status)).length,
        Wrench,
        "blue",
      ),
      metric(
        "Emergency",
        rows.filter(
          (row) => row.priority === "Emergency" && !["Resolved", "Closed"].includes(row.status),
        ).length,
        TriangleAlert,
        "red",
      ),
      metric(
        "High priority",
        rows.filter(
          (row) => row.priority === "High" && !["Resolved", "Closed"].includes(row.status),
        ).length,
        TriangleAlert,
        "red",
      ),
      metric("Waiting parts", statusCount("Waiting Parts"), Clock3, "amber"),
      ...(resolvedToday !== undefined
        ? [
            metric(
              "Resolved today",
              resolvedToday,
              CircleCheck,
              "green",
              "Workspace · linked service jobs",
            ),
          ]
        : []),
    ],
    equipment: [
      metric(
        filtered ? "Matching assets" : "Total assets",
        count,
        AirVent,
        "blue",
        "Across matching records",
      ),
      metric(
        "Under warranty",
        rows.filter(
          (row) =>
            row.warranty_end &&
            String(row.warranty_end) >= today &&
            (!row.warranty_start || String(row.warranty_start) <= today),
        ).length,
        ShieldCheck,
        "green",
      ),
      metric(
        rows.every((row) => typeof row.active_amc === "boolean") ? "Active AMC" : "AMC linked",
        rows.filter((row) => (typeof row.active_amc === "boolean" ? row.active_amc : row.amc_id))
          .length,
        FileText,
      ),
      metric("Service due", due("next_service"), CalendarClock, "amber"),
    ],
    engineers: [
      metric("Available", statusCount("Available"), UserRound, "green"),
      metric("Travelling", statusCount("Travelling"), ListChecks, "amber"),
      metric("On site", statusCount("On Site"), Wrench, "blue"),
      metric("Busy", statusCount("Busy"), Clock3, "red"),
      metric("Off duty", statusCount("Off Duty", "Leave"), Clock3, "amber"),
    ],
    work_orders: [
      metric("Scheduled", statusCount("Scheduled", "Assigned"), CalendarClock, "blue"),
      metric("In progress", statusCount("In Progress", "On Site", "Travelling"), Wrench),
      metric("Waiting parts", statusCount("Waiting Parts"), Clock3, "amber"),
      metric(
        "Overdue",
        rows.filter(
          (row) =>
            row.scheduled_at &&
            dateKey(row.scheduled_at) < today &&
            !["Completed", "Cancelled"].includes(row.status),
        ).length,
        TriangleAlert,
        "red",
      ),
      metric(
        "Completed today",
        rows.filter(
          (row) =>
            row.status === "Completed" &&
            row.completed_at &&
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Muscat",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(String(row.completed_at))) === today,
        ).length,
        CircleCheck,
        "green",
      ),
    ],
    amc_contracts: [
      metric("Active contracts", statusCount("Active", "Expiring"), ShieldCheck, "green"),
      metric(
        "Due this month",
        maintenance?.due ??
          rows.filter((row) => String(row.next_visit ?? "").startsWith(today.slice(0, 7))).length,
        CalendarClock,
        "blue",
        maintenance ? "Workspace PM schedules" : "On this page",
      ),
      metric(
        maintenance ? "Overdue PM" : "Visits due",
        maintenance?.overdue ?? due("next_visit"),
        TriangleAlert,
        "red",
        maintenance ? "Workspace PM schedules" : current,
      ),
      metric("Expiring soon", statusCount("Expiring"), Clock3, "violet"),
    ],
    pm_schedules: [
      metric("Upcoming", statusCount("Upcoming"), CalendarClock, "blue"),
      metric("Due today", statusCount("Due"), Clock3, "amber"),
      metric("Overdue PM", statusCount("Overdue"), TriangleAlert, "red"),
      metric("Assigned", statusCount("Assigned"), UserRound, "green"),
    ],
  };
  if (!summaries[entity]) return null;
  return <StatsStrip metrics={summaries[entity]} label="Record summary" />;
}

export function ReportSummary({
  rows,
  count,
  entity,
}: {
  rows: RecordRow[];
  count: number;
  entity: string;
}) {
  const statuses = new Map<string, number>();
  rows.forEach((row) => {
    const status = derivedStatus(entity, row);
    statuses.set(status, (statuses.get(status) ?? 0) + 1);
  });
  return (
    <section className="report-summary" aria-label="Selected report summary">
      <div className="report-total">
        <span>Matching records</span>
        <strong>{count.toLocaleString()}</strong>
        <small>{rows.length} shown on this page</small>
      </div>
      <div className="report-breakdown">
        <h3>Status on this page</h3>
        {Array.from(statuses).map(([status, value]) => (
          <div className="report-status" key={status}>
            <span>{status}</span>
            <div className="report-status-track">
              <i style={{ width: `${(value / rows.length) * 100}%` }} />
            </div>
            <strong>{value}</strong>
          </div>
        ))}
        {!rows.length && <p className="muted">No matching records for this view.</p>}
      </div>
    </section>
  );
}
