import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  MessageSquare,
  FileText,
  BriefcaseBusiness,
  ShieldCheck,
  Plus,
  MapPin,
  Clock3,
  TriangleAlert,
  AirVent,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { canAccess, type Profile } from "@/lib/domain";
import { formatDate, Badge, Empty } from "./records";
import { initials } from "./shell";
import type { Lookup } from "@/lib/data";
import { lookups } from "@/lib/data";
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
  ]);
  if (error || !summary)
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
  const metrics = [
    {
      label: "Open enquiries",
      value: s.enquiries,
      href: "/enquiries",
      icon: MessageSquare,
      entity: "enquiries",
      context: "New opportunities",
      color: "blue",
    },
    {
      label: "Quotations pending",
      value: s.quotations,
      href: "/quotations",
      icon: FileText,
      entity: "quotations",
      context: `${s.won} approved quotations`,
      color: "teal",
    },
    {
      label: "Active projects",
      value: s.projects,
      href: "/projects",
      icon: BriefcaseBusiness,
      entity: "projects",
      context: "Planning & execution",
      color: "teal",
    },
    {
      label: "Open complaints",
      value: s.complaints,
      href: "/complaints",
      icon: ClipboardList,
      entity: "complaints",
      context: `${s.emergency} emergency priority`,
      color: "red",
    },
    {
      label: "Upcoming PM visits",
      value: s.pm,
      href: "/pm_schedules",
      icon: CalendarClock,
      entity: "pm_schedules",
      context: "In the next 14 days",
      color: "teal",
    },
    {
      label: "Contracts expiring",
      value: s.amc,
      href: "/amc_contracts",
      icon: ShieldCheck,
      entity: "amc_contracts",
      context: "In the next 30 days",
      color: "amber",
    },
  ].filter((m) => canAccess(profile.role, m.entity));
  const engineerJobs = new Map<string, { name: string; count: number; status: string }>();
  (jobs ?? []).forEach((job) => {
    const eng = lookup.engineers?.find((e) => e.id === job.engineer_id);
    if (!eng) return;
    const previous = engineerJobs.get(eng.id);
    engineerJobs.set(eng.id, {
      name: eng.name,
      count: (previous?.count ?? 0) + 1,
      status: eng.status ?? "Assigned",
    });
  });
  return (
    <>
      <section className="dashboard-welcome">
        <div>
          <span className="eyebrow light">YOUR OPERATIONS, AT A GLANCE</span>
          <h1>Welcome back, {profile.full_name.split(" ")[0]}.</h1>
          <p>Here’s what’s happening across your operations today.</p>
        </div>
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
        </div>
        <div className="welcome-lines" aria-hidden="true">
          <svg viewBox="0 0 500 160">
            <path
              d="M20 150 115 75l32 28 48-79 35 49 27-14 60 64 32-38 55 65M0 150h500M400 150V80h20v70m-17-70V65h14v15m-8-15V42m-42 108V96h22v54"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </section>
      <div className="kpi-grid">
        {metrics.map(({ label, value, href, icon: Icon, context, color }) => (
          <Link key={href} href={href} className={`kpi-card ${color}`}>
            <div className="kpi-top">
              <Icon size={19} />
              <ArrowUpRight size={14} />
            </div>
            <strong>{value}</strong>
            <span>{label}</span>
            <small>{context}</small>
          </Link>
        ))}
      </div>
      <div className="dashboard-section-title">
        <h2>Operations overview</h2>
        <div>
          {canAccess(profile.role, "complaints", true) && (
            <Link className="button secondary small" href="/complaints/new">
              <Plus size={14} />
              New complaint
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
            {s.emergency} emergency {s.emergency === 1 ? "complaint needs" : "complaints need"}{" "}
            attention
          </strong>
          <span>Review and dispatch your team</span>
          <ArrowRight size={17} />
        </Link>
      )}
      <div className="dashboard-main-grid">
        {canAccess(profile.role, "engineers") && (
          <section className="panel engineer-panel">
            <PanelTitle
              title="Engineer schedule"
              href="/dispatch"
              subtitle={`${s.jobs} jobs today`}
            />
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
        {canAccess(profile.role, "work_orders") && (
          <section className="panel service-activity-panel">
            <PanelTitle title="Service activity" subtitle="Last 30 days" />
            <div className="chart-legend">
              <span>
                <i className="legend-blue" />
                Scheduled jobs
              </span>
              <span>
                <i className="legend-teal" />
                Completed jobs
              </span>
            </div>
            <ActivityChart rows={s.work_activity} />
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
        {canAccess(profile.role, "complaints") && (
          <section className="panel complaint-panel">
            <PanelTitle title="Complaint status" href="/complaints" />
            <ComplaintChart statuses={s.complaint_status} />
          </section>
        )}
      </div>
      <div className="dashboard-lower-grid">
        {canAccess(profile.role, "complaints") && (
          <section className="panel">
            <PanelTitle title="Recent complaints" href="/complaints" />
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
            <PanelTitle title="Upcoming maintenance" href="/pm_schedules" />
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
        <section className="panel">
          <PanelTitle title="Latest activity" href="/activity_log" />
          <div className="activity-feed">
            {(activity ?? []).map((a) => (
              <Link key={a.id} href={`/${a.entity_type}/${a.entity_id}`}>
                <span className="timeline-dot" />
                <div>
                  <strong>{a.name}</strong>
                  <small>{String(a.entity_type).replaceAll("_", " ")}</small>
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
    </>
  );
}
export function PanelTitle({
  title,
  href,
  subtitle,
}: {
  title: string;
  href?: string;
  subtitle?: string;
}) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      {href ? (
        <Link className="text-link" href={href}>
          {subtitle ?? "View all"}
          <ArrowRight size={13} />
        </Link>
      ) : subtitle ? (
        <span className="muted">{subtitle}</span>
      ) : null}
    </div>
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
function ActivityChart({ rows }: { rows: Summary["work_activity"] }) {
  if (!rows.length)
    return (
      <Empty title="No service activity" detail="Scheduled and completed jobs will appear here." />
    );
  const max = Math.max(4, ...rows.map((r) => r.jobs));
  const width = 400,
    height = 156;
  const point = (v: number, i: number) =>
    `${38 + (i * (width - 50)) / Math.max(1, rows.length - 1)},${height - 10 - (v * (height - 32)) / max}`;
  const path = (key: "jobs" | "completed") =>
    rows.map((r, i) => `${i ? "L" : "M"}${point(r[key], i)}`).join(" ");
  return (
    <div className="activity-chart">
      <svg
        viewBox={`0 0 ${width} ${height + 22}`}
        role="img"
        aria-label="Scheduled and completed work orders by date"
      >
        <defs>
          <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f6f8f" stopOpacity=".12" />
            <stop offset="1" stopColor="#2f6f8f" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="38"
              x2={width - 8}
              y1={height - 10 - (i * (height - 32)) / 4}
              y2={height - 10 - (i * (height - 32)) / 4}
              stroke="#e5ecef"
            />
            <text x="24" y={height - 6 - (i * (height - 32)) / 4} textAnchor="end">
              {Math.round((max * i) / 4)}
            </text>
          </g>
        ))}
        <path
          d={`${path("jobs")} L${point(0, rows.length - 1)} L${point(0, 0)} Z`}
          fill="url(#activity-fill)"
        />
        <path d={path("jobs")} fill="none" stroke="#2f6f8f" strokeWidth="2" />
        <path d={path("completed")} fill="none" stroke="#0f7484" strokeWidth="2" />
        {[0, Math.floor((rows.length - 1) / 2), rows.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text
              key={i}
              x={38 + (i * (width - 50)) / Math.max(1, rows.length - 1)}
              y={height + 14}
              textAnchor="middle"
            >
              {formatDate(rows[i].day).slice(0, 6)}
            </text>
          ))}
      </svg>
    </div>
  );
}
function ComplaintChart({ statuses }: { statuses: Record<string, number> }) {
  const colors = [
    "#2f6f8f",
    "#3ca6b1",
    "#bc8039",
    "#e0b273",
    "#246b56",
    "#a33b3b",
    "#77949d",
    "#b5c9ce",
  ];
  const entries = Object.entries(statuses);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  let offset = 0;
  return (
    <div className="complaint-chart">
      <div className="donut">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${total} complaints grouped by status`}>
          <circle cx="60" cy="60" r="46" fill="none" stroke="#edf2f3" strokeWidth="17" />
          {entries.map(([name, n], i) => {
            const length = total ? (n / total) * 289.03 : 0;
            const previous = offset;
            offset += length;
            return (
              <circle
                key={name}
                cx="60"
                cy="60"
                r="46"
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="17"
                strokeDasharray={`${Math.max(0, length - 2)} ${289.03 - length + 2}`}
                strokeDashoffset={-previous}
                transform="rotate(-90 60 60)"
              />
            );
          })}
        </svg>
        <div>
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </div>
      <div className="donut-legend">
        {entries.map(([name, n], i) => (
          <Link href={`/complaints?status=${encodeURIComponent(name)}`} key={name}>
            <i style={{ background: colors[i % colors.length] }} />
            <span>{name}</span>
            <strong>{n}</strong>
          </Link>
        ))}
      </div>
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
          Find equipment
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
