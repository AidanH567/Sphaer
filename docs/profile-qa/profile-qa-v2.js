/* Profile v2 QA driver — the RESTORED profile layout plus the Activities
 * sheet's segmented control, driven against the exported web build at
 * 390x844 (iPhone 13/14).
 *
 *   node profile-qa-v2.js <baseUrl> <outDir> <label>
 *
 * What this checks that a green jest suite cannot:
 *   1. the layout is the ORIGINAL one back — centred avatar, four-stat row
 *      with dividers, one Edit Profile button, About with "Read more"
 *   2. no separate Saved / Tickets buttons anywhere on the page
 *   3. tapping the Activities stat actually opens the sheet, and each
 *      category swaps the list underneath
 *   4. horizontal overflow and broken images at 390px
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const [baseUrl, outDir, label] = process.argv.slice(2);
if (!baseUrl || !outDir || !label) {
  console.error('usage: node profile-qa-v2.js <baseUrl> <outDir> <label>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 390, height: 844 };

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
      width: Math.round(r.width * 10) / 10,
    });
  });

  const imgs = Array.from(document.querySelectorAll('img'));
  const brokenImages = imgs
    .filter((i) => i.complete && i.naturalWidth === 0)
    .map((i) => (i.currentSrc || i.src || '(no src)').slice(0, 120));

  const tappables = Array.from(
    document.querySelectorAll('[role="button"], [role="link"], [role="tab"], button, a')
  )
    .map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim())
    .filter(Boolean);

  const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim();

  return {
    documentScrollWidth: doc.scrollWidth,
    documentScrollsHorizontally: doc.scrollWidth > vw + 1,
    overflowingElementCount: overflowing.length,
    overflowingElements: overflowing.slice(0, 10),
    imageCount: imgs.length,
    brokenImageCount: brokenImages.length,
    brokenImages,
    tappableCount: tappables.length,
    tappables,
    // The acceptance test for "he wanted the old one back": the four stats
    // are present as one row, and the two rejected buttons are gone.
    hasFourStatRow: ['Followers', 'Following', 'Circles', 'Activities'].every((s) =>
      text.includes(s)
    ),
    hasEditProfileButton: tappables.some((t) => /Edit Profile/i.test(t)),
    hasStandaloneSavedButton: tappables.some((t) => /^Saved$|View saved activities/i.test(t)),
    hasStandaloneTicketsButton: tappables.some((t) => /^Tickets$|View tickets/i.test(t)),
    hasAboutReadMore: /Read more/.test(text),
    visibleTextHead: text.slice(0, 400),
  };
};

async function shoot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${label}-${name}.png`) });
}

async function capture(page, route, name, results) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(6000);
  await shoot(page, name);
  await page.screenshot({
    path: path.join(outDir, `${label}-${name}-full.png`),
    fullPage: true,
  });
  results[name] = await page.evaluate(MEASURE, VIEWPORT.width);
  const r = results[name];
  console.log(
    `  ${name}: scrollWidth=${r.documentScrollWidth} overflow=${r.overflowingElementCount} ` +
      `brokenImgs=${r.brokenImageCount} fourStats=${r.hasFourStatRow} ` +
      `edit=${r.hasEditProfileButton} savedBtn=${r.hasStandaloneSavedButton} ` +
      `ticketsBtn=${r.hasStandaloneTicketsButton} readMore=${r.hasAboutReadMore}`
  );
}

/** Open the Activities sheet by tapping the stat, then walk every category. */
async function driveSheet(page, prefix, results) {
  const stat = page.locator('[role="button"]', { hasText: 'Activities' }).first();
  if ((await stat.count()) === 0) {
    console.log(`  ${prefix}: no tappable Activities stat (signed out?) — skipped`);
    return;
  }
  await stat.click();
  await page.waitForTimeout(1200);
  await shoot(page, `${prefix}-sheet-all`);
  results[`${prefix}-sheet-all`] = await page.evaluate(MEASURE, VIEWPORT.width);
  console.log(
    `  ${prefix}-sheet-all: tabs=${JSON.stringify(
      results[`${prefix}-sheet-all`].tappables.filter((t) =>
        /^(All|Going|Saved|Past), /.test(t)
      )
    )}`
  );

  for (const tab of ['Going', 'Saved', 'Past']) {
    const seg = page.locator(`[role="tab"][aria-label^="${tab}, "]`).first();
    if ((await seg.count()) === 0) {
      console.log(`  ${prefix}-sheet-${tab.toLowerCase()}: absent (expected on public)`);
      continue;
    }
    await seg.click();
    await page.waitForTimeout(700);
    await shoot(page, `${prefix}-sheet-${tab.toLowerCase()}`);
    const m = await page.evaluate(MEASURE, VIEWPORT.width);
    results[`${prefix}-sheet-${tab.toLowerCase()}`] = m;
    console.log(
      `  ${prefix}-sheet-${tab.toLowerCase()}: overflow=${m.overflowingElementCount} ` +
        `text="${m.visibleTextHead.slice(0, 90)}"`
    );
  }
}

/** Tap the first ticket badge and record where it landed. */
async function driveTicketBadge(page, prefix, results) {
  const back = page.locator('[role="tab"][aria-label^="All, "]').first();
  if (await back.count()) await back.click();
  await page.waitForTimeout(500);

  const badge = page.locator('[aria-label^="Show your ticket for"]').first();
  if ((await badge.count()) === 0) {
    console.log(`  ${prefix}-ticket: no local ticket badge on screen — skipped`);
    return;
  }
  const badgeLabel = await badge.getAttribute('aria-label');
  await badge.click();
  await page.waitForTimeout(2500);
  await shoot(page, `${prefix}-ticket`);
  const url = page.url();
  results[`${prefix}-ticket`] = {
    badgeLabel,
    landedOn: url.replace(baseUrl, ''),
    routedToTicket: /\/ticket\//.test(url),
    routedToEvent: /\/event\//.test(url),
    ...(await page.evaluate(MEASURE, VIEWPORT.width)),
  };
  console.log(
    `  ${prefix}-ticket: "${badgeLabel}" → ${url.replace(baseUrl, '')} ` +
      `(ticket=${results[`${prefix}-ticket`].routedToTicket})`
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
  await driveSheet(page, 'profile', results);
  await driveTicketBadge(page, 'profile', results);

  // A real, populated public profile: profiles and event_registrations are
  // both world-readable, so this renders live data without a session.
  const PUBLIC_USER = 'c937f753-1428-4184-b79f-777e8dec1e03';
  await capture(page, `/user/${PUBLIC_USER}`, 'user-profile', results);
  await driveSheet(page, 'user-profile', results);

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
