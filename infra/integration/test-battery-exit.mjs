// Run directly outside the wrapper: these tests exercise only local subprocesses.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const root = fileURLToPath(new URL(".runtime/battery-selfproof/", import.meta.url));
mkdirSync(root, { recursive: true });
const base = mkdtempSync(join(root, "proof-"));
const helper = fileURLToPath(new URL("run-battery.sh", import.meta.url));
const fixture = join(base, "commands.mjs");
writeFileSync(fixture, `
import {readFileSync, writeFileSync, existsSync, unlinkSync} from 'node:fs';
import {dirname, join} from 'node:path';
const [mode, path, tag, code, write] = process.argv.slice(2);
if (mode === 'browser') {
  const image = join(dirname(path), 'viewport.png');
  if (existsSync(image)) unlinkSync(image);
  if (write === 'yes') {
    writeFileSync(path, JSON.stringify({tag}));
    // Screenshots written via testInfo.outputPath need not be JSON attachments.
    writeFileSync(image, Buffer.from('attachment:' + tag));
  }
}
if (mode === 'guard' && existsSync(path)) {
  if (JSON.parse(readFileSync(path)).tag !== tag) process.exit(33);
}
console.log(mode + ':' + tag);
process.exit(Number(code));
`);

const source = join(base, "current-results", "report.json");
mkdirSync(dirname(source));
const scenarios = [
  { tag: "both-success", browser: 0, guard: 0, write: true, expected: 0 },
  { tag: "browser-fails", browser: 7, guard: 0, write: true, expected: 7 },
  { tag: "guard-fails", browser: 0, guard: 9, write: true, expected: 9 },
  { tag: "fresh-report", browser: 0, guard: 0, write: true, expected: 0 },
  { tag: "missing-report", browser: 0, guard: 0, write: false, expected: 1 },
];

for (const row of scenarios) {
  test(row.tag, () => {
    const output = join(base, row.tag);
    const arguments_ = [helper, output, source,
      "--browser", process.execPath, fixture, "browser", source, row.tag, String(row.browser), row.write ? "yes" : "no",
      "--guard", process.execPath, fixture, "guard", join(output, "report.json"), row.tag, String(row.guard), "no",
    ];
    const child = spawnSync("bash", existsSync(helper) ? arguments_ : [fileURLToPath(new URL("run.sh", import.meta.url)), "battery"], { encoding: "utf8" });
    assert.equal(child.status, row.expected, `${child.stdout}\n${child.stderr}`);
    const result = JSON.parse(readFileSync(join(output, "result.json"), "utf8"));
    assert.equal(result.browser_exit, row.browser);
    assert.equal(result.guard_exit, row.guard);
    if (row.write) {
      assert.equal(JSON.parse(readFileSync(join(output, "report.json"))).tag, row.tag);
      // A later Playwright invocation removes its output. The archive must
      // still retain screenshots, including those absent from JSON attachments.
      unlinkSync(join(dirname(source), "viewport.png"));
      const image = readFileSync(join(output, "test-results", "viewport.png"));
      assert.equal(image.toString(), "attachment:" + row.tag);
      const manifestPath = join(output, "artifacts-manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const saved = manifest.files.find(file => file.path === "viewport.png");
      assert.equal(saved.sha256, createHash("sha256").update(image).digest("hex"));
      assert.equal(saved.bytes, image.length);
      assert.equal(result.artifacts_preserved, true);
      assert.equal(result.artifacts_manifest_sha256, createHash("sha256").update(readFileSync(manifestPath)).digest("hex"));
    }
    else assert.equal(result.fresh_report, false, "previous report must not count as this invocation");
  });
}

test("an archive cannot be nested under the source output directory", () => {
  const output = join(dirname(source), "recursive-output");
  const child = spawnSync("bash", [helper, output, source,
    "--browser", process.execPath, fixture, "browser", source, "nested", "0", "yes",
    "--guard", process.execPath, fixture, "guard", join(output, "report.json"), "nested", "0", "no",
  ], { encoding: "utf8" });
  assert.notEqual(child.status, 0, "reject recursive snapshot targets before copying");
  assert.equal(existsSync(output), false);
});
