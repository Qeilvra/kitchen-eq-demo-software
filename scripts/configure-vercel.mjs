import { spawnSync } from "node:child_process";
import { join } from "node:path";
const cli = join(process.env.APPDATA, "npm", "node_modules", "vercel", "dist", "index.js");
for (const scope of ["production", "preview"])
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is missing`);
    const result = spawnSync(process.execPath, [cli, "env", "add", name, scope, "--yes"], {
      input: value + "\n",
      encoding: "utf8",
      cwd: process.cwd(),
    });
    if (result.status !== 0) {
      console.error(`${name}/${scope} failed: ${result.stderr?.replaceAll(value, "[redacted]")}`);
      process.exit(1);
    }
    console.log(`${name} configured for ${scope}.`);
  }
