import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { DEMO_PROJECT } from "./demo-data";

export async function financeDatabase() {
  const raw = process.env.SUPABASE_DB_URL;
  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw || !endpoint) throw new Error("SUPABASE_DB_URL and NEXT_PUBLIC_SUPABASE_URL are required.");
  const url = new URL(raw);
  if (process.env.DEMO_PROJECT_REF !== DEMO_PROJECT || new URL(endpoint).hostname !== `${DEMO_PROJECT}.supabase.co` ||
      (!url.hostname.includes(DEMO_PROJECT) && !decodeURIComponent(url.username).includes(DEMO_PROJECT)))
    throw new Error("Refusing a database outside the dedicated AIRMECH demo project.");
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  const db = new Client({ connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: await readFile(process.env.SUPABASE_DB_CA_FILE || "supabase/certs/prod-ca-2021.crt", "utf8") },
    connectionTimeoutMillis: 20000 });
  await db.connect();
  return db;
}
