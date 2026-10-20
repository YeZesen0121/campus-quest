// Invoke the real guarded launcher with a disposable npx observer; no servers,
// worlds or browser reports are created by this environment-contract proof.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

for (const mode of ["playwright", "visual"]) {
  test(`${mode} carries the upstream CI login profile and bounded compiler`, () => {
    const sandbox = mkdtempSync(join(tmpdir(), "cq-integration-profile-"));
    try {
      const observer = join(sandbox, "npx");
      writeFileSync(observer, '#!/bin/bash\nprintf "PROFILE_LOGIN=%s\\n" "${CQ_E2E_LOGIN_RATELIMIT:-unset}"\nprintf "PROFILE_RAYON=%s\\n" "$RAYON_NUM_THREADS"\nprintf "PROFILE_NODE=%s\\n" "$NODE_OPTIONS"\n');
      chmodSync(observer, 0o700);
      const result = spawnSync("bash", ["/workspace/infra/integration/launch.sh", mode, "--list"], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${sandbox}:${process.env.PATH}`, CQ_E2E_LOGIN_RATELIMIT: "0" },
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /PROFILE_LOGIN=1\n/);
      assert.match(result.stdout, /PROFILE_RAYON=2\n/);
      assert.match(result.stdout, /PROFILE_NODE=--max-old-space-size=768\n/);
    } finally {
      assert.ok(sandbox.startsWith(join(tmpdir(), "cq-integration-profile-")));
      rmSync(sandbox, { recursive: true });
    }
  });
}

for (const path of ['/tmp/foreign', '/workspace/infra/integration/.runtime/captures/../foreign', '/workspace/infra/integration/.runtime/captures/a/b']) {
  test(`direct launcher rejects capture output ${path}`, () => {
    const result = spawnSync('bash', ['/workspace/infra/integration/launch.sh', 'node', '-e', 'console.log("UNSAFE_CAPTURE_EXECUTED")'], {
      encoding: 'utf8',
      env: { ...process.env, CQ_E2E_CAPTURE_DIR: path },
    });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /Capture directory must be a direct child of the owned integration runtime/);
    assert.doesNotMatch(result.stdout, /UNSAFE_CAPTURE_EXECUTED/);
  });
}
