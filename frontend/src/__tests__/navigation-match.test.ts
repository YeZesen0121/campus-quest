import assert from "node:assert/strict";
import { test } from "node:test";
import { navItemActive } from "../components/shell/navigationMatch";

test("admin overview is active only on its root while domain entries keep nested matching", () => {
  assert.equal(navItemActive("/admin", "/admin"), true);
  assert.equal(navItemActive("/admin/users", "/admin"), false);
  assert.equal(navItemActive("/admin/users/one", "/admin/users"), true);
});

test("navigation matches route segments rather than similarly named sibling paths", () => {
  assert.equal(navItemActive("/profile/project-drafts", "/profile"), true);
  assert.equal(navItemActive("/profile-other", "/profile"), false);
  assert.equal(navItemActive("/tasks-other", "/tasks"), false);
  assert.equal(navItemActive("/innovation/achievements/one", "/innovation"), true);
  assert.equal(navItemActive("/innovation", "/"), false);
});

test("an excluded operational subtree cannot activate public browsing navigation", () => {
  assert.equal(navItemActive("/innovation/reviews", "/innovation", ["/innovation/reviews"]), false);
  assert.equal(navItemActive("/innovation/reviews/one", "/innovation", ["/innovation/reviews"]), false);
  assert.equal(navItemActive("/innovation/achievements", "/innovation", ["/innovation/reviews"]), true);
});
