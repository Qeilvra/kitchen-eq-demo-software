import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";

const [stage = "before", base = "http://localhost:3001", repetitions = "3"] = process.argv.slice(2);
const output = "artifacts/page-performance";
mkdirSync(output, { recursive: true });
const { password } = JSON.parse(readFileSync("demo-credentials.local.json", "utf8"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (process.env.PREVIEW_COOKIE_JAR) {
    const cookies = readFileSync(process.env.PREVIEW_COOKIE_JAR, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && (!line.startsWith("#") || line.startsWith("#HttpOnly_")))
      .map((line) => {
        const [domain, , path, secure, expires, name, value] = line
          .replace(/^#HttpOnly_/, "")
          .split("\t");
        return {
          domain,
          path,
          secure: secure === "TRUE",
          expires: Number(expires) || -1,
          name,
          value,
          httpOnly: line.startsWith("#HttpOnly_"),
        };
      });
    await page.context().addCookies(cookies);
  }
  await page.route("**/*", (route) => {
    if (route.request().headers()["next-router-prefetch"] === "1") return route.abort();
    return route.continue();
  });
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) =>
      window.__longTasks.push(...list.getEntries().map((entry) => entry.duration)),
    ).observe({ type: "longtask", buffered: true });
  });
  await page.goto(`${base}/login`);
  await page.getByLabel("Email address").fill("admin@airmech.demo");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in to workspace/ }).click();
  await page.waitForURL("**/dashboard", { timeout: 60000 });
  await page.locator("main h1").waitFor({ timeout: 60000 });
  for (const path of [
    "/dashboard",
    "/customers",
    "/enquiries",
    "/quotations",
    "/complaints",
    "/equipment",
    "/invoices",
    "/reports?report=quotations",
  ]) {
    for (let run = 0; run < Number(repetitions); run++) {
      const started = Date.now();
      const response = await page.goto(base + path, { waitUntil: "load", timeout: 60000 });
      await page.locator("main h1").waitFor({ timeout: 60000 });
      if (page.url().includes("/login")) throw new Error("Authentication failed");
      const finished = Date.now();
      const documentBytes = (await response.body()).byteLength;
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        return {
          ttfbMs: navigation.responseStart - navigation.requestStart,
          responseMs: navigation.responseEnd - navigation.requestStart,
          loadMs: navigation.loadEventEnd - navigation.startTime,
          encodedDocumentBytes: navigation.encodedBodySize,
          scriptBytes: resources
            .filter((entry) => entry.initiatorType === "script")
            .reduce((sum, entry) => sum + entry.encodedBodySize, 0),
          imageBytes: resources
            .filter(
              (entry) =>
                entry.initiatorType === "img" || /\.(webp|png|jpe?g|svg)(\?|$)/.test(entry.name),
            )
            .reduce((sum, entry) => sum + entry.encodedBodySize, 0),
          longTaskMs: window.__longTasks.reduce((sum, duration) => sum + duration, 0),
          serverRegion: document.documentElement.dataset.region,
        };
      });
      const headers = response.headers();
      const traces =
        base.includes("localhost") && existsSync(`${output}/fetches.jsonl`)
          ? readFileSync(`${output}/fetches.jsonl`, "utf8")
              .trim()
              .split("\n")
              .filter(Boolean)
              .map(JSON.parse)
              .filter((event) => event.started >= started && event.started <= finished)
          : [];
      results.push({
        path,
        run,
        started,
        finished,
        contentReadyMs: finished - started,
        documentBytes,
        ...metrics,
        vercelId: headers["x-vercel-id"],
        traces,
      });
      console.log(
        `${stage} ${path} ${run + 1}: content ${finished - started}ms, server response ${Math.round(metrics.responseMs)}ms, ${traces.length} backend requests`,
      );
    }
  }
  writeFileSync(
    `${output}/${stage}.json`,
    JSON.stringify({ base, measuredAt: new Date().toISOString(), results }, null, 2),
  );
} finally {
  await browser.close();
}
