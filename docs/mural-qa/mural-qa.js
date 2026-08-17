/* Mural QA driver — drives the exported web build at 390x844 with real touch
 * input (CDP Input.dispatchTouchEvent; RNGH on web ignores synthetic mouse
 * drags) and records screenshots + measurements.
 *
 *   node mural-qa.js <baseUrl> <outDir> <label>
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const [baseUrl, outDir, label] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: path.join(outDir, `${label}-${name}.png`) });

/** Poster rects + canvas transform, read straight out of the DOM. */
const MEASURE = () => {
  const imgs = Array.from(document.querySelectorAll('img')).filter((i) =>
    /event-posters/.test(i.currentSrc || i.src || '')
  );
  let canvas = null;
  let el = imgs[0];
  while (el && el !== document.body) {
    const t = getComputedStyle(el).transform;
    if (t && t !== 'none') {
      canvas = el;
      break;
    }
    el = el.parentElement;
  }
  const m = canvas
    ? new DOMMatrixReadOnly(getComputedStyle(canvas).transform)
    : null;
  const slot = canvas ? canvas.parentElement.getBoundingClientRect() : null;

  // Grid-sample the visible slot. Coverage alone can't tell a designed gutter
  // from a hole, so we also flood-fill the uncovered samples into connected
  // blobs and report the biggest one's bounding box. An 8px gutter grid is one
  // huge thin blob, so what actually matters is its SHORTEST side: a gutter is
  // ~8px thin in one direction, a hole is fat in both.
  let coverage = null;
  let biggestHole = null;
  if (slot) {
    const boxes = imgs.map((i) => i.getBoundingClientRect());
    const STEP = 5;
    const cols = Math.ceil((slot.right - slot.left) / STEP);
    const rows = Math.ceil((slot.bottom - slot.top) / STEP);
    const free = new Uint8Array(cols * rows);
    let hit = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = slot.left + c * STEP;
        const y = slot.top + r * STEP;
        const covered = boxes.some(
          (b) => x >= b.left && x < b.right && y >= b.top && y < b.bottom
        );
        if (covered) hit++;
        else free[r * cols + c] = 1;
      }
    }
    coverage = hit / (cols * rows);

    // Largest uncovered rectangle (maximal-rectangle over the free grid) —
    // this is the "how big is the empty patch" number.
    const heights = new Int32Array(cols);
    let best = { w: 0, h: 0, area: 0 };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        heights[c] = free[r * cols + c] ? heights[c] + 1 : 0;
      }
      // Largest rectangle in the histogram.
      const stack = [];
      for (let c = 0; c <= cols; c++) {
        const h = c === cols ? 0 : heights[c];
        while (stack.length && heights[stack[stack.length - 1]] >= h) {
          const top = stack.pop();
          const left = stack.length ? stack[stack.length - 1] + 1 : 0;
          const w = c - left;
          const area = heights[top] * w;
          if (area > best.area) best = { w, h: heights[top], area };
        }
        stack.push(c);
      }
    }
    biggestHole = {
      widthPx: best.w * STEP,
      heightPx: best.h * STEP,
      thinnestSidePx: Math.min(best.w, best.h) * STEP,
      areaPx2: best.area * STEP * STEP,
    };
  }

  return {
    posterCount: imgs.length,
    imagesLoaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    translate: m ? { x: round(m.m41), y: round(m.m42), scale: m.a } : null,
    canvasSize: canvas
      ? { w: round(canvas.offsetWidth), h: round(canvas.offsetHeight) }
      : null,
    slot: slot ? { w: round(slot.width), h: round(slot.height) } : null,
    coverage: coverage === null ? null : Number(coverage.toFixed(4)),
    biggestEmptyRect: biggestHole,
  };

  function round(v) {
    return Math.round(v * 100) / 100;
  }
};

/** Consistency of the gaps between posters — the "gutter" check. */
const GUTTERS = () => {
  const imgs = Array.from(document.querySelectorAll('img')).filter((i) =>
    /event-posters/.test(i.currentSrc || i.src || '')
  );
  const boxes = imgs.map((i) => {
    const b = i.getBoundingClientRect();
    return { l: b.left, r: b.right, t: b.top, b: b.bottom };
  });
  // Group into rows by top edge (1px tolerance).
  const rows = new Map();
  for (const b of boxes) {
    const key = Math.round(b.t);
    let bucket = null;
    for (const k of rows.keys()) if (Math.abs(k - key) <= 2) bucket = k;
    if (bucket === null) rows.set(key, [b]);
    else rows.get(bucket).push(b);
  }
  const gaps = [];
  const rowRightEdges = [];
  const rowLeftEdges = [];
  for (const [, row] of rows) {
    row.sort((a, z) => a.l - z.l);
    for (let i = 1; i < row.length; i++) gaps.push(row[i].l - row[i - 1].r);
    rowRightEdges.push(row[row.length - 1].r);
    rowLeftEdges.push(row[0].l);
  }
  const uniq = (a) => [...new Set(a.map((v) => Math.round(v * 10) / 10))];
  return {
    rowCount: rows.size,
    gapValues: uniq(gaps).sort((a, b) => a - b),
    rowRightEdgeSpreadPx:
      rowRightEdges.length > 1
        ? Math.round(
            (Math.max(...rowRightEdges) - Math.min(...rowRightEdges)) * 10
          ) / 10
        : 0,
    rowLeftEdgeSpreadPx:
      rowLeftEdges.length > 1
        ? Math.round(
            (Math.max(...rowLeftEdges) - Math.min(...rowLeftEdges)) * 10
          ) / 10
        : 0,
  };
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await page.context().newCDPSession(page);

  const tp = (x, y) => [{ x, y, radiusX: 5, radiusY: 5, force: 1, id: 1 }];
  async function touchDrag(dx, dy, { steps = 20, hold = false, stepMs = 12 } = {}) {
    const x0 = 195;
    const y0 = 500;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: tp(x0, y0),
    });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: tp(x0 + (dx * i) / steps, y0 + (dy * i) / steps),
      });
      await page.waitForTimeout(stepMs);
    }
    if (hold) return;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(800);
  }
  async function release() {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(900);
  }

  const t0 = Date.now();
  await page.goto(`${baseUrl}/feed/mural`, { waitUntil: 'load', timeout: 60000 });
  await page
    .waitForFunction(
      () =>
        Array.from(document.querySelectorAll('img')).filter((i) =>
          /event-posters/.test(i.currentSrc || i.src || '')
        ).length > 5,
      { timeout: 60000 }
    )
    .catch(() => {});
  const firstPosterMs = Date.now() - t0;
  // Wait until every poster image has actually decoded, so screenshots compare
  // finished walls rather than whoever's CDN was quicker.
  await page
    .waitForFunction(
      () => {
        const imgs = Array.from(document.querySelectorAll('img')).filter((i) =>
          /event-posters/.test(i.currentSrc || i.src || '')
        );
        return (
          imgs.length > 0 &&
          imgs.every((i) => i.complete && i.naturalWidth > 0)
        );
      },
      { timeout: 60000 }
    )
    .catch(() => {});
  const allPostersMs = Date.now() - t0;
  await page.waitForTimeout(1500);

  const out = { label, firstPosterMs, allPostersMs, pageErrors: errors, states: {} };

  await shot(page, '1-landed');
  out.states.landed = await page.evaluate(MEASURE);
  out.gutters = await page.evaluate(GUTTERS);

  // Push hard to the top-left of the wall (drag content right/down).
  for (let i = 0; i < 4; i++) await touchDrag(340, 340, { steps: 14 });
  await shot(page, '2-top-left-corner');
  out.states.topLeftCorner = await page.evaluate(MEASURE);

  // Push hard to the bottom-right of the wall.
  for (let i = 0; i < 8; i++) await touchDrag(-340, -340, { steps: 14 });
  await shot(page, '3-bottom-right-corner');
  out.states.bottomRightCorner = await page.evaluate(MEASURE);

  // Overscroll probe — held past the corner, NOT released, so we capture the
  // rubber-band state rather than the snapped-back one.
  await touchDrag(-340, -340, { steps: 20, hold: true });
  await shot(page, '4-overscroll-held');
  out.states.overscrollHeld = await page.evaluate(MEASURE);
  await release();
  await shot(page, '5-after-release');
  out.states.afterRelease = await page.evaluate(MEASURE);
  out.snapBackPx = {
    x: Math.round(
      (out.states.afterRelease.translate.x - out.states.overscrollHeld.translate.x) * 100
    ) / 100,
    y: Math.round(
      (out.states.afterRelease.translate.y - out.states.overscrollHeld.translate.y) * 100
    ) / 100,
  };

  fs.writeFileSync(
    path.join(outDir, `${label}-measurements.json`),
    JSON.stringify(out, null, 2)
  );
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
