import { createRequire } from "node:module";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent('<p lang="zh-CN">R6 独立浏览器环境</p>');
  if ((await page.locator("p").textContent()) !== "R6 独立浏览器环境") {
    throw new Error("R6 browser content probe failed");
  }
  if ((await context.cookies()).length !== 0) {
    throw new Error("R6 browser did not start with an empty cookie context");
  }
  console.log("R6_BROWSER_PROBE=PASS; isolated fresh context");
  await context.close();
} finally {
  await browser.close();
}
