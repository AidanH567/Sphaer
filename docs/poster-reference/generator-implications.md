# What this means for the generator

The honest part. What `src/utils/poster-template.ts` can actually be grown into, and
what it cannot, from evidence rather than optimism.

## Where the generator is now

`poster-template.ts` solves exactly **one** geometry, and the constants say so:

```
POSTER_WIDTH  1080      MARGIN            72
POSTER_HEIGHT 1528      BAND_TOP          856
                        WORDMARK_BASELINE POSTER_HEIGHT - 60
                        VENUE_BASELINE    WORDMARK_BASELINE - 62
                        DATE_BASELINE     VENUE_BASELINE - 56
```

Every poster it produces is: photo (or a three-bar accent mark) above y=856, opaque
type band below it, title solved bottom-up from a wordmark pinned 60 px off the bottom
edge. One aspect ratio. One margin. One band position. One vertical rhythm.

That is not a criticism of the code — the layout solving in there is careful, it is
pure, it is testable in Node, and `assertLayoutIsPaintable` exists because a real
blank-poster failure put eight holes in the Mural. The problem is narrower and it is
structural: **the module has one skeleton, so every output has the same skeleton.**
Colour varies, the title size varies, the photo varies. The composition never does.
That is precisely why the output reads as templated, and no amount of palette work
fixes it.

Against Lara's 39 it maps onto exactly one family — a degenerate case of **Swiss
editorial grid** with the image on top and the type below — and it is missing the thing
that makes the real ones work, which is a meta zone with labelled fields and rules
(p19), and one deliberate exception per poster (p12's keyline, p05's headline-sized
date).

## The three groups

### A — a layout solver can build these from event data alone

**6 posters: p01, p04, p07, p08, p16, p36**

No photograph required, no illustrator required. Everything on the canvas is type,
flat shapes, gradients, or a procedurally drawable graphic.

| | What it needs |
|---|---|
| p08 Berlin Shiatsu | Rotated text, a ground colour, a date lockup. Nothing else. |
| p36 Fuego Libre | A rect, a circle, two rules, three text blocks. |
| p07 Sunset Synth | Two gradient fills, the title set twice at two rotations, a footer bar. |
| p01 Jam Session | A circle, a five-line stave, two rules, four text blocks. |
| p04 Jazz Basketball | A 4×4 tile grid of flat colour plus vertical type. Tile contents need a shape vocabulary. |
| p16 Active Listening | Two circles of ruled lines with sine curves through them, screened. Drawable. |

This is the group that matters most, because it is the group that works when the event
has no usable image — which for scraped Berlin events is most of the time.

### B — reproducible, but only with a good photograph supplied

**21 posters: p05, p06, p09, p10, p11, p12, p13, p14, p15, p17, p18, p19, p20, p25,
p28, p29, p30, p33, p34, p37, p39**

The layout is mechanical. The picture is not. Within this group the compositing cost
varies enormously and it is worth separating:

- **Place a rectangle** (p05, p10, p12, p14, p19, p28, p34) — draw the image into a
  solved rect. Trivial. Fourteen lines of canvas work.
- **Tint or screen it** (p09, p13, p20, p25, p28, p39) — the same, plus a per-pixel
  pass. Cheap, and it is what rescues a weak photograph.
- **Cut the subject out** (p06, p25) — needs background removal. A real dependency.
- **Mask type against the image** (p29, p33) — needs text as a clip path, and for p29 a
  depth mask so the hand passes in front of some letters and behind others. Expensive,
  and the highest-impact result in the set.

### C — not reproducible without human illustration or generated imagery

**12 posters: p02, p03, p21, p22, p23, p24, p26, p27, p31, p32, p35, p38**

**This group is the one to be honest about.** Nearly a third of Lara's posters depend
on artwork that no layout solver produces: deco figures drawn for the poster (p03),
pencil dancers and brush strokes (p27), a surreal carnivorous-plant collage (p26), torn
paper and tape (p32), 3D renders (p38, p22), an x-ray jellyfish composite (p21), a
generated cyborg portrait (p24), a Vermeer (p31).

Two consequences worth writing down before anyone builds against this:

1. **Do not put these families in the solver.** A "collage" or "illustration" mode
   backed by a shape library will produce a bad imitation of p32 and it will be
   obviously bad, because the whole point of collage is that a person chose the seams.
   Shipping it is how the generator over-promises.
2. **Their layouts are still worth extracting.** p24's off-centre type with a right-
   aligned meta column, and p38's ruled footer specification plate, are good skeletons
   independent of their imagery. Take the skeleton, drop the family.

The right home for group C is *not* the solver. It is either a hand-made asset (the
existing seed posters already work this way) or an image-generation call — and if it is
the latter, the honest framing is that the generator is composing type onto generated
art, not designing a poster.

## Ranked by value-for-effort

Ranked for an events product where the guaranteed inputs are a title, a date, a time
and a venue, and where a good photograph is the exception.

| # | What to build | Effort | Value | Why |
|---|---|---|---|---|
| 1 | **Type-as-image, vertical/rotated variant** (p08) | Low | Very high | Needs no image at all. Solves the commonest case — a scraped event with no picture — and looks deliberate rather than degraded. Today's fallback is a three-bar accent mark. |
| 2 | **Centred axial** (p14, p15, p36) | Low | High | One alignment decision, impossible to get wrong. p36 needs no photo; p14 works with any photo; p15's circular crop hides a bad one. Three distinct outputs from nearly the same solver. |
| 3 | **Duotone / halftone treatment** (p13, p28, p39) | Medium | Very high | Not a layout at all — a post-processing pass over any family. It is the single cheapest way to make a mediocre scraped image look art-directed, and it de-risks every group B family at once. Build it before more layouts. |
| 4 | **Swiss editorial grid with a real meta zone** (p19, p12, p05) | Medium | High | The most information-dense family and the closest to what exists. The upgrade over today's template is labelled fields with rules, and setting the date at display size. Degrades gracefully with no image. |
| 5 | **Dark technical** (p21 skeleton) | Medium | Medium-high | Running heads at four corners, hairline sans, registration marks over a procedural graphic. Strong identity, well suited to tech and AI events, which Berlin has a lot of. |
| 6 | **Flat geometric / modular** (p04, p01) | High | Medium-high | No photo needed, which is valuable — but it needs a per-category shape vocabulary, and a thin one will read as generated. Only worth it after 1–4. |
| 7 | **Display type over full-bleed photo** (p11, p18) | Very low | Low-medium | Almost free to build and tempting for exactly that reason. It is entirely at the mercy of the photograph, and with a bad one it produces the worst poster in the system. Build it, but rank it last among the photo families and gate it on image quality. |
| 8 | **Type-masked photography** (p33, p29) | High | High but narrow | The most impressive results in the set. Needs text-as-clip-path compositing, and p29 additionally needs a depth mask. Worth doing eventually as a signature move, not as a workhorse. |

## The biggest gap

It is not colour, and it is not typography. It is that **every Lara poster contains one
decision, and the generator contains none.**

p12 has a keyline crossing two unrelated blocks. p05 sets the date as big as the
headline. p04 lets one line escape the grid. p20 wraps type around all four edges. p01
makes one circle mean three things. Take that single decision out of any of them and
what is left is a competent, forgettable layout — which is exactly what the current
template produces every time, because it has no mechanism for a decision at all.

The practical translation, in order:

1. **More than one skeleton.** Two or three families beat any amount of palette work.
   The template's constants need to become a family parameter.
2. **A per-family accent rule** — the exception that makes the poster look chosen.
   A keyline, an oversized numeral, a rotated label, a rule crossing a boundary.
3. **A treatment pass**, separate from layout, so a poor image stops being fatal.
4. **Family-aware palette selection.** Detail in [palettes.md](palettes.md); the short
   version is that a hash choosing bg/fg independently of the layout is why acid green
   on black turns up under a Swiss grid, where it reads as a costume.
