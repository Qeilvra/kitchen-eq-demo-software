import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [name, width, height] of [
    ["login-desktop", 1440, 900],
    ["login-mobile", 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
    const overflowing = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflowing) throw new Error(`${name} has horizontal overflow`);
    console.log(`${name}: rendered with no horizontal overflow`);
    await page.close();
  }
} finally {
  await browser.close();
}
