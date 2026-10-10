import Link from 'next/link';
import {getEntity} from '@/lib/catalog';
import {canAccess,customerFinance,companyFinance,type Profile,type RecordRow} from '@/lib/domain';
import {financeRead,financialOverview} from '@/lib/finance';
import {getRecord,lookups,recordLookups} from '@/lib/data';
import {financeWorkflow} from '@/app/actions';
import {moneyKeys} from '@/lib/finance-catalog';
import {PageHeader,Notice,Badge,RecordTable,Pagination,display} from './records';
import {DataPanel} from './operations-ui';
import {RecordForm} from './record-form';
import {FinancialMetrics} from './financial-dashboard';
import {MoneyBars} from './finance-charts';
import {notFound} from 'next/navigation';
type Query=Record<string,string|undefined>;
export async function FinanceRegister({entity,query,profile}:{entity:string;query:Query;profile:Profile}){
 const filters:Record<string,string>={};for(const key of ['q','status','customer_id','project_id','amc_id','due_from','due_to','overdue'])if(query[key])filters[key]=query[key]!;
 if(query.foreign&&query.parent)filters[query.foreign]=query.parent;
 const [data,filterLookups,summary]=await Promise.all([
  financeRead(entity,filters,20,Number.parseInt(query.page??'1',10)||1),
  lookups(['customers','projects','amc_contracts']),
  entity==='receivables'&&companyFinance(profile.role)?financialOverview():Promise.resolve(null),
 ]);
 const lookup=await recordLookups(entity,data.records);const meta=getEntity(entity);
 return <><PageHeader module={entity} eyebrow="FINANCE · OMR" title={meta.label} description={entity==='receivables'?'Customer balances, due dates and collection priorities.':meta.description} action={meta.create&&canAccess(profile.role,entity,true)?<Link className="button" href={`/${entity}/new`}>New {meta.singular.toLowerCase()}</Link>:undefined}/><Notice error={query.error} success={query.success}/>
 {summary&&<><FinancialMetrics metrics={[{label:'Outstanding',value:summary.outstanding,money:true},{label:'Overdue',value:summary.overdue_amount,money:true},{label:'Overdue invoices',value:summary.overdue_invoices},{label:'Due within 30 days',value:summary.invoices_due}]}/><MoneyBars title="Receivables aging" description="Company-wide amounts and invoice counts by days past due" values={summary.aging.map(a=>({label:a.bucket,value:a.amount,context:`${a.invoice_count} invoices`}))}/></>}
 <section className="panel toolbar-panel"><form className="finance-toolbar" method="get"><label className="search-field"><span className="sr-only">Search</span><input name="q" placeholder="Search description or reference…" defaultValue={query.q}/></label><select name="status" defaultValue={query.status??''} aria-label="Status"><option value="">All statuses</option>{meta.statuses.map(s=><option key={s}>{s}</option>)}</select>
 {['invoices','receivables'].includes(entity)&&<><select name="customer_id" defaultValue={query.customer_id??''} aria-label="Customer"><option value="">All customers</option>{filterLookups.customers?.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><select name="project_id" defaultValue={query.project_id??''} aria-label="Project"><option value="">All projects</option>{filterLookups.projects?.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><select name="amc_id" defaultValue={query.amc_id??''} aria-label="AMC contract"><option value="">All AMC contracts</option>{filterLookups.amc_contracts?.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select><label>Due from<input type="date" name="due_from" defaultValue={query.due_from}/></label><label>Due to<input type="date" name="due_to" defaultValue={query.due_to}/></label><label className="finance-checkbox"><input type="checkbox" name="overdue" value="true" defaultChecked={!!query.overdue}/>Overdue only</label></>}
 <button className="button">Apply filters</button><Link className="text-link" href={`/${entity}`}>Reset</Link></form></section><DataPanel title={`${meta.label} register`} count={data.count}><RecordTable entity={entity==='receivables'?'invoices':entity} rows={data.records} lookup={lookup}/><Pagination entity={entity} {...data} query={Object.fromEntries(Object.entries(query).filter(([key,v])=>key!=='page'&&v).map(([k,v])=>[k,v!]))}/></DataPanel></>;
}
function Action({action,id,path,label,next,reason=false}:{action:string;id:string;path:string;label:string;next?:string;reason?:boolean}){return <form action={financeWorkflow} className="finance-action"><input type="hidden" name="action" value={action}/><input type="hidden" name="id" value={id}/><input type="hidden" name="return" value={path}/>{next&&<input type="hidden" name="next_status" value={next}/>} {reason&&<input name="reason" placeholder="Required audit reason" required aria-label="Audit reason"/>}<button className="button secondary">{label}</button></form>;}
async function ChildRegister({entity,foreign,parent,profile,prefill={},create=true}:{entity:string;foreign:string;parent:string;profile:Profile;prefill?:Record<string,string>;create?:boolean}){
 if(!canAccess(profile.role,entity))return null;
 const data=await financeRead(entity,{[foreign]:parent},20);const lookup=await recordLookups(entity,data.records);const meta=getEntity(entity);
 const url=new URLSearchParams({...prefill,[foreign]:parent});
 return <DataPanel title={meta.label} count={data.count} action={create&&meta.create&&canAccess(profile.role,entity,true)?<Link className="button secondary" href={`/${entity}/new?${url}`}>Add {meta.singular.toLowerCase()}</Link>:undefined}><RecordTable entity={entity} rows={data.records} lookup={lookup}/>{data.count>20&&<Link className="text-link padded" href={`/${entity}?foreign=${foreign}&parent=${parent}`}>View all {data.count} records</Link>}</DataPanel>;
}
export async function FinanceDetail({entity,id,query,profile}:{entity:string;id:string;query:Query;profile:Profile}){
 const meta=getEntity(entity);const writable=canAccess(profile.role,entity,true);
 if(id==='new'){
  if(!writable||!meta.create)notFound();const lookup=await lookups(meta.fields.filter(f=>f.ref).map(f=>f.ref!));
  return <><PageHeader title={`New ${meta.singular.toLowerCase()}`} eyebrow="FINANCE · OMR" description="Amounts use three decimals. Calculated totals are verified before saving."/><Notice error={query.error}/><section className="panel form-panel"><RecordForm entity={entity} lookup={lookup} prefill={Object.fromEntries(meta.fields.filter(f=>query[f.key]).map(f=>[f.key,query[f.key]!]))}/></section></>;
 }
 const row=await getRecord(entity,id);if(!row)notFound();const lookup=await recordLookups(entity,[row]);const path=`/${entity}/${id}`;
 const editable=writable&&meta.edit&&(!['invoices','project_variations','service_charges','payments'].includes(entity)||['Draft','Recorded'].includes(row.status));
 return <><PageHeader title={row.name} eyebrow={row.code} description={`${meta.singular} · ${row.status}`} action={editable?<Link className="button secondary" href={`${path}/edit`}>Edit record</Link>:undefined}/><Notice error={query.error} success={query.success}/><div className="record-workflow-actions"><Badge value={row.status}/>
 {entity==='invoices'&&writable&&(row.status==='Draft'?<Action action="invoice-stage" id={id} path={path} next="Issued" label="Issue invoice"/>:row.status!=='Cancelled'&&<><Link className="button" href={`/payments/new?invoice_id=${id}`}>Record payment</Link><Action action="invoice-stage" id={id} path={path} next="Cancelled" label="Cancel invoice" reason/></>)}
 {entity==='payments'&&writable&&row.status==='Recorded'&&<Action action="payment-reverse" id={id} path={path} label="Reverse payment" reason/>}
 {entity==='project_variations'&&writable&&(row.status==='Draft'?<Action action="variation-stage" id={id} path={path} label="Submit variation" next="Submitted"/>:row.status==='Submitted'&&<><Action action="variation-stage" id={id} path={path} label="Approve variation" next="Approved"/><Action action="variation-stage" id={id} path={path} label="Reject variation" next="Rejected"/></>)}
 {entity==='service_charges'&&writable&&row.status==='Draft'&&<Action action="service-approve" id={id} path={path} label="Approve service charge"/>}
 </div><FinancialMetrics metrics={['subtotal','discount_amount','tax_amount','total','paid_amount','balance','amount','line_total','contract_value','base_value','total_cost'].filter(k=>row[k]!==undefined).map(k=>({label:k.replaceAll('_',' '),value:row[k],money:true}))}/><DataPanel title="Record details"><dl className="finance-detail-fields">{meta.fields.map(f=><div key={f.key}><dt>{f.label}</dt><dd>{display(entity,f.key,row,lookup)}</dd></div>)}{entity==='payments'&&<><div><dt>Recorded by</dt><dd>{String(row.recorded_by??'—')}</dd></div><div><dt>Reversal / adjustment reason</dt><dd>{String(row.reversal_reason??'—')}</dd></div></>}</dl></DataPanel>
 {entity==='invoices'&&<><ChildRegister entity="invoice_items" foreign="invoice_id" parent={id} profile={profile} create={row.status==='Draft'}/><ChildRegister entity="payments" foreign="invoice_id" parent={id} profile={profile} create={row.status!=='Draft'&&row.status!=='Cancelled'}/></>}
 {entity==='invoice_items'&&writable&&<Action action="invoice-delete-item" id={id} path={path} label="Remove draft invoice item"/>}
 {entity==='service_charges'&&row.status==='Approved'&&canAccess(profile.role,'invoices',true)&&<ServiceInvoiceForm work={String(row.work_order_id)} path={path}/>}
 </>;
}
function ServiceInvoiceForm({work,path}:{work:string;path:string}){return <DataPanel title="Bill this service job"><form action={financeWorkflow} className="finance-toolbar"><input type="hidden" name="action" value="service-invoice"/><input type="hidden" name="id" value={work}/><input type="hidden" name="return" value={path}/><label>Invoice date<input type="date" name="invoice_date" required/></label><label>Due date<input type="date" name="due_date" required/></label><button className="button">Create invoice from approved charge</button></form></DataPanel>;}
export async function LinkedFinancials({entity,row,profile}:{entity:string;row:RecordRow;profile:Profile}){
 const customer=String(entity==='customers'?row.id:row.customer_id);const prefill={customer_id:customer};
 if(entity==='customers'&&customerFinance(profile.role)){
  const summary=await financialOverview(row.id);return <><FinancialMetrics metrics={[{label:'Total quoted',value:summary.total_quoted,money:true},{label:'Approved value',value:summary.approved_value,money:true},{label:'Active project value',value:summary.active_project_value,money:true},{label:'Total invoiced',value:summary.invoiced,money:true},{label:'Total paid',value:summary.collected,money:true},{label:'Outstanding',value:summary.outstanding,money:true},{label:'Active AMC value',value:summary.amc_value,money:true},{label:'Overdue invoices',value:summary.overdue_invoices}]}/><ChildRegister entity="invoices" foreign="customer_id" parent={row.id} profile={profile}/><ChildRegister entity="payments" foreign="customer_id" parent={row.id} profile={profile} create={false}/><ChildRegister entity="quotations" foreign="customer_id" parent={row.id} profile={profile} create={false}/></>;
 }
 const parent=entity==='projects'?'project_id':entity==='amc_contracts'?'amc_id':'work_order_id';
 const source=entity==='projects'?'project_financial_summary':entity==='amc_contracts'?'amc_financial_summary':'service_charges';
 const result=await financeRead(source,{[parent]:row.id});const financial=result.records[0];
 return <>{financial?<><FinancialMetrics metrics={Object.keys(financial).filter(k=>moneyKeys.has(k)).map(k=>({label:k.replaceAll('_',' '),value:financial[k],money:true}))}/>{canAccess(profile.role,source==='project_financial_summary'?'project_financials':source==='amc_financial_summary'?'amc_financials':source,true)&&<Link className="button secondary" href={`/${source==='project_financial_summary'?'project_financials':source==='amc_financial_summary'?'amc_financials':source}/${financial.id}/edit`}>Edit financial values</Link>}</>:<p className="muted padded">Financial values have not been recorded or access has not been granted.</p>}
 {entity==='projects'&&<><ChildRegister entity="project_variations" foreign={parent} parent={row.id} profile={profile} prefill={prefill}/><ChildRegister entity="cost_records" foreign={parent} parent={row.id} profile={profile} prefill={prefill}/><p className="muted padded">Profit uses entered recognized revenue and recorded actual costs. Unrecorded costs and revenue remain blank.</p></>}
 {entity==='work_orders'&&<><ChildRegister entity="service_charges" foreign={parent} parent={row.id} profile={profile} prefill={prefill} create={!financial}/><ChildRegister entity="work_order_part_financials" foreign={parent} parent={row.id} profile={profile} prefill={prefill}/><ChildRegister entity="cost_records" foreign={parent} parent={row.id} profile={profile} prefill={prefill}/>{financial?.status==='Approved'&&canAccess(profile.role,'invoices',true)&&<ServiceInvoiceForm work={row.id} path={`/work_orders/${row.id}?tab=financials`}/>}</>}
 {canAccess(profile.role,'invoices')&&<ChildRegister entity="invoices" foreign={parent} parent={row.id} profile={profile} prefill={{...prefill,source_type:entity==='projects'?'Project':entity==='amc_contracts'?'AMC':'Service'}} create={entity!=='work_orders'}/>}</>;
}
