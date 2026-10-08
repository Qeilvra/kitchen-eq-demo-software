import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { DEMO_PROJECT } from "./demo-data";
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString)
  throw new Error("Set SUPABASE_DB_URL in .env.local. No database changes were made.");
const url = new URL(connectionString);
if (
  process.env.DEMO_PROJECT_REF !== DEMO_PROJECT ||
  (!url.hostname.includes(DEMO_PROJECT) && !decodeURIComponent(url.username).includes(DEMO_PROJECT))
)
  throw new Error("The database target does not match the dedicated AIRMECH demo project.");
if (!["postgres:", "postgresql:"].includes(url.protocol))
  throw new Error("Use a Supabase PostgreSQL connection URL.");
console.log("Migration target: configured AIRMECH Supabase project (connection details hidden).");
const ca = await readFile(
  process.env.SUPABASE_DB_CA_FILE || "supabase/certs/prod-ca-2021.crt",
  "utf8",
);
// pg's connection-string SSL options otherwise replace the explicit verified TLS configuration.
for (const parameter of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
  url.searchParams.delete(parameter);
const client = new Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: true, ca },
  connectionTimeoutMillis: 20000,
});
await client.connect();
try {
  await client.query(
    "create schema if not exists airmech_meta; create table if not exists airmech_meta.migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())",
  );
  const files = (await readdir("supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const source = await readFile(`supabase/migrations/${file}`, "utf8");
    const hash = createHash("sha256").update(source).digest("hex");
    const previous = await client.query(
      "select checksum from airmech_meta.migrations where name=$1",
      [file],
    );
    if (previous.rows.length) {
      if (previous.rows[0].checksum !== hash)
        throw new Error(`Applied migration ${file} changed. Create a new migration.`);
      console.log(`Already applied: ${file}`);
      continue;
    }
    await client.query("begin");
    try {
      await client.query(source.replace(/^begin;\s*|\s*commit;\s*$/gm, ""));
      await client.query("insert into airmech_meta.migrations(name,checksum) values($1,$2)", [
        file,
        hash,
      ]);
      await client.query("commit");
      console.log(`Applied: ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
