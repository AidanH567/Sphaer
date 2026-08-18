# Screenshot annotation — QA evidence

Regenerate with:

```bash
npx tsx scripts/qa-annotate-screenshot.ts
```

Read-only: no network, no database, no Storage.

## Why this folder exists

A green test suite is not evidence. This project has shipped a poster that
passed every check and rendered blank, a mural test that measured a wall that
never moved, and icons that shipped broken through a successful deploy. The
failure is always the same shape — a file that is the right size, the right
format, and decodes without error, containing the wrong thing.

Annotation can fail in exactly that shape, in two ways that no type and no
`try/catch` would catch:

- **flatten too early** → a valid PNG of a circle on an empty background
- **wrong coordinate space** → a valid PNG with the circle in the wrong place

Both would be sent to a designer as a bug report. So the check is on pixels.

## What is measured

| Check | Result |
| --- | --- |
| Annotated image is the source resolution | 1170×2532 |
| Pixels changed inside the stroke bounds | 36,188 |
| Pixels changed **outside** the stroke bounds | **0** |
| Marker-coloured pixels present | 28,977 |
| Ink coverage (a mark, not a smear) | 1.222% |
| Preview vs flattened — relative centroid drift | 0.111% |
| Stroke weight held across scales | preview 1.592% vs full 1.222% |
| Visible on an iPhone SE preview (213×460pt) | 1,158 marker pixels, 2.00px stroke |

The two that carry the most weight:

- **0 changed pixels outside the strokes.** The screenshot survives the round
  trip byte-for-byte, so nothing about the reported UI is altered by annotating
  it. A re-encode that shifted colours would show up here immediately.
- **0.111% centroid drift.** The preview the reporter draws on and the
  full-resolution image that gets sent mark the *same place*. This is the
  property that stops someone circling a padding bug and sending a picture with
  the circle somewhere else — which would look completely fine from the file.

## The images

| File | What it is |
| --- | --- |
| `source-screenshot.png` | The synthetic "screenshot" — a stand-in Sphaer feed with a deliberate bug: the *Foreign Diplomats* card has 96px inner padding where its neighbours have 32px. |
| `annotated-screenshot.png` | The flattened output. What actually gets uploaded. |
| `annotated-preview.png` | The same strokes at preview scale (340pt wide). |
| `small-phone-preview.png` | The worst case: iPhone SE, where the drawing surface is only 213pt wide. |
| `before-after.png` | Side by side, for a human to look at. |

## What the render demonstrates

The red circle marks the over-padded card — a defect that "the padding on this
card is wrong" would not have located, and a circle does instantly. That is the
entire argument for the feature.

The **cyan** circle marks the red error strip, and is the argument for having
more than one colour: a red circle drawn on `badge.red` is invisible. Error
states are among the most likely things to be reported, so a single red pen
would have failed on exactly the reports that matter most.

The small-phone render also shows `MIN_STROKE_WIDTH_PX` doing real work: at
213pt the ratio alone would give a 1.28px hairline, and the floor lifts it to
2px so the marks stay legible where they will actually be drawn.

## The honest limitation

This rasterises with **sharp** through an SVG string. The app rasterises with
**react-native-svg** on a device. They are different renderers.

What is proven here is that the geometry in `src/utils/annotation.ts` — which
both renderers call, and which is the part that can silently be wrong —
produces visible marks in the right places at any scale. It is not proof that a
particular iPhone rasterises it identically. Same limitation, and the same
reasoning, as `docs/poster-qa/`.

The device-side risks that remain, and how they are covered:

| Risk | Cover |
| --- | --- |
| Capture before the screenshot decodes | Capture canvas mounts when the annotator opens, plus an `onLoad` flag and a bounded grace period (`AnnotationCanvas`) |
| Web `toDataURL` reading a transformed DOM box | `assertAnnotationBoxIsUntransformed`, inherited from the poster generator |
| `toDataURL` never calling back | 15s timeout that rejects rather than hangs |
| A capture that produced no image | `readPngHeader` on the exact upload bytes, before they go over the wire |
