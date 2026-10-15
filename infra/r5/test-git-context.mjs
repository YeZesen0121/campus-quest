import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

assert.ok(process.env.GIT_DIR?.startsWith("/tmp/campusquest-r5-git/"),
  "R5 runner must provide private Git metadata");
assert.equal(process.env.GIT_WORK_TREE, "/workspace");
assert.ok(process.env.GIT_INDEX_FILE?.startsWith(process.env.GIT_DIR + "/"));
assert.ok(process.env.CQ_R5_GIT_MANIFEST, "Host tracked-file manifest is required");
const pointer = readFileSync("/workspace/.git");
const expected = readFileSync(process.env.CQ_R5_GIT_MANIFEST, "utf8")
  .split("\0").filter((file) => file && existsSync(`/workspace/${file}`)).sort();
const actual = execFileSync("git", ["-C", "/workspace", "ls-files", "--full-name", "-z"], { encoding: "utf8" })
  .split("\0").filter(Boolean).sort();
assert.deepEqual(actual, expected, "Private index must match host tracked files");
const expectedTsx = expected.filter((file) => file.startsWith("frontend/src/") && file.endsWith(".tsx")
  && readFileSync(`/workspace/${file}`).length > 0).map((file) => file.slice("frontend/".length));
const scannedTsx = execFileSync("git", ["grep", "-l", "-z", "", "--", "src/*.tsx"], { encoding: "utf8" })
  .split("\0").filter(Boolean).sort();
assert.deepEqual(scannedTsx, expectedTsx.sort(), "CSS gate must scan all current tracked TSX files");
assert.ok(scannedTsx.some((file) => file.startsWith("src/features/innovation/mentors/")),
  "Stage R5 mentor files in the host worktree before checking new frontend code");
assert.deepEqual(readFileSync("/workspace/.git"), pointer, "Worktree Git pointer changed");
console.log(`R5_PRIVATE_GIT_CONTEXT=PASS tracked=${actual.length} tsx=${scannedTsx.length}`);
