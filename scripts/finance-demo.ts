import {createClient} from '@supabase/supabase-js';
import {Client} from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {accounts,DEMO_PROJECT,DEMO_TENANT,seedId} from './demo-data';
// Additive examples only: no reset, no password rotation, no overwrite of edited records.
const raw=process.env.SUPABASE_DB_URL,url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!raw||!url||!key)throw new Error('Demo database credentials are required.');
const connection=new URL(raw);if(process.env.DEMO_PROJECT_REF!==DEMO_PROJECT||new URL(url).hostname!==`${DEMO_PROJECT}.supabase.co`||(!connection.hostname.includes(DEMO_PROJECT)&&!decodeURIComponent(connection.username).includes(DEMO_PROJECT)))throw new Error('Refusing a target outside the dedicated Airmech demo.');
const credentials=JSON.parse(await readFile('demo-credentials.local.json','utf8'));const auth=createClient(url,key,{auth:{persistSession:false}});
const profiles:Record<string,string>={};
for(const account of accounts){
 const {data:existing,error}=await auth.from('profiles').select('id,role').eq('tenant_id',DEMO_TENANT).eq('role',account.role).limit(1);if(error)throw new Error(error.message);
 if(existing?.length){profiles[account.role]=existing[0].id;continue;}
 if(!['owner_director','accounts_finance','project_manager'].includes(account.role))throw new Error('Seed the operational demo first.');
 const {data:users,error:usersError}=await auth.auth.admin.listUsers({perPage:1000});if(usersError)throw new Error(usersError.message);let user=users.users.find(u=>u.email===account.email);
 if(user&&user.app_metadata.airmech_demo_tenant!==DEMO_TENANT)throw new Error('An existing account is outside this demo.');
 if(!user){const {data,error}=await auth.auth.admin.createUser({email:account.email,password:credentials.password,email_confirm:true,user_metadata:{full_name:account.name},app_metadata:{airmech_demo_tenant:DEMO_TENANT}});if(error||!data.user)throw new Error('Unable to create the demo finance account.');user=data.user;}
 const {error:profileError}=await auth.from('profiles').insert({id:user.id,tenant_id:DEMO_TENANT,full_name:account.name,role:account.role});if(profileError)throw new Error(profileError.message);profiles[account.role]=user.id;
}
for(const parameter of ['sslmode','sslcert','sslkey','sslrootcert'])connection.searchParams.delete(parameter);
const db=new Client({connectionString:connection.toString(),ssl:{rejectUnauthorized:true,ca:await readFile(process.env.SUPABASE_DB_CA_FILE||'supabase/certs/prod-ca-2021.crt','utf8')},connectionTimeoutMillis:20000});await db.connect();
const date=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
async function insert(table:string,row:Record<string,unknown>){const keys=Object.keys(row);return (await db.query(`insert into public.${table}(${keys.join(',')}) values(${keys.map((_,i)=>`$${i+1}`).join(',')}) on conflict(id) do nothing returning id`,keys.map(k=>row[k]))).rows.length>0;}
const base=(group:number,index:number,code:string,name:string)=>({id:seedId(group,index),tenant_id:DEMO_TENANT,code,name});
try{
 await db.query('begin');await db.query("select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub',$1,true)",[profiles.super_admin]);
 const location=(await db.query('select s.id site,s.customer_id customer from public.sites s where s.tenant_id=$1 order by s.code limit 1',[DEMO_TENANT])).rows[0];if(!location)throw new Error('Operational customer/site records are required.');const {site,customer}=location;
 const examples=[['Small maintenance quotation','650.000','Draft'],['BMS controls upgrade','6400.000','Sent'],['Chiller refurbishment','75000.000','Approved'],['MEP installation and airside upgrade','18500.000','Approved'],['Marine equipment overhaul','25000.000','Follow-Up']];
 for(let i=0;i<examples.length;i++){
  const [name,amount,status]=examples[i],q=seedId(70,i);
  if(await insert('quotations',{...base(70,i,`QTN-FIN-${i+1}`,name),customer_id:customer,site_id:site,quotation_date:date(-25+i*3),valid_until:date(20+i*7),status})){await insert('quotation_items',{...base(71,i,`ITM-FIN-${i+1}`,name),quotation_id:q,quantity:'1.000',unit:'Job',unit_price:amount,discount:'0',tax:'0'});}
  if(status==='Approved'){
   const p=seedId(72,i);if(await insert('projects',{...base(72,i,`PRJ-FIN-${i+1}`,name),customer_id:customer,site_id:site,quotation_id:q,status:'Active',manager_id:profiles.project_manager,start_date:date(-15),target_date:date(40),progress:45})){await db.query("update public.project_financials set estimated_cost=$2,recognized_revenue=$3,notes='Coherent finance demonstration' where project_id=$1",[p,i===3?'12000.000':'52000.000',i===3?'18000.000':null]);}
   await db.query('insert into public.project_finance_access(tenant_id,profile_id,project_id,can_view,can_record_costs) values($1,$2,$3,true,true) on conflict do nothing',[DEMO_TENANT,profiles.project_manager,p]);
  }
 }
 const project=seedId(72,3);await insert('project_variations',{...base(73,0,'VAR-FIN-1','Approved additional controls'),project_id:project,customer_id:customer,amount:'2500.000',status:'Approved',variation_date:date(-12),approved_at:`${date(-10)}T12:00:00+04:00`,approved_by:profiles.super_admin});
 await insert('cost_records',{...base(74,0,'COST-FIN-1','Installed materials'),customer_id:customer,project_id:project,cost_type:'Materials',cost_date:date(-10),quantity:'1.000',unit_cost:'6800.000',recorded_by:profiles.accounts_finance});
 await insert('cost_records',{...base(74,1,'COST-FIN-2','Installation labour'),customer_id:customer,project_id:project,cost_type:'Labour',cost_date:date(-8),quantity:'40.000',unit_cost:'50.000',recorded_by:profiles.accounts_finance});
 for(let i=0;i<3;i++){const amc=seedId(75,i);if(await insert('amc_contracts',{...base(75,i,`AMC-FIN-${i+1}`,['Annual building services AMC','BMS maintenance agreement','Marine maintenance contract'][i]),customer_id:customer,site_id:site,status:'Active',start_date:date(-180),end_date:date([20,80,160][i]),frequency:'Quarterly',planned_visits:4,next_visit:date(12)})){await db.query('update public.amc_financials set contract_value=$2,billing_frequency=$3,renewal_value=$4 where amc_id=$1',[amc,['12000.000','6000.000','9000.000'][i],'Quarterly',['12500.000','6500.000','9500.000'][i]]);}}
 const asset=seedId(76,0),complaint=seedId(77,0),work=seedId(78,0),engineer=(await db.query('select id from public.engineers where tenant_id=$1 order by code limit 1',[DEMO_TENANT])).rows[0].id;
 await insert('equipment',{...base(76,0,'AST-FIN-1','Paid-service air handling unit'),customer_id:customer,site_id:site,type:'Air Handling Unit',brand:'Airmech demo',warranty_end:date(-365),status:'Active'});
 await insert('complaints',{...base(77,0,'CMP-FIN-1','Fan drive repair'),customer_id:customer,site_id:site,equipment_id:asset,problem:'Fan drive requires replacement',priority:'Normal',status:'Resolved',engineer_id:engineer});
 await insert('work_orders',{...base(78,0,'WO-FIN-1','Completed fan drive repair'),customer_id:customer,site_id:site,equipment_id:asset,complaint_id:complaint,engineer_id:engineer,scheduled_at:`${date(-7)}T10:00:00+04:00`,status:'Completed',diagnosis:'Worn drive components',work_performed:'Replaced drive components',customer_confirmation:'Demonstration acceptance',priority:'Normal'});
 await insert('work_order_parts',{...base(79,0,'PRT-FIN-1','Drive component'),work_order_id:work,quantity:'2.000',unit:'Each',status:'Used'});
 await insert('work_order_part_financials',{...base(80,0,'PARTF-FIN-1','Drive component pricing'),part_id:seedId(79,0),work_order_id:work,customer_id:customer,unit_cost:'35.000',unit_sell_price:'50.000',chargeable:true});
 await insert('service_charges',{...base(81,0,'SC-FIN-1','Paid service repair charge'),customer_id:customer,work_order_id:work,inspection_fee:'20.000',labour_charge:'150.000',parts_charge:'0',recorded_parts_charge:'100.000',other_charges:'10.000',discount:'0',tax:'0',status:'Approved',approved_by:profiles.super_admin,approved_at:`${date(-6)}T12:00:00+04:00`});
 const sources=[{source_type:'Project',project_id:project},{source_type:'Project',project_id:project},{source_type:'AMC',amc_id:seedId(75,0)},{source_type:'Service',work_order_id:work}];
 for(let i=0;i<4;i++){const invoice=seedId(82,i),amount=['10000.000','8000.000','3000.000','280.000'][i];if(await insert('invoices',{...base(82,i,`INV-FIN-${i+1}`,['MEP progress billing 1','MEP progress billing 2','Quarterly AMC billing','Paid service repair'][i]),customer_id:customer,...sources[i],invoice_date:date(-35+i*5),due_date:date([-10,-5,5,15][i])})){await insert('invoice_items',{...base(83,i,`INVITM-FIN-${i+1}`,'Approved work / service'),invoice_id:invoice,quantity:'1',unit:'Job',unit_price:amount,discount:'0',tax:'0'});await db.query("update public.invoices set status='Issued',issued_at=now(),issued_by=$2 where id=$1",[invoice,profiles.accounts_finance]);}}
 const paymentValues=[['0','4000.000'],['0','6000.000'],['1','3000.000'],['2','3000.000'],['3','100.000']];
 for(let i=0;i<paymentValues.length;i++){const [invoiceIndex,amount]=paymentValues[i];await insert('payments',{...base(84,i,`PAY-FIN-${i+1}`,'Bank transfer collection'),invoice_id:seedId(82,Number(invoiceIndex)),customer_id:customer,payment_date:date(-20+i*3),amount,method:'Bank Transfer',transaction_reference:`DEMO-TRANSFER-${i+1}`,recorded_by:profiles.accounts_finance,request_id:seedId(85,i),request_fingerprint:`finance-demo-${i}`,status:'Recorded'});}
 await db.query("update public.service_charges set status='Invoiced' where id=$1 and status='Approved'",[seedId(81,0)]);
 await db.query('commit');
 await writeFile('demo-credentials.local.json',JSON.stringify({...credentials,accounts:accounts.map(a=>({email:a.email,role:a.role}))},null,2),{mode:0o600});
 console.log('Finance demo ready: Owner, Accounts and Project Manager accounts; coherent quotations, variations, AMC values, parts costs, invoices and partial/full payments. Credentials remain in the ignored local file.');
}catch(error){await db.query('rollback');throw error;}finally{await db.end();}
