/* Profile + Circles QA driver — drives the exported web build at 390x844
 * (iPhone 13/14) and records screenshots + layout measurements for Lara's
 * points #7 (my profile) and #8 ("My circles" on the circles screen).
 *
 *   node profile-qa.js <baseUrl> <outDir> <label>
 *
 * Same shape as docs/mural-qa/mural-qa.js. Two things this checks that a
 * green jest suite cannot:
 *   1. horizontal overflow — any element wider than the 390px viewport
 *   2. broken images — <img> that resolved to naturalWidth 0
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const [baseUrl, outDir, label] = process.argv.slice(2);
if (!baseUrl || !outDir || !label) {
  console.error('usage: node profile-qa.js <baseUrl> <outDir> <label>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 390, height: 844 };

/**
 * Read layout health straight out of the DOM.
 *
 * `overflowingElements` deliberately ignores nodes inside a horizontally
 * scrollable ancestor — the circles page is BUILT from horizontal card rows,
 * so a wide child there is by design. What must never happen is the PAGE
 * itself scrolling sideways, which is `documentScrollsHorizontally`.
 */
const MEASURE = (vw) => {
  const doc = document.documentElement;
  const scrollers = new Set();
  document.querySelectorAll('*').forEach((el) => {
    const s = getComputedStyle(el);
    if (
      (s.overflowX === 'auto' || s.overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth + 1
    ) {
      scrollers.add(el);
    }
  });
  const insideScroller = (el) => {
    let p = el.parentElement;
    while (p) {
      if (scrollers.has(p)) return true;
      p = p.parentElement;
    }
    return false;
  };

  const overflowing = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right <= vw + 0.5 && r.left >= -0.5) return;
    if (insideScroller(el)) return;
    overflowing.push({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 60),
      left: Math.round(r.left * 10) / 10,
      right: Math.round(r.right * 10) / 10,
      width: Math.round(r.width * 10) / 10,
    });
  });

  const imgs = Array.from(document.querySelectorAll('img'));
  const brokenImages = imgs
    .filter((i) => i.complete && i.naturalWidth === 0)
    .map((i) => (i.currentSrc || i.src || '(no src)').slice(0, 120));

  // ── The compactness test ────────────────────────────────────────────────
  // "Identity + the start of content fit one 390x844 screen without
  // scrolling." Identity ends at the action buttons; content starts at the
  // tab strip. We locate the tab strip by its labels and report the bottom
  // edge of the first thing under it.
  const findByText = (needle) =>
    Array.from(document.querySelectorAll('div,span')).find(
      (el) => (el.textContent || '').trim() === needle && el.children.length === 0
    );
  const tabEl = findByText('All') || findByText('Going');
  let aboveTheFold = null;
  if (tabEl) {
    const tabRect = tabEl.getBoundingClientRect();
    // First content row under the strip: the nearest element starting below
    // the tab strip that carries real height.
    const below = Array.from(document.querySelectorAll('div'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.top >= tabRect.bottom && r.height > 24 && r.width > 100)
      .sort((a, b) => a.r.top - b.r.top)[0];
    aboveTheFold = {
      tabStripTop: Math.round(tabRect.top),
      tabStripBottom: Math.round(tabRect.bottom),
      tabStripVisible: tabRect.bottom <= 844,
      firstContentBottom: below ? Math.round(below.r.bottom) : null,
      firstContentVisible: below ? below.r.bottom <= 844 : null,
      viewportHeight: 844,
    };
  }

  // Every tappable target, so the before/after can show WHAT is reachable on
  // the screen — the whole point of #7 and #8 is discoverability.
  const tappables = Array.from(
    document.querySelectorAll('[role="button"], [role="link"], button, a')
  )
    .map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim())
    .filter(Boolean);

  return {
    viewportWidth: vw,
    documentScrollWidth: doc.scrollWidth,
    documentScrollsHorizontally: doc.scrollWidth > vw + 1,
    horizontalScrollerCount: scrollers.size,
    overflowingElementCount: overflowing.length,
    overflowingElements: overflowing.slice(0, 20),
    aboveTheFold,
    imageCount: imgs.length,
    brokenImageCount: brokenImages.length,
    brokenImages,
    contentHeight: doc.scrollHeight,
    tappableCount: tappables.length,
    tappables,
  };
};

async function capture(page, route, name, results) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 90_000 });
  // Expo web hydrates + the screens fetch from Supabase on focus. Give the
  // network a beat, then settle.
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(outDir, `${label}-${name}.png`) });
  await page.screenshot({
    path: path.join(outDir, `${label}-${name}-full.png`),
    fullPage: true,
  });
  results[name] = await page.evaluate(MEASURE, VIEWPORT.width);
  const atf = results[name].aboveTheFold;
  console.log(
    `  ${name}: scrollWidth=${results[name].documentScrollWidth} ` +
      `overflow=${results[name].overflowingElementCount} ` +
      `brokenImgs=${results[name].brokenImageCount} ` +
      `tappables=${results[name].tappableCount}` +
      (atf
        ? ` | tabStrip@${atf.tabStripBottom}px visible=${atf.tabStripVisible}` +
          ` firstContent@${atf.firstContentBottom}px visible=${atf.firstContentVisible}`
        : ' | no tab strip found')
  );
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
  });

  const results = {};
  console.log(`▶ ${label}`);
  await capture(page, '/profile', 'profile', results);
  await capture(page, '/circles', 'circles', results);
  // A real, populated public profile: profiles and event_registrations are
  // both world-readable, so this renders live data without a session.
  await capture(
    page,
    '/user/c937f753-1428-4184-b79f-777e8dec1e03',
    'user-profile',
    results
  );

  results.consoleErrors = consoleErrors.slice(0, 20);
  fs.writeFileSync(
    path.join(outDir, `${label}-measurements.json`),
    JSON.stringify(results, null, 2)
  );

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
