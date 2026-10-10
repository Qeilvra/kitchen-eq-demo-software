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
import {
  ReportVisualization,
  quotationPresentation,
  overviewSignals,
  ServiceTrendPanel,
} from "@/components/operational-insights";
import { DataPanel } from "@/components/operations-ui";
import {financialReports,reportPermission} from '@/lib/financial-reports';
import {FinancialReports} from '@/components/financial-reports';
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; page?: string;customer?:string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "engineer") notFound();
  const { report: choice, page: pageString,customer } = await searchParams;
  if(financialReports.some(r=>r.key===choice)&&canAccess(profile.role,reportPermission(financialReports.find(r=>r.key===choice)!.entity)))return <FinancialReports choice={choice!} profile={profile} customer={customer} page={Math.max(1,Number.parseInt(pageString??'1',10)||1)}/>;
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
  const presentationRows =
    report.entity === "quotations" ? await quotationPresentation(rows) : rows;
  const serviceSignals = report.key === "complaints" ? await overviewSignals(profile) : undefined;
  return (
    <>
      <PageHeader
        eyebrow="OPERATIONAL INTELLIGENCE"
        title="Reports"
        module="reports"
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
          {financialReports.filter(r=>canAccess(profile.role,reportPermission(r.entity))).map(r=><Link href={`/reports?report=${r.key}`} key={r.key}>{r.label}</Link>)}
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
        <div className="report-workspace">
          <section className="panel report-overview-panel">
            <div className="report-header">
              <div>
                <h2>{report.label}</h2>
                <p>{report.description}</p>
              </div>
            </div>
            <ReportSummary rows={rows} count={count ?? 0} entity={report.entity} />
          </section>
          <ReportVisualization
            report={report.key}
            entity={report.entity}
            rows={presentationRows}
            lookup={lookup}
          />
          {serviceSignals && <ServiceTrendPanel signals={serviceSignals} />}
          <DataPanel title="Detailed records" count={count ?? 0}>
            <RecordTable entity={report.entity} rows={presentationRows} lookup={lookup} />
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
          </DataPanel>
        </div>
      </div>
    </>
  );
}
