import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString)
  throw new Error("Set SUPABASE_DB_URL in .env.local. No database changes were made.");
const url = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(url.protocol))
  throw new Error("Use a Supabase PostgreSQL connection URL.");
console.log(`Migration target: ${url.hostname} / ${url.pathname.slice(1)}`);
const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
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
