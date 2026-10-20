import assert from "node:assert/strict";
import test from "node:test";

test("Playwright server and world use the same independent object store", async () => {
  process.env.CQ_E2E_S3_ENDPOINT_URL = "https://127.0.0.1:19136";
  process.env.CQ_E2E_S3_BUCKET = "integration-isolation-contract";
  process.env.CQ_E2E_S3_CA_BUNDLE = "/tmp/integration-isolation-contract.crt";
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
