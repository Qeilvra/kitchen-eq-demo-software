import Link from "next/link";
import { financialReports, reportPermission } from "@/lib/financial-reports";
import { financialReport } from "@/lib/finance";
import { canAccess, type Profile } from "@/lib/domain";
import { recordLookups, lookups } from "@/lib/data";
import { PageHeader, RecordTable, Pagination } from "./records";
import { DataPanel } from "./operations-ui";
import { FinancialMetrics } from "./financial-dashboard";
import { MoneyBars } from "./finance-charts";

export async function FinancialReports({ choice, profile, customer, page = 1 }: {
  choice: string; profile: Profile; customer?: string; page?: number;
}) {
  const available = financialReports.filter(r => canAccess(profile.role, reportPermission(r.entity)));
  const report = available.find(r => r.key === choice) ?? available[0];
  if (!report) return null;
  const [data, customers] = await Promise.all([
    financialReport(report.key, customer, page), lookups(["customers"]),
  ]);
  const lookup = await recordLookups(report.entity, data.records);
  const { summary } = data;
  return <>
    <PageHeader title="Financial reports" eyebrow="COMMERCIAL & FINANCIAL INTELLIGENCE"
      description="Persisted commercial values, collection history and operational costs." module="reports"
      action={<Link className="button secondary" href={`/api/export?report=${report.key}${customer ? `&customer=${customer}` : ""}`}>Export CSV</Link>} />
    <div className="reports-layout">
      <nav className="report-nav" aria-label="Financial report selector">
        <h2>Financial reports</h2>
        {available.map(r => <Link href={`/reports?report=${r.key}`} key={r.key} className={report.key === r.key ? "active" : ""}>{r.label}</Link>)}
        <Link href="/reports">Operational reports</Link>
      </nav>
      <div className="report-workspace">
        <DataPanel title={report.label}>
          <form method="get" className="finance-toolbar">
            <input type="hidden" name="report" value={report.key} />
            <select name="customer" defaultValue={customer ?? ""} aria-label="Customer">
              <option value="">All customers</option>
              {customers.customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="button">Apply customer</button>
          </form>
        </DataPanel>
        <FinancialMetrics metrics={[
          { label: "Matching records", value: data.count },
          { label: report.key === "paid-service-revenue" ? "Collected service payments" : report.amount.replaceAll("_", " "), value: summary.total, money: true,
            context: report.key === "paid-service-revenue" ? "Recorded payments only · excludes AMC billing, unchargeable warranty work and reversals" : summary.excluded_count ? "Excludes drafts, cancelled invoices or reversed payments" : "Recorded amounts only" },
          ...(report.key === "quotation-conversion" ? [{ label: "Approved / all quotations", value: data.count ? `${Math.round(summary.approved_count * 1000 / data.count) / 10}%` : "—", context: `${summary.approved_count} approved of ${data.count} quotations` }] : []),
        ]} />
        {report.key !== "project-profitability" && <MoneyBars
          title={report.key === "receivables-aging" ? "Receivables aging" : `${report.label} by ${report.group.replaceAll("_", " ")}`}
          description="Amounts grouped across all matching records"
          values={summary.groups.map(g => ({ label: g.label, value: g.value, context: `${g.count} records` }))} />}
        {report.key === "project-profitability" && <p className="muted padded">Profit and margin are shown only when recognized revenue and actual costs are recorded. Contract value is a commitment, not recognized revenue.</p>}
        <DataPanel title="Report records" count={data.count}>
          <RecordTable entity={report.entity} rows={data.records} lookup={lookup} />
          <Pagination entity="reports" count={data.count} page={page} size={20} query={{ report: report.key, ...(customer ? { customer } : {}) }} />
        </DataPanel>
      </div>
    </div>
  </>;
}
