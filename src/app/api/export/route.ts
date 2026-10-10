import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authorize } from "@/lib/auth";
import { fieldsFor } from "@/lib/catalog";
import { reports, csvCell } from "@/lib/reports";
import {financialReports,reportPermission,financialReportFilters} from '@/lib/financial-reports';
import {financeRead} from '@/lib/finance';
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("report");
  const financial=financialReports.find(r=>r.key===key);
  if(financial){
    const {requireProfile}=await import('@/lib/auth');
    const {canAccess}=await import('@/lib/domain');
    const profile=await requireProfile();if(!canAccess(profile.role,reportPermission(financial.entity)))return NextResponse.json({error:'Permission required.'},{status:403});
    const customer=new URL(request.url).searchParams.get('customer')??undefined;
    const filters=financialReportFilters(financial.key,customer);
    const records=[];
    for(let page=1;page<=20;page++){
      const batch=await financeRead(financial.entity,filters,500,page);records.push(...batch.records);
      if(batch.records.length<500||page*500>=batch.count)break;
    }
    const columns=[...new Set(records.flatMap(r=>Object.keys(r)))].filter(c=>!['tenant_id','request_fingerprint','request_id'].includes(c));
    const csv=[columns.map(csvCell).join(','),...records.map(r=>columns.map(c=>csvCell(r[c])).join(','))].join('\r\n');
    return new Response('\uFEFF'+csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="airmech-${financial.key}.csv"`,'Cache-Control':'private, no-store'}});
  }
  const report = reports.find((r) => r.key === key);
  if (!report) return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  const profile = await authorize(report.entity);
  if (profile.role === "engineer")
    return NextResponse.json({ error: "Permission required." }, { status: 403 });
  const db = await supabase();
  const rows: Record<string, unknown>[] = [];
  for (let start = 0; start < 10000; start += 500) {
    let query = db
      .from(report.entity)
      .select(fieldsFor(report.entity))
      .order("id")
      .range(start, start + 499);
    if (report.key === "complaints") query = query.not("status", "in", "(Resolved,Closed)");
    if (report.key === "workload") query = query.not("status", "in", "(Completed,Cancelled)");
    if (report.key === "pm") query = query.neq("status", "Completed");
    if (report.key === "active-projects") query = query.eq("status", "Active");
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Export failed." }, { status: 500 });
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if ((data?.length ?? 0) < 500) break;
  }
  const columns = fieldsFor(report.entity)
    .split(",")
    .filter((c) => !["tenant_id", "id"].includes(c));
  const csv = [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")),
  ].join("\r\n");
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="airmech-${report.key}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
