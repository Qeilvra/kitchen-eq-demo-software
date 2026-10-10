import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  FileText,
  BriefcaseBusiness,
  ShieldCheck,
  Plus,
  MapPin,
  Clock3,
  TriangleAlert,
  AirVent,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { canAccess, type Profile } from "@/lib/domain";
import { operationalEvent } from "@/lib/company";
import { formatDate, Badge, Empty } from "./records";
import { initials } from "./shell";
import type { Lookup } from "@/lib/data";
import { lookups } from "@/lib/data";
import { MetricCard } from "./design-system";
import { PageHero, PanelHeader } from "./operations-ui";
import { overviewSignals } from "./operational-insights";
import { PipelineChart, StatusDonut, TrendChart } from "./operations-charts";
import { chartColors, statusColor } from "./chart-data";
type Summary = {
  enquiries: number;
  quotations: number;
  won: number;
  projects: number;
  complaints: number;
  emergency: number;
  jobs: number;
  engineers: number;
  pm: number;
  warranties: number;
  amc: number;
  completed: number;
  complaint_status: Record<string, number>;
  work_activity: { day: string; jobs: number; completed: number }[];
};
export async function Dashboard({ profile }: { profile: Profile }) {
  const db = await supabase();
  const renewalCutoff = new Date();
  renewalCutoff.setDate(renewalCutoff.getDate() + 30);
  await db.rpc("am_sync_notifications");
  const [
    { data: summary, error },
    { data: jobs },
    { data: complaints },
    { data: pm },
    { data: followups },
    { data: activity },
    { data: expiring },
    activeProjects,
    warrantyCases,
    amcDue,
    enquiryTotal,
    quotationTotal,
    wonProjects,
    { data: customerRows },
    { data: assetRows },
  ] = await Promise.all([
    db.rpc("am_dashboard"),
    db
      .from("work_orders")
      .select("id,code,name,status,engineer_id,scheduled_at,customer_id,site_id")
      .not("status", "in", "(Completed,Cancelled)")
      .order("scheduled_at")
      .limit(6),
    db
      .from("complaints")
      .select("id,code,name,status,priority,customer_id,site_id,created_at")
      .not("status", "in", "(Resolved,Closed)")
      .order("reported_at", { ascending: false })
      .limit(4),
    db
      .from("pm_schedules")
      .select("id,code,name,status,planned_date,customer_id,site_id")
      .neq("status", "Completed")
      .order("planned_date")
      .limit(4),
    db
      .from("quotations")
      .select("id,code,name,status,followup_date,customer_id")
      .in("status", ["Sent", "Follow-Up"])
      .order("followup_date")
      .limit(4),
    db
      .from("activity_log")
      .select("id,name,entity_type,entity_id,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("amc_contracts")
      .select("id,name,end_date")
      .in("status", ["Active", "Expiring"])
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .lte("end_date", renewalCutoff.toISOString().slice(0, 10))
      .order("end_date")
      .limit(1),
    db.from("projects").select("id", { count: "exact", head: true }).eq("status", "Active"),
    db
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("classification", "Warranty Service")
      .not("status", "in", "(Resolved,Closed)"),
    db
      .from("pm_schedules")
      .select("id", { count: "exact", head: true })
      .not("amc_id", "is", null)
      .neq("status", "Completed")
      .lte("planned_date", renewalCutoff.toISOString().slice(0, 10)),
    db.from("enquiries").select("id", { count: "exact", head: true }),
    db.from("quotations").select("id", { count: "exact", head: true }),
    db
      .from("projects")
      .select("id", { count: "exact", head: true })
      .not("quotation_id", "is", null)
      .neq("status", "Cancelled"),
    db
      .from("customers")
      .select("id,name,code,status,type")
      .eq("status", "Active")
      .order("code")
      .limit(1),
    db
      .from("equipment")
      .select(
        "id,name,code,status,type,customer_id,site_id,amc_id,warranty_end,last_service,next_service",
      )
      .eq("type", "Chiller")
      .order("code")
      .limit(1),
  ]);
  if (
    error ||
    !summary ||
    [activeProjects, warrantyCases, amcDue, enquiryTotal, quotationTotal, wonProjects].some(
      (result) => result.error,
    )
  )
    throw new Error(
      "Unable to load workspace records. Confirm the database migrations have been applied.",
    );
  const s = summary as Summary;
  const customerIds = [
    ...new Set(
      [...(jobs ?? []), ...(complaints ?? []), ...(pm ?? []), ...(followups ?? [])]
        .map((r) => r.customer_id)
        .filter(Boolean),
    ),
  ];
  const siteIds = [
    ...new Set(
      [...(jobs ?? []), ...(complaints ?? []), ...(pm ?? [])].map((r) => r.site_id).filter(Boolean),
    ),
  ];
  const engineerIds = [...new Set((jobs ?? []).map((r) => r.engineer_id).filter(Boolean))];
  const lookup = await lookups(["customers", "sites", "engineers"], {
    customers: customerIds,
    sites: siteIds,
    engineers: engineerIds,
  });
  const signals = await overviewSignals(profile);
  const metrics = [
    {
      label: "Total customers",
      value: signals.customers,
      href: "/customers",
      icon: Users,
      entity: "customers",
      context: "Connected customer relationships",
      color: "blue",
    },
    {
      label: "Active projects",
      value: activeProjects.count ?? 0,
      href: "/projects",
      icon: BriefcaseBusiness,
      entity: "projects",
      context: "Engineering & service delivery",
      color: "teal",
    },
    {
      label: "Open service cases",
      value: s.complaints,
      href: "/complaints",
      icon: ClipboardList,
      entity: "complaints",
      context: `${s.emergency} emergency priority`,
      color: "red",
    },
    {
      label: "AMC / PM due",
      value: amcDue.count ?? 0,
      href: "/pm_schedules",
      icon: CalendarClock,
      entity: "pm_schedules",
      context: "Covered visits · next 30 days",
      color: "teal",
    },
    {
      label: "Total assets",
      value: signals.assets,
      href: "/equipment",
      icon: AirVent,
      entity: "equipment",
      context: "Registered engineering assets",
      color: "blue",
    },
  ].filter((m) => canAccess(profile.role, m.entity));
  const engineerJobs = new Map<
    string,
    { name: string; count: number; status: string; site: string }
  >();
  (jobs ?? []).forEach((job) => {
    const eng = lookup.engineers?.find((e) => e.id === job.engineer_id);
    if (!eng) return;
    const previous = engineerJobs.get(eng.id);
    engineerJobs.set(eng.id, {
      name: eng.name,
      count: (previous?.count ?? 0) + 1,
      status: eng.status ?? "Assigned",
      site: lookup.sites?.find((site) => site.id === job.site_id)?.name ?? "Site not recorded",
    });
  });
  return (
    <div className="airmech-overview">
      <PageHero
        title="Operations Overview"
        description="Live view of customers, projects, service operations and team activity across all sites."
        aside={
          <div className="welcome-date">
            <span>
              {new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Muscat",
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date())}
            </span>
            <small>
              <MapPin size={13} />
              Muscat, Oman <span>UTC +4</span>
            </small>
            <p>Welcome back, {profile.full_name.split(" ")[0]}.</p>
          </div>
        }
      />
      <div className="kpi-grid">
        {metrics.map(({ label, value, href, icon, context, color }) => (
          <Link key={label} href={href} className="metric-link">
            <MetricCard label={label} value={value} icon={icon} context={context} tone={color} />
          </Link>
        ))}
      </div>
      <div className="dashboard-section-title">
        <h2>Operations overview</h2>
        <div>
          {canAccess(profile.role, "complaints", true) && (
            <Link className="button secondary small" href="/complaints/new">
              <Plus size={14} />
              New service case
            </Link>
          )}
          {canAccess(profile.role, "enquiries", true) && (
            <Link className="button small" href="/enquiries/new">
              <Plus size={14} />
              New enquiry
            </Link>
          )}
        </div>
      </div>
      {s.emergency > 0 && canAccess(profile.role, "complaints") && (
        <Link href="/complaints?status=New" className="urgent-strip">
          <TriangleAlert size={17} />
          <strong>
            {s.emergency} emergency{" "}
            {s.emergency === 1 ? "service case needs" : "service cases need"} attention
          </strong>
          <span>Review and dispatch your team</span>
          <ArrowRight size={17} />
        </Link>
      )}
      <div className="dashboard-main-grid">
        {canAccess(profile.role, "quotations") && (
          <section className="panel commercial-pipeline">
            <PanelTitle
              title="Commercial Pipeline"
              description="From enquiry to delivered project."
              href="/reports?report=pipeline"
              subtitle="View pipeline"
            />
            <PipelineChart
              stages={[
                {
                  label: "Enquiries",
                  value: enquiryTotal.count ?? 0,
                  href: "/enquiries",
                  color: chartColors.blue,
                },
                {
                  label: "Quotations",
                  value: quotationTotal.count ?? 0,
                  href: "/quotations",
                  color: chartColors.cyan,
                },
                {
                  label: "Won projects",
                  value: wonProjects.count ?? 0,
                  href: "/projects",
                  color: chartColors.green,
                },
              ]}
            />
            <p className="pipeline-note">Enquiry → Quotation → Approved → Project</p>
          </section>
        )}
        {canAccess(profile.role, "engineers") && (
          <section className="panel engineer-panel">
            <PanelTitle
              title="Engineer Dispatch"
              description="Availability and scheduled site assignments."
              href="/dispatch"
              subtitle={`${s.jobs} jobs today`}
            />
            <div className="engineer-status-counters">
              {["On Site", "Travelling", "Available", "Busy"].map((status) => (
                <div key={status} style={{ borderTopColor: statusColor(status) }}>
                  <span>{status}</span>
                  <strong>
                    {
                      signals.engineerStatuses.filter((engineer) => engineer.status === status)
                        .length
                    }
                  </strong>
                </div>
              ))}
            </div>
            {signals.teamLimited && (
              <p className="chart-footnote padded">First 1,000 field-team records.</p>
            )}
            <div className="engineer-list">
              {[...engineerJobs.entries()].slice(0, 4).map(([id, e], i) => (
                <Link href={`/engineers/${id}`} key={id} className="engineer-row">
                  <span className={`avatar avatar-${["teal", "sand", "blue", "sage"][i % 4]}`}>
                    {initials(e.name)}
                  </span>
                  <div>
                    <strong>{e.name}</strong>
                    <span>
                      {e.count} upcoming {e.count === 1 ? "job" : "jobs"}
                    </span>
                    <small>
                      <MapPin size={13} /> {e.site}
                    </small>
                  </div>
                  <Badge value={e.status} />
                </Link>
              ))}
              {engineerJobs.size === 0 && (
                <p className="muted padded">No scheduled engineer jobs.</p>
              )}
            </div>
            <Link className="panel-bottom-link" href="/engineers">
              View all engineers
              <ArrowRight size={14} />
            </Link>
          </section>
        )}
        {canAccess(profile.role, "complaints") && (
          <section className="panel complaint-panel">
            <PanelTitle
              title="Service Desk"
              description="Live status of open service operations."
              href="/complaints"
            />
            <div className="chart-panel-body">
              <StatusDonut
                data={Object.entries(s.complaint_status)
                  .filter(([status]) => !["Resolved", "Closed"].includes(status))
                  .map(([status, value]) => ({ label: status, value, color: statusColor(status) }))}
                label="Open cases"
              />
            </div>
          </section>
        )}
      </div>
      <div className="dashboard-summary-grid">
        {customerRows?.[0] && <CustomerOverview customer={customerRows[0]} />}
        {assetRows?.[0] && canAccess(profile.role, "equipment") && (
          <AssetOverview asset={assetRows[0]} />
        )}
        {canAccess(profile.role, "pm_schedules") && (
          <section className="panel">
            <PanelTitle
              title="AMC / Preventive Maintenance"
              href="/pm_schedules"
              subtitle="All visits"
            />
            <MiniRecords entity="pm_schedules" rows={pm ?? []} lookup={lookup} icon="pm" />
          </section>
        )}
      </div>
      <div className="dashboard-lower-grid">
        {canAccess(profile.role, "complaints") && (
          <section className="panel">
            <PanelTitle title="Work Needing Attention" href="/complaints" />
            <MiniRecords
              entity="complaints"
              rows={complaints ?? []}
              lookup={lookup}
              icon="complaint"
            />
          </section>
        )}
        {canAccess(profile.role, "pm_schedules") && (
          <section className="panel">
            <PanelTitle title="Upcoming Preventive Maintenance" href="/pm_schedules" />
            <MiniRecords entity="pm_schedules" rows={pm ?? []} lookup={lookup} icon="pm" />
          </section>
        )}
        {canAccess(profile.role, "quotations") && (
          <section className="panel">
            <PanelTitle title="Pending follow-ups" href="/quotations" />
            <MiniRecords entity="quotations" rows={followups ?? []} lookup={lookup} icon="quote" />
          </section>
        )}
      </div>
      <div className="dashboard-bottom-grid">
        {canAccess(profile.role, "work_orders") && (
          <section className="panel attention-panel">
            <PanelTitle title="Work Orders Needing Attention" href="/work_orders" />
            <div className="attention-list">
              {(jobs ?? []).map((job) => (
                <Link key={job.id} href={`/work_orders/${job.id}`}>
                  <span className="record-code">{job.code}</span>
                  <div>
                    <strong>{job.name}</strong>
                    <small>
                      {lookup.customers?.find((customer) => customer.id === job.customer_id)?.name}
                    </small>
                  </div>
                  <Badge value={job.status} />
                  <time>{formatDate(job.scheduled_at, true)}</time>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
              {!jobs?.length && (
                <Empty
                  title="No pending work orders"
                  detail="Scheduled and active jobs will appear here."
                />
              )}
            </div>
          </section>
        )}
        {canAccess(profile.role, "work_orders") && (
          <section className="panel service-activity-panel">
            <PanelTitle title="Service Trend" subtitle="Last 6 months" />
            <div className="chart-panel-body">
              <TrendChart
                data={signals.trend}
                series={[
                  { label: "New cases", color: chartColors.blue, kind: "bar" },
                  { label: "Resolved cases", color: chartColors.green, kind: "bar" },
                  { label: "Avg. resolution", color: chartColors.amber, kind: "line", unit: "hrs" },
                ]}
              />
              {signals.limited && (
                <p className="chart-footnote">Latest 1,000 service records in the period.</p>
              )}
            </div>
            <div className="chart-footer">
              <span>
                <strong>{s.completed}</strong> completed in the last 7 days
              </span>
              <Link href="/reports" className="text-link">
                View reports
                <ArrowRight size={13} />
              </Link>
            </div>
          </section>
        )}

        <section className="panel">
          <PanelTitle title="Recent Activity" href="/activity_log" />
          <div className="activity-feed">
            {(activity ?? []).map((a) => (
              <Link key={a.id} href={`/${a.entity_type}/${a.entity_id}`}>
                <span className="timeline-dot" />
                <div>
                  <strong>{operationalEvent(a.name)}</strong>
                  <small>{operationalEvent(String(a.entity_type).replaceAll("_", " "))}</small>
                </div>
                <time>{formatDate(a.created_at, true)}</time>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        </section>
        {canAccess(profile.role, "amc_contracts") && expiring?.[0] && (
          <Link className="renewal-panel" href={`/amc_contracts/${expiring[0].id}`}>
            <span className="eyebrow">UPCOMING RENEWAL</span>
            <ShieldCheck size={28} />
            <h3>{expiring[0].name}</h3>
            <p>
              Coverage ends {formatDate(expiring[0].end_date)}. Keep the next year of service on
              track.
            </p>
            <span className="text-link">
              Review contract
              <ArrowRight size={15} />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
async function CustomerOverview({
  customer,
}: {
  customer: { id: string; name: string; code: string; status: string; type: string };
}) {
  const db = await supabase();
  const { data, error } = await db.rpc("am_customer_metrics", { targets: [customer.id] });
  if (error) throw new Error("Unable to load customer summary.");
  const metrics = data?.[0];
  return (
    <section className="panel">
      <PanelTitle
        title="Customer Summary"
        href={`/customers/${customer.id}`}
        subtitle="Customer 360"
      />
      <Link href={`/customers/${customer.id}`} className="overview-record-heading">
        <span className="avatar avatar-teal">{initials(customer.name)}</span>
        <div>
          <strong>{customer.name}</strong>
          <small>{customer.type} · Oman</small>
        </div>
        <Badge value={customer.status} />
      </Link>
      <div className="overview-record-metrics">
        {[
          { label: "Sites", value: metrics?.sites_count ?? 0, tab: "sites" },
          { label: "Assets", value: metrics?.equipment_count ?? 0, tab: "equipment" },
          { label: "Open cases", value: metrics?.open_complaints ?? 0, tab: "complaints" },
          { label: "AMC", value: metrics?.amc_count ?? 0, tab: "amc_contracts" },
        ].map((metric) => (
          <Link key={metric.tab} href={`/customers/${customer.id}?tab=${metric.tab}`}>
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
          </Link>
        ))}
      </div>
      <Link className="panel-bottom-link" href={`/customers/${customer.id}?tab=activity_log`}>
        Customer activity
        <ArrowRight size={14} />
      </Link>
    </section>
  );
}
async function AssetOverview({
  asset,
}: {
  asset: {
    id: string;
    name: string;
    code: string;
    status: string;
    customer_id: string;
    site_id: string;
    amc_id: string | null;
    warranty_end: string | null;
    last_service: string | null;
    next_service: string | null;
  };
}) {
  const db = await supabase();
  const [{ data: history }, { count: cases }, lookup] = await Promise.all([
    db
      .from("service_reports")
      .select("id,code,name,visit_date")
      .eq("equipment_id", asset.id)
      .order("visit_date", { ascending: false })
      .limit(3),
    db
      .from("complaints")
      .select("id", { head: true, count: "exact" })
      .eq("equipment_id", asset.id)
      .not("status", "in", "(Resolved,Closed)"),
    lookups(["customers", "sites"], { customers: [asset.customer_id], sites: [asset.site_id] }),
  ]);
  return (
    <section className="panel">
      <PanelTitle title="Asset Summary" href={`/equipment/${asset.id}`} subtitle="Asset record" />
      <Link href={`/equipment/${asset.id}`} className="overview-record-heading">
        <span className="overview-asset-icon">
          <AirVent size={30} />
        </span>
        <div>
          <strong>{asset.name}</strong>
          <small>
            {lookup.customers?.[0]?.name} · {lookup.sites?.[0]?.name}
          </small>
        </div>
        <Badge value={asset.status} />
      </Link>
      <div className="overview-record-metrics">
        <div>
          <small>Warranty</small>
          <strong>{formatDate(asset.warranty_end)}</strong>
        </div>
        <div>
          <small>AMC</small>
          <strong>{asset.amc_id ? "Linked" : "None"}</strong>
        </div>
        <div>
          <small>Next service</small>
          <strong>{formatDate(asset.next_service)}</strong>
        </div>
        <Link href={`/equipment/${asset.id}?tab=complaints`}>
          <small>Open cases</small>
          <strong>{cases ?? 0}</strong>
        </Link>
      </div>
      <div className="overview-history">
        {(history ?? []).map((report) => (
          <Link href={`/service_reports/${report.id}`} key={report.id}>
            <span>{formatDate(report.visit_date)}</span>
            <strong>{report.name}</strong>
            <Badge value="Completed" />
          </Link>
        ))}
      </div>
      <Link className="panel-bottom-link" href={`/equipment/${asset.id}?tab=service_reports`}>
        Asset service history
        <ArrowRight size={14} />
      </Link>
    </section>
  );
}
export function PanelTitle({
  title,
  href,
  subtitle,
  description,
}: {
  title: string;
  href?: string;
  subtitle?: string;
  description?: string;
}) {
  return (
    <PanelHeader
      title={title}
      description={description}
      action={
        href ? (
          <Link className="text-link" href={href}>
            {subtitle ?? "View all"}
            <ArrowRight size={13} />
          </Link>
        ) : subtitle ? (
          <span className="muted">{subtitle}</span>
        ) : undefined
      }
    />
  );
}
function MiniRecords({
  entity,
  rows,
  lookup,
  icon,
}: {
  entity: string;
  rows: {
    id: string;
    code: string;
    name: string;
    status: string;
    customer_id: string;
    priority?: string;
    planned_date?: string;
    followup_date?: string;
    created_at?: string;
  }[];
  lookup: Lookup;
  icon: string;
}) {
  return (
    <div className="mini-records">
      {rows.map((row) => (
        <Link key={row.id} href={`/${entity}/${row.id}`}>
          <span className={`mini-icon ${icon}`}>
            {icon === "pm" ? (
              <CalendarClock size={17} />
            ) : icon === "quote" ? (
              <FileText size={17} />
            ) : (
              <ClipboardList size={17} />
            )}
          </span>
          <div>
            <strong>{row.code}</strong>
            <span>{row.name}</span>
            <small>{lookup.customers?.find((c) => c.id === row.customer_id)?.name ?? ""}</small>
          </div>
          <div className="mini-record-end">
            {row.priority ? (
              <Badge value={row.priority} />
            ) : (
              <time>{formatDate(row.planned_date ?? row.followup_date)}</time>
            )}
            <small>{row.priority ? formatDate(row.created_at, true) : row.status}</small>
          </div>
        </Link>
      ))}
      {rows.length === 0 && <Empty title="Nothing pending" detail="You’re up to date." />}
    </div>
  );
}
export async function FieldHome({ profile }: { profile: Profile }) {
  const db = await supabase();
  const { data: jobs, error } = await db
    .from("work_orders")
    .select("id,code,name,status,scheduled_at,priority,site_id,customer_id")
    .not("status", "in", "(Completed,Cancelled)")
    .order("scheduled_at")
    .limit(30);
  if (error) throw new Error("Unable to load your assigned jobs.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Muscat",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const assigned = jobs ?? [];
  const todayJobs = assigned.filter(
    (j) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Muscat",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(j.scheduled_at)) === today,
  );
  const { count: completed } = await db
    .from("work_orders")
    .select("id", { head: true, count: "exact" })
    .eq("status", "Completed")
    .gte("completed_at", `${today}T00:00:00+04:00`);
  const lookup = await lookups(["customers", "sites"], {
    customers: assigned.map((j) => j.customer_id),
    sites: assigned.map((j) => j.site_id),
  });
  return (
    <>
      <section className="field-welcome">
        <p>Good morning</p>
        <h1>{profile.full_name.split(" ")[0]}.</h1>
        <span>Ready for a productive day in the field?</span>
        <div>
          <span>
            <strong>{todayJobs.length}</strong>Jobs today
          </span>
          <span>
            <strong>{completed ?? 0}</strong>Completed today
          </span>
          <span>
            <strong>{assigned.filter((j) => j.priority === "Emergency").length}</strong>Urgent jobs
          </span>
        </div>
      </section>
      {assigned[0] && (
        <section className="next-job">
          <span className="eyebrow">YOUR NEXT JOB</span>
          <Badge value={assigned[0].status} />
          <h2>{assigned[0].name}</h2>
          <p>
            <MapPin size={15} />
            {lookup.sites?.find((s) => s.id === assigned[0].site_id)?.name}
          </p>
          <p>
            <Clock3 size={15} />
            {formatDate(assigned[0].scheduled_at, true)}
          </p>
          <Link href={`/work_orders/${assigned[0].id}`} className="button">
            Open job
            <ArrowRight size={16} />
          </Link>
        </section>
      )}
      <div className="field-quick-actions">
        <Link href="/work_orders">
          <ClipboardList size={24} />
          My jobs
        </Link>
        <Link href="/search">
          <AirVent size={24} />
          Find assets
        </Link>
        <Link href="/service_reports">
          <FileText size={24} />
          My reports
        </Link>
      </div>
      <section className="field-jobs">
        <div className="panel-heading">
          <h2>Today’s schedule</h2>
          <Link href="/work_orders" className="text-link">
            View all
            <ArrowRight size={13} />
          </Link>
        </div>
        {todayJobs.map((job) => (
          <Link className="field-job-card" key={job.id} href={`/work_orders/${job.id}`}>
            <span className="field-job-time">
              {new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Muscat",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(job.scheduled_at))}
            </span>
            <div>
              <span className="record-code">{job.code}</span>
              <h3>{job.name}</h3>
              <p>{lookup.customers?.find((c) => c.id === job.customer_id)?.name}</p>
              <Badge value={job.status} />
            </div>
            <ArrowRight size={17} />
          </Link>
        ))}
        {!todayJobs.length && (
          <Empty
            title="No jobs scheduled today"
            detail="Your other assigned jobs are available under My jobs."
          />
        )}
      </section>
    </>
  );
}
