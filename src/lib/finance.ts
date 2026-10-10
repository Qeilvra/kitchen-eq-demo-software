import 'server-only';
import {supabase} from './supabase';
import type {RecordRow} from './domain';
export async function financeRead(entity:string,filters:Record<string,string>={},size=20,page=1){
 const db=await supabase();const {data,error}=await db.rpc('am_finance_read',{entity,filters,size,page});
 if(error) throw new Error(error.message);
 const records=(data?.records??[]) as RecordRow[];for(const r of records) if(r.effective_status) r.status=String(r.effective_status);
 return {records,count:Number(data?.count??0),size,page};
}
export type FinancialOverview=Record<string,string|null>&{trend:{month:string;invoiced:string;collected:string}[];aging:{bucket:string;invoice_count:string;amount:string}[]};
export async function financialOverview(customer?:string){const db=await supabase();const {data,error}=await db.rpc('am_financial_overview',{customer:customer??null});if(error) throw new Error(error.message);return data as FinancialOverview;}
export type FinancialReportData={records:RecordRow[];count:number;summary:{total:string;excluded_count:number;approved_count:number;groups:{label:string;value:string;count:number}[]}};
export async function financialReport(report:string,customer?:string,page=1){
 const db=await supabase();const {data,error}=await db.rpc('am_financial_report',{report_key:report,customer:customer??null,page,size:20});
 if(error)throw new Error(error.message);
 const result=data as FinancialReportData;
 for(const row of result.records)if(row.effective_status)row.status=String(row.effective_status);
 return result;
}
