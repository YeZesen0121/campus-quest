// Pure rejection probes: the child command never connects to external services.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const launch = fileURLToPath(new URL("launch.sh", import.meta.url));
const cases = [
  ["DATABASE_URL", "postgresql+asyncpg://test:unused@127.0.0.1:15432/campusquest_test"],
  ["DATABASE_URL", "postgresql+asyncpg://test:unused@127.0.0.1:16440/another_database"],
  ["REDIS_URL", "redis://127.0.0.1:6379/0"],
  ["S3_ENDPOINT_URL", "http://127.0.0.1:9125"],
  ["S3_BUCKET", "campusquest-test-r6"],
  ["CQ_E2E_DATABASE_URL", "postgresql+asyncpg://test:unused@127.0.0.1:16438/campusquest_test_r6"],
  ["CQ_E2E_REDIS_URL", "redis://127.0.0.1:6477/1"],
  ["CQ_E2E_S3_ENDPOINT_URL", "https://127.0.0.1:9126"],
  ["CQ_E2E_S3_BUCKET", "campusquest-test-ui"],
  ["CQ_E2E_BASE_URL", "https://localhost:3307"],
  ["CQ_INTEGRATION_ID", "different-owner"],
];

for (const [key, value] of cases) {
  test(`rejects foreign ${key} before invoking the command (${value.includes("another_database") ? "name" : "owner"})`, () => {
    const child = spawnSync("bash", [launch, "node", "-e", 'console.log("COMMAND_REACHED")'], {
      env: { ...process.env, [key]: value }, encoding: "utf8",
    });
    const output = `${child.stdout}${child.stderr}`;
    assert.notEqual(child.status, 0, `${key} was allowed`);
    assert.match(output, /isolation guard rejected/);
    assert.doesNotMatch(output, /COMMAND_REACHED/);
  });
}

test("accepts owned resources and preserves spaced arguments", () => {
  const child = spawnSync("bash", [launch, "node", "-e", "console.log(JSON.stringify(process.argv.slice(1)))", "a b", "-m"], {
    env: process.env, encoding: "utf8",
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /\["a b","-m"\]/);
});
