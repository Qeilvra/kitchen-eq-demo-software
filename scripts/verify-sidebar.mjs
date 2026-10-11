import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const output = "artifacts/sidebar";
mkdirSync(output, { recursive: true });
const { password } = JSON.parse(readFileSync("demo-credentials.local.json", "utf8"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email address").fill("admin@airmech.demo");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in to workspace/ }).click();
  await page.waitForURL("**/dashboard", { timeout: 60000 });
  await page.locator(".sidebar .workspace-nav a.active").waitFor();
  await page.locator("main h1").waitFor({ timeout: 60000 });
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [1280, 800],
  ]) {
    await page.setViewportSize({ width, height });
    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector(".sidebar");
      const nav = sidebar.querySelector(".workspace-nav");
      const brand = sidebar.querySelector(".brand-link");
      const footer = sidebar.querySelector(".sidebar-bottom");
      const row = nav.querySelector("a");
      const style = getComputedStyle(row);
      const rows = [...nav.querySelectorAll("a")];
      nav.scrollTop = 0;
      const fixed = [brand, footer].map((node) => node.getBoundingClientRect().top);
      nav.scrollTop = nav.scrollHeight;
      const admin = nav.querySelector('a[href="/settings"]').getBoundingClientRect();
      const viewport = nav.getBoundingClientRect();
      const frozen = [brand, footer].every(
        (node, index) => node.getBoundingClientRect().top === fixed[index],
      );
      const adminReachable = admin.top >= viewport.top && admin.bottom <= viewport.bottom;
      nav.scrollTop = 0;
      const subtitle = sidebar.querySelector(".brand-subtitle");
      return {
        width: sidebar.getBoundingClientRect().width,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        regularFontWeight: getComputedStyle(nav.querySelector('a[href="/customers"]')).fontWeight,
        iconSize: row.querySelector("svg").getBoundingClientRect().width,
        rowHeight: row.getBoundingClientRect().height,
        gap: style.gap,
        headingPadding: getComputedStyle(nav.querySelector(".nav-group-label")).padding,
        brandHeight: brand.getBoundingClientRect().height,
        footerHeight: footer.getBoundingClientRect().height,
        navHeight: nav.clientHeight,
        navScrollHeight: nav.scrollHeight,
        sidebarOverflow: getComputedStyle(sidebar).overflowY,
        frozen,
        adminReachable,
        subtitleFits:
          subtitle.getBoundingClientRect().right < sidebar.getBoundingClientRect().right - 8,
        labelsFit: rows.every((node) => node.scrollWidth <= node.clientWidth),
        groups: [...nav.querySelectorAll(".nav-group-label")].map((node) => node.textContent),
        destinations: rows.map((node) => node.getAttribute("href")),
        activeBackground: getComputedStyle(nav.querySelector(".active")).backgroundColor,
      };
    });
    assert.equal(metrics.width, 280);
    assert.equal(metrics.rowHeight, 44);
    assert.equal(metrics.iconSize, 21);
    assert.equal(metrics.fontSize, "14px");
    assert.equal(metrics.regularFontWeight, "500");
    assert.equal(metrics.headingPadding, "0px 12px");
    assert.ok(
      metrics.frozen && metrics.adminReachable && metrics.labelsFit && metrics.subtitleFits,
    );
    assert.deepEqual(metrics.groups, [
      "OPERATIONS",
      "COMMERCIAL",
      "SERVICE",
      "FINANCE",
      "INTELLIGENCE",
      "SYSTEM",
    ]);
    await page.screenshot({ path: `${output}/${width}x${height}.png`, caret: "initial" });
    results.push({ viewport: `${width}x${height}`, ...metrics });
    console.log(
      `${width}x${height}: sidebar fits; labels fit; brand/footer fixed; Admin reachable`,
    );
  }
  await page.locator('.sidebar a[href="/customers"]').hover();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.sidebar a[href="/customers"]')).color ===
      "rgb(255, 255, 255)",
  );
  await page.goto("http://localhost:3000/settings");
  await page.locator('.sidebar a[href="/settings"][aria-current="page"]').waitFor();
  await page.waitForFunction(() => {
    const nav = document.querySelector(".sidebar > .workspace-nav").getBoundingClientRect();
    const active = document
      .querySelector('.sidebar a[aria-current="page"]')
      .getBoundingClientRect();
    return active.top >= nav.top && active.bottom <= nav.bottom;
  });
  await page.screenshot({ path: `${output}/active-admin.png`, caret: "initial" });
  console.log("Admin active state automatically revealed after navigation");
  for (const [width, height, mobile] of [
    [1024, 768, false],
    [768, 1024, false],
    [390, 844, true],
    [360, 800, true],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.locator(".sidebar").isVisible(), false);
    const trigger = mobile
      ? page.locator(".bottom-more-toggle")
      : page.locator(".topbar .mobile-menu-toggle");
    if (mobile) assert.equal(await page.locator(".app-shell > .bottom-nav").isVisible(), true);
    await trigger.click();
    const drawer = page.locator(".mobile-more");
    await drawer.waitFor();
    const fits = await drawer.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return (
        box.left >= 0 &&
        box.right <= innerWidth &&
        box.bottom <= innerHeight &&
        node.scrollWidth <= node.clientWidth
      );
    });
    assert.ok(fits, "Navigation drawer must fit the viewport");
    await page.screenshot({ path: `${output}/${width}x${height}-drawer.png`, caret: "initial" });
    await page.keyboard.press("Escape");
    assert.equal(await drawer.count(), 0);
    results.push({
      viewport: `${width}x${height}`,
      sidebarHidden: true,
      bottomNavigation: mobile,
      drawerFits: fits,
      escapeCloses: true,
    });
    console.log(
      `${width}x${height}: ${mobile ? "bottom navigation + More" : "toggle navigation"}; drawer fits and closes with Escape`,
    );
  }
  writeFileSync(`${output}/metrics.json`, JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
