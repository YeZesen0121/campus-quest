/**
 * Owner-invariant probe (PR #10 review → frontend half): two pages in
 * ONE context cold-starting simultaneously must produce EXACTLY ONE
 * POST /auth/refresh per wave and end both AUTHED. Opt-in via
 * CQ_E2E_PROBE=1 (never part of the release gate).
 */
import { expect, test } from "@playwright/test";
import { loginThroughUi } from "./fixtures";

const PROBE = process.env.CQ_E2E_PROBE === "1";

// P2 (review): the orchestrated world (CQ_E2E_STUDENT for the probe's
// login) is seeded by global-setup only under CQ_E2E=1 — so the probe
// requires BOTH flags. The guard names them instead of silently
// skipping on a half-configured run.
test.skip(
  !PROBE,
  "invariant probe is opt-in: set CQ_E2E=1 (seeds the world) AND CQ_E2E_PROBE=1",
);
if (PROBE && process.env.CQ_E2E !== "1") {
  throw new Error("CQ_E2E_PROBE=1 also needs CQ_E2E=1 — the world seed gates on it");
}

test("one rotation per cold-start wave; both tabs authed", async ({ browser }) => {
  const ctx = await browser.newContext();
  // Session cookie via the seeded student's UI login.
  const boot = await ctx.newPage();
  const student = process.env.CQ_E2E_STUDENT ?? "";
  const [username, password] = student.split(":");
  await loginThroughUi(boot, { username, password });
  await boot.close();

  // THE WAVE: two fresh pages (token-less memory each), same jar, same tick.
  const p1 = await ctx.newPage();
  const p2 = await ctx.newPage();
  const refreshes: string[] = [];
  for (const [page, tag] of [[p1, "T1"], [p2, "T2"]] as const) {
    page.on("response", (r) => {
      if (r.url().includes("/auth/refresh")) {
        refreshes.push(`${tag}:${r.status()}`);
      }
    });
  }
  await Promise.all([
    p1.goto("/", { waitUntil: "domcontentloaded" }),
    p2.goto("/tasks", { waitUntil: "domcontentloaded" }),
  ]);
  await p1.waitForTimeout(6000);

  console.log("WAVE_REFRESHES:", JSON.stringify(refreshes), "COUNT:", refreshes.length);
  // The invariant: exactly one rotation serves the whole wave.
  expect(refreshes, "one POST /auth/refresh per cold-start wave").toHaveLength(1);
  await expect(p1.getByRole("heading", { name: "首页", level: 1, exact: true })).toBeVisible();
  await expect(p2.getByRole("heading", { name: "任务广场", level: 1, exact: true })).toBeVisible({ timeout: 10_000 });
  console.log("INVARIANT PASS: one rotation per wave, both tabs authed");
});
