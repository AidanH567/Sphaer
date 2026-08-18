# Compositional taxonomy — ten families

Grouped by how each poster is **built**: where type sits, where image sits, what
dominates the field. Not by subject. Two music posters can be in different families
and a dance poster can sit next to a tech one.

Ids are the labels on [contact-sheet.jpg](contact-sheet.jpg). Per-poster detail is in
[posters.md](posters.md).

## One correction to the starting list

The brief proposed *halftone and duotone*, *gradient and chromatic glow* and
*painterly/classical* as families alongside the layout families. Having looked at all
39, two of those are not families — they are **treatments**, and they ride on top of
any skeleton. Duotone appears on a centred axial layout (p09), on a Swiss editorial
grid (p28), on a type-frame (p20) and on a big-type overlay (p39). Chromatic glow
appears as a border on a collage (p26), as a whole ground on a type poster (p07) and
as a halo on an object-on-field poster (p24).

That distinction matters for the code, not just for the writeup: **families are layout
solvers, treatments are post-processing passes.** They belong in different modules and
they multiply rather than add. Ten families times six treatments is a much bigger space
than sixteen families, and it is cheaper to build.

Only *painterly/classical* survives as a real family, because there the artwork is not
a treatment applied to a photo — it IS the poster, and no filter produces it.

The cross-cutting treatments observed are listed at the foot of this file.

---

## 1. Swiss editorial grid — 5 posters
**p05, p10, p12, p19, p28**

**Skeleton.** Flush-left (or centred) type stack in the top third. One rectangular
image, hard-edged, aligned to the same grid as the type. A meta zone at the foot,
usually split into labelled columns and separated by hairline rules. Generous margin.
Nothing overlaps anything.

**What dominates.** The grid. Type and image are peers; neither bleeds.

**Why it works.** Every element is a rectangle on a shared column structure, so the
poster reads as *organised* before it reads as anything else. It survives a mediocre
photograph because the photo is contained rather than relied on. It also handles a lot
of text — p19 fits a headline, a standfirst, a date field and a four-line address
without crowding.

**Where the interest comes from.** One deliberate exception per poster: p12's blue
keyline crossing both the yellow field and the photograph; p05 setting the date at
headline size; p28 tinting the photo to a single red so it becomes a field.

---

## 2. Centred axial — 5 posters
**p09, p14, p15, p34, p36**

**Skeleton.** A vertical centre line, and everything is symmetric about it. Headline
above, image centred (rectangle in p09/p14, circle in p15, full-bleed in p34, a disc
in p36), footer centred below. Sometimes a second headline block under the image
(p14).

**What dominates.** The axis, and after it the ground colour, which is usually a
saturated field rather than a neutral.

**Why it works.** Symmetry reads as ceremony. It suits things that want to feel calm
and considered — a ceramics workshop, a masterclass, a teaching evening. It is also
extremely forgiving: there is exactly one alignment decision and it cannot be got wrong.

**Where the interest comes from.** The image container. p15 crops to a circle inside a
larger circle so the layout becomes a target; p36 replaces the photo entirely with a
vinyl disc; p34 lets a photographed thangka bleed to all four edges.

---

## 3. Type-as-image — 6 posters
**p07, p08, p20, p29, p30, p33**

**Skeleton.** The headline is not *on* the composition, it *is* the composition. It is
rotated (p08 runs the full height at 90°), repeated at two angles (p07), wrapped around
all four edges as a frame (p20), warped along an arc (p30), interleaved with the
subject in depth (p29), or used as a clipping mask for photography (p33).

**What dominates.** Type, at a scale where letterforms become shapes.

**Why it works.** It converts the one piece of data every event definitely has — its
name — into the artwork. That is exactly the right trade for a generator, because the
title is guaranteed and a good photograph is not.

**Where the interest comes from.** The relationship between type and everything else.
p29 and p33 are the two most impressive posters in the set and both are one idea: a
mask between letters and an image.

---

## 4. Display type over full-bleed photo — 3 posters
**p11, p17, p18**

**Skeleton.** A photograph fills the frame edge to edge. Type sits on top in a simple
lockup — a heavy name in one corner, a dense information block in another.

**What dominates.** The photograph, entirely.

**Why it works when it works.** It doesn't do anything clever, so everything rests on
the picture. p11 succeeds because the studio backdrop and the poster ground are the
same deep red, so the image has no visible edge and the type sits in real negative
space the photographer left.

**The honest warning.** This is the family that fails hardest with a bad photo, and it
is also the family a naive generator reaches for first. It looks like the cheapest
option and it is the riskiest.

---

## 5. Duotone / halftone / riso — 4 posters
**p13, p16, p25, p39**

**Skeleton.** Varies — what unites them is that the image has been reduced to one or
two inks and given a visible print artefact: coarse halftone dots (p39, p20), a riso
pink misregistration (p25), a flat duotone (p13), ruled-line screens (p16). Ground and
image ink are usually the same hue family.

**What dominates.** The ink limitation. Reducing to two colours is what makes the
poster look printed rather than rendered.

**Why it works.** It is the single most effective way to make an ordinary photograph
look art-directed. p13's puppies and p39's squirrel are stock-grade pictures; the
duotone is doing all the work.

**Where the interest comes from.** p16 is the important one — its "photograph" is two
circles of ruled lines with sine curves through them. It is a drawing, not a picture,
and a canvas renderer can produce it.

---

## 6. Dark technical / scientific — 3 posters (2 distinct)
**p21, p22, p23** *(p23 is a byte-identical duplicate of p22)*

**Skeleton.** Near-black ground. Light-weight sans at small sizes, nothing set heavy
except one headline. Tiny running heads at all four corners. Registration marks,
crosshairs, target rings, hairline rules. A large isolated numeral somewhere (p22's
"19"). Subject floats without a frame.

**What dominates.** The apparatus — the marks and running heads, more than the image.

**Why it works.** It borrows the authority of a laboratory document. Two red and blue
squares with crosshairs over a jellyfish (p21) is all it takes.

**Where the interest comes from.** Restraint. Nothing is loud, so the one saturated
overlay reads as data rather than decoration.

---

## 7. Collage & cutout — 5 posters
**p02, p06, p26, p32, p35**

**Skeleton.** Multiple sources layered with visible seams — cut-out subjects with no
background, torn paper, tape, scraps at different scales and resolutions. Type is
usually one of the layers and gets partly covered.

**What dominates.** The layering itself. Depth is the subject.

**Why it works.** It reads as made by hand, which is the hardest quality for anything
generated to fake. p32's three material layers (neon blocks behind, photograph, torn
labels on top) could not be mistaken for a template.

**The honest warning.** This family is where automation goes to die. Every one of these
needed a person deciding what to cut and where the seams go.

---

## 8. Flat geometric / modular — 3 posters
**p01, p04, p37**

**Skeleton.** The image is constructed from primitives — circles, rectangles, arcs,
rounded rects — on a flat ground. p04 lays a 4×4 tile grid; p01 places a single circle
with rules through it; p37 cuts black rounded-rectangle blocks out of a yellow field to
mask a photograph.

**What dominates.** Geometry, and the colour relationships between the flat areas.

**Why it works.** It needs no photograph and no illustrator, and it still carries
subject matter — p01's circle is simultaneously a basketball, a record and a sun.

**Where the interest comes from.** One element breaking the system. p04's saxophone is
a single continuous line crossing tile boundaries in an otherwise strictly modular grid.

---

## 9. Illustration-led & painterly — 3 posters
**p03, p27, p31**

**Skeleton.** A drawing or painting occupies most of the field, and the layout defers
to it. Type goes where the artwork leaves room.

**What dominates.** The artwork.

**Why it works.** Nothing else in the set has this warmth. p27's two brush strokes and
pencil dancers, p03's deco figures, p31's Vermeer in an hourglass mask.

**The honest warning.** p31 additionally uses a real, identifiable painting. That is a
rights question, not just a rendering one.

---

## 10. Object-on-field hero — 2 posters
**p24, p38**

**Skeleton.** One isolated object — cut out, rendered or glowing — floats on a flat
colour field with no frame. Type is arranged around it in the margins rather than over
it.

**What dominates.** The object, and the emptiness around it.

**Why it works.** The negative space is confident. p24 has no background at all beyond a
soft dark halo; p38 puts a grey 3D render on signal orange and boxes the metadata into a
ruled footer plate.

**The honest warning.** It is a two-poster family and both members depend entirely on a
bespoke object. The *layout* generalises; the object does not.

---

## Cross-cutting treatments

These are filters and finishes, not skeletons. Any of them can be applied to most of
the ten families, and several posters carry two at once.

| Treatment | Seen on | What it does |
|---|---|---|
| Halftone screen | p16, p20, p39 | Coarse dots; makes an image read as printed |
| Duotone / monotone tint | p09, p13, p25, p28, p39 | Reduces a photo to one or two inks; hides poor source material |
| Riso misregistration | p25 | Offset ink layers, crop marks, degraded micro-type |
| Chromatic glow / gradient | p07, p24, p26 | Iridescent bleed as a border (p26), a whole ground (p07) or a halo (p24) |
| Paper grain / texture | p01, p25, p32, p39 | Fine noise over the whole field |
| Motion blur as background | p35 | Turns any photograph into an abstract colour field |
| Mockup presentation | p22, p23 | Poster shown on a wall with a paper margin and drop shadow |

The generator should treat these as a post-processing stage over a solved layout. Five
of them are pure pixel operations on a canvas and are independent of every layout
decision above.
