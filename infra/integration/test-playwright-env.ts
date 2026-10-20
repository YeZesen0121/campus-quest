import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("Playwright server and world use the same independent object store", async (t) => {
  // I1 now rejects missing explicit CAs. Exercise a real owned CA override,
  // preserving that fail-closed behavior instead of supplying a fake path.
  const originalCA = process.env.CQ_E2E_S3_CA_BUNDLE;
  assert.ok(originalCA && existsSync(originalCA), "owned integration CA is required");
  const directory = mkdtempSync(join(tmpdir(), "cq-integration-env-"));
  t.after(() => {
    assert.ok(directory.startsWith(join(tmpdir(), "cq-integration-env-")));
    rmSync(directory, { recursive: true });
  });
  const overrideCA = join(directory, "override.crt");
  copyFileSync(originalCA, overrideCA);
  process.env.CQ_E2E_S3_ENDPOINT_URL = "https://127.0.0.1:19136";
  process.env.CQ_E2E_S3_BUCKET = "integration-isolation-contract";
  process.env.CQ_E2E_S3_CA_BUNDLE = overrideCA;
  process.env.CQ_E2E_S3_ACCESS_KEY = "isolated-access";
  process.env.CQ_E2E_S3_SECRET_KEY = "isolated-secret";
  const { backendEnv } = await import("../../frontend/e2e/global-setup");
  const { default: config } = await import("../../frontend/playwright.config");
  assert.ok(Array.isArray(config.webServer));
  const serverEnv = config.webServer[0].env;
  for (const environment of [backendEnv, serverEnv]) {
    assert.equal(environment?.S3_ENDPOINT_URL, process.env.CQ_E2E_S3_ENDPOINT_URL);
    assert.equal(environment?.S3_BUCKET, process.env.CQ_E2E_S3_BUCKET);
    assert.equal(environment?.AWS_CA_BUNDLE, process.env.CQ_E2E_S3_CA_BUNDLE);
    assert.equal(environment?.S3_ACCESS_KEY, process.env.CQ_E2E_S3_ACCESS_KEY);
    assert.equal(environment?.S3_SECRET_KEY, process.env.CQ_E2E_S3_SECRET_KEY);
  }
  assert.equal(config.webServer[0].reuseExistingServer, false);
  assert.equal(config.webServer[1].reuseExistingServer, false);
});
