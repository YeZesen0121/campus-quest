import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

/** Same owned-content boundary as captureOwnedVisual; keeps fixed shell bars
 * from appearing across the middle of a full-height guide image. */
export async function captureR6Evidence(page:Page, owned:Locator, path:string) {
  const bars='.app-topbar,.app-bottomnav,nextjs-portal';
  await expect(owned.locator(bars)).toHaveCount(0);
  await expect(page.locator('nextjs-portal [data-nextjs-dialog-overlay]')).toHaveCount(0);
  const visibility=()=>page.locator(bars).evaluateAll(elements=>elements.map(element=>getComputedStyle(element).visibility));
  const before=await visibility();
  const style=await page.addStyleTag({content:`${bars} { visibility: hidden !important; } nextjs-portal { display: none !important; }`});
  try {
    expect((await visibility()).every(value=>value==='hidden')).toBe(true);
    await owned.screenshot({path});
  }finally{await style.evaluate(element=>element.parentNode?.removeChild(element));}
  expect(await visibility()).toEqual(before);
}
