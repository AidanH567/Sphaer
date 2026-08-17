/* Fixture QA driver — captures the two "My circles" states that a
 * signed-out browser cannot reach.
 *
 *   node fixture-qa.js <baseUrl> <outDir>
 *
 * The exported web build has no Supabase session, so `hasSession` is false
 * and MyCirclesSection correctly renders nothing. To photograph the populated
 * and empty states, `.tmp/qa-fixture` is built from a THROWAWAY patch that
 * forces hasSession and feeds fixture circles behind `?qafull` / `?qaempty`.
 * That patch is reverted immediately after and is NOT part of the change.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const [baseUrl, outDir] = process.argv.slice(2);
if (!baseUrl || !outDir) {
  console.error('usage: node fixture-qa.js <baseUrl> <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 390, height: 844 };

const MEASURE = (vw) => {
  const doc = document.documentElement;
  const text = document.body.innerText || '';
  return {
    documentScrollWidth: doc.scrollWidth,
    documentScrollsHorizontally: doc.scrollWidth > vw + 1,
    hasMyCirclesHeading: text.includes('My circles'),
    brokenImageCount: Array.from(document.querySelectorAll('img')).filter(
      (i) => i.complete && i.naturalWidth === 0
    ).length,
    // The first ~400 chars of visible text, so the report can quote what the
    // section actually says rather than paraphrasing it.
    visibleTextHead: text.replace(/\s+/g, ' ').trim().slice(0, 400),
  };
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const results = {};

  for (const [name, query] of [
    ['fixture-mycircles-populated', '?qafull'],
    ['fixture-mycircles-empty', '?qaempty'],
  ]) {
    await page.goto(`${baseUrl}/circles${query}`, {
      waitUntil: 'networkidle',
      timeout: 90_000,
    });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    results[name] = await page.evaluate(MEASURE, VIEWPORT.width);
    console.log(
      `  ${name}: heading=${results[name].hasMyCirclesHeading} ` +
        `scrollWidth=${results[name].documentScrollWidth} ` +
        `brokenImgs=${results[name].brokenImageCount}`
    );
    console.log(`     text: ${results[name].visibleTextHead.slice(0, 160)}`);
  }

  fs.writeFileSync(
    path.join(outDir, 'fixture-measurements.json'),
    JSON.stringify(results, null, 2)
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
