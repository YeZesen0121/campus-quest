import { createRequire } from "node:module";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent('<p lang="zh-CN">INTEGRATION 独立浏览器环境</p>');
  if ((await page.locator("p").textContent()) !== "INTEGRATION 独立浏览器环境") {
    throw new Error("INTEGRATION browser content probe failed");
  }
  if ((await context.cookies()).length !== 0) {
    throw new Error("INTEGRATION browser did not start with an empty cookie context");
  }
  console.log("INTEGRATION_BROWSER_PROBE=PASS; isolated fresh context");
  await context.close();
} finally {
  await browser.close();
}
