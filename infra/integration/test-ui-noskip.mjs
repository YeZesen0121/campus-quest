// Exercise the unchanged real guard with synthetic reports in a disposable tree.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../../", import.meta.url);
function check(file, describe, title) {
  const sandbox = mkdtempSync(join(tmpdir(), "cq-integration-noskip-"));
  try {
    for (const folder of ["scripts", "e2e", "test-results"]) mkdirSync(join(sandbox, folder));
    copyFileSync(new URL("frontend/scripts/assert-e2e-no-skips.mjs", root), join(sandbox, "scripts/guard.mjs"));
    copyFileSync(new URL("frontend/e2e/noskip-exemptions.mjs", root), join(sandbox, "e2e/noskip-exemptions.mjs"));
    writeFileSync(join(sandbox, "e2e", file), "// synthetic guard input\n");
    writeFileSync(join(sandbox, "test-results/report.json"), JSON.stringify({ suites: [{
      file, suites: [{ title: describe, specs: [{ title, tests: [{ results: [{ status: "skipped" }] }] }] }],
    }] }));
    return spawnSync(process.execPath, [join(sandbox, "scripts/guard.mjs")], { encoding: "utf8" });
  } finally {
    // mkdtemp's checked prefix is this invocation's only cleanup target.
    assert.ok(sandbox.startsWith(join(tmpdir(), "cq-integration-noskip-")));
    rmSync(sandbox, { recursive: true });
  }
}

for (const [file, describe, title] of [
  ["notifications.spec.ts", "owner mark-read (the §28 owner-only surface)", "marking a row read flips it in place and drops it from the unread tab"],
  ["rewards-ranking.spec.ts", "student rewards redemption", "insufficient spendable disables the tile CTA with the quiet distance"],
]) {
  test(`removed prerequisite exemption stays rejected: ${file}`, () => {
    const result = check(file, describe, title);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /1 UNEXEMPTED skip/);
    assert.doesNotMatch(result.stdout, /exempted:/);
  });
}

for (const surface of ["home at 390", "workspace at 390", "home at 1440", "workspace at 1440"]) {
  test(`R6 dedicated visual exemption retained: ${surface}`, () => {
    const result = check("innovation-collaboration-visual.spec.ts", "", `R6 visual: ${surface}`);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /exempted:/);
  });
}
