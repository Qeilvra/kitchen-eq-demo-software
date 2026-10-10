import { financeDatabase } from "./finance-db";
import { cleanupFinanceLiveFixture } from "./finance-live-fixture";
import { DEMO_TENANT } from "./demo-data";
const label=process.argv[2];
if(!label?.startsWith("Finance closeout "))throw new Error("Supply the exact disposable fixture label.");
const db=await financeDatabase();
let rows:{id:string;name:string}[];
try{rows=(await db.query<{id:string;name:string}>("select id,name from public.customers where name=$1 and tenant_id=$2",[label,DEMO_TENANT])).rows;}finally{await db.end();}
for(const row of rows)await cleanupFinanceLiveFixture({customer:row.id,label:row.name});
console.log(`Cleaned ${rows.length} matching disposable fixture(s).`);
