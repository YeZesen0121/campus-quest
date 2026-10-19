// Run directly with docker exec node, not via run.ps1 (which holds the lock).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

if (process.argv[2] === "hold") {
  console.log(`R6_PROBE_START=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log(`R6_PROBE_END=${Date.now()}`);
} else {
  const launch = (mode) => new Promise((resolve, reject) => {
    const child = spawn("bash", [
      "/workspace/infra/r6/launch.sh", mode,
      "../infra/r6/test-runner-lock.mjs", "hold",
    ]);
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(output));
      resolve(output);
    });
  });
  const results = await Promise.all([launch("node"), launch("tsx")]);
  const ranges = results.map((output) => ({
    start: Number(output.match(/R6_PROBE_START=(\d+)/)?.[1]),
    end: Number(output.match(/R6_PROBE_END=(\d+)/)?.[1]),
  })).sort((left, right) => left.start - right.start);
  for (const range of ranges) assert.ok(range.start > 0 && range.end >= range.start);
  assert.ok(ranges[1].start >= ranges[0].end, "Runner modes overlapped");
  console.log("R6_RUNNER_SERIALIZATION=PASS", JSON.stringify(ranges));
}
