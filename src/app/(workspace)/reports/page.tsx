import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ArrowUpRight, FileBarChart2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { canAccess } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { fieldsFor } from "@/lib/catalog";
import type { RecordRow } from "@/lib/domain";
import { recordLookups } from "@/lib/data";
import { PageHeader, RecordTable } from "@/components/records";
import { reports } from "@/lib/reports";
import { ReportSummary } from "@/components/design-system";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; page?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "engineer") notFound();
  const { report: choice, page: pageString } = await searchParams;
  const available = reports.filter((r) => canAccess(profile.role, r.entity));
  const report = available.find((r) => r.key === choice) ?? available[0];
  if (!report) notFound();
  const db = await supabase();
  const page = Math.max(1, Number.parseInt(pageString ?? "1", 10) || 1);
  let query = db.from(report.entity).select(fieldsFor(report.entity), { count: "exact" });
  if (report.key === "complaints") query = query.not("status", "in", "(Resolved,Closed)");
  if (report.key === "workload") query = query.not("status", "in", "(Completed,Cancelled)");
  if (report.key === "pm") query = query.neq("status", "Completed");
  if (report.key === "active-projects") query = query.eq("status", "Active");
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("Unable to load report data.");
  const rows = (data ?? []) as unknown as RecordRow[];
  const lookup = await recordLookups(report.entity, rows);
  return (
    <>
      <PageHeader
        eyebrow="OPERATIONAL INTELLIGENCE"
        title="Reports"
        description="Practical insights from your live operational records."
        action={
          <Link className="button secondary" href={`/api/export?report=${report.key}`}>
            <Download size={16} />
            Export CSV
          </Link>
        }
      />
      <div className="reports-layout">
        <nav className="report-nav" aria-label="Report views">
          <h2>Report library</h2>
          {available.map((r) => (
            <Link
              key={r.key}
              className={r.key === report.key ? "active" : ""}
              aria-current={r.key === report.key ? "page" : undefined}
              href={`/reports?report=${r.key}`}
            >
              <FileBarChart2 size={17} />
              <span>{r.label}</span>
            </Link>
          ))}
        </nav>
        <section className="panel">
          <div className="report-header">
            <div>
              <h2>{report.label}</h2>
              <p>{report.description}</p>
            </div>
          </div>
          <ReportSummary rows={rows} count={count ?? 0} entity={report.entity} />
          <RecordTable entity={report.entity} rows={rows} lookup={lookup} />
          <div className="pagination">
            <span>
              Page {page} · {count ?? 0} records
            </span>
            <div>
              {page > 1 && (
                <Link
                  className="button secondary small"
                  href={`/reports?report=${report.key}&page=${page - 1}`}
                >
                  Previous
                </Link>
              )}
              {page * 20 < (count ?? 0) && (
                <Link
                  className="button secondary small"
                  href={`/reports?report=${report.key}&page=${page + 1}`}
                >
                  Next
                </Link>
              )}
              <Link className="text-link" href={`/${report.entity}`}>
                Open module
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
