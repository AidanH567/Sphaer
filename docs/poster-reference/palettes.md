# Palette findings

Every hex on this page was sampled from a poster file. Nothing here was chosen by eye
or invented to fill a gap. Method is in [README.md](README.md).

## What is wrong with the current list

`src/constants/poster-palette.ts` holds eight `{ bg, fg, accent }` triples, selected by
`posterPalette[hashSeed(seed) % posterPalette.length]` — an FNV-1a hash of title plus
start time, modulo 8.

**It collides, and the arithmetic is not close.** With 8 palettes and a uniform hash,
the chance that a wall of 8 posters shows 8 different colourways is `8! / 8⁸` = **0.24%**.
The expected number of *distinct* palettes across 8 posters is **5.25** — so a typical
screen of eight generated posters shows about five colourways, with three of them
doubled. On a Mural, which is the whole point of the feature, that is the first thing
a viewer notices.

**Two of the eight pairs use colours that appear nowhere in Lara's 39.** The file's
comment says these "echo the hand-authored seed posters … Berlin risograph / Das Plakat
territory". Checked against the source that claim is half true:

| Current token | Verdict against the 39 |
|---|---|
| `#F5D547` yellow | Real — p12 uses `#F1CC42`, p20 `#E6CA2E` |
| `#C9382E` red | Real — p31 `#AD2527`, p28 `#9D3C3E` |
| `#F26B3A` orange | Real — p01 `#F35300`, p36 `#C93818`, p38 `#E63E00` |
| `#0E1F3A` navy | Real — p04 `#1A3758` |
| `#39FF14` acid green | **Absent.** Nearest is p33's `#D0E537` and p19's `#95C479`. Neither is neon; both are yellow-greens. |
| `#EB46B0` magenta | **Absent as an accent.** It occurs once, as one scrap inside p32's collage (`#DD3B83`). Never as a poster's accent colour. |

Acid green and magenta are a *received idea* of risograph, not the thing itself. Lara's
riso poster (p25) is pink and black.

**The deeper problem is the selection, not the list.** `bg` and `fg` are chosen without
any knowledge of the layout. Nothing stops acid green on black landing under a Swiss
editorial grid, where it reads as a costume rather than a design decision — because in
the real posters the ground and the skeleton are chosen together.

## What Lara actually does

Three findings, all countable across the 38 distinct posters:

**1. A poster is one ground plus one ink, and often nothing else.** The saturated-ink
pass found *no* colour above the 0.3%-of-poster threshold at all in p10, p14 and p19 —
three complete, confident posters with zero saturated colour. Where a third colour does
appear it is a single small element: p20's two yellow tape marks, p12's blue keyline,
p21's red and blue registration squares.

**2. Grounds split roughly in thirds.**

| Ground type | Count | Examples | Who uses it |
|---|---|---|---|
| Neutral / near-white / bone | 13 | p05 `#EBEBEB`, p10 `#EEF1F6`, p39 `#EAE7E2`, p01 `#F4EBD4` | Swiss editorial, duotone, object-on-field |
| Saturated mid-tone field | 16 | p37 `#FDEC01`, p08 `#F4B1C7`, p19 `#95C479`, p33 `#D0E537` | Centred axial, type-as-image, flat geometric |
| Near-black / deep | 9 | p21 `#0E0D0D`, p36 `#150904`, p14 `#324D43`, p11 `#5B1B1C` | Dark technical, centred axial, type-frame |

**3. Where the ground is neutral, the photograph supplies the colour. Where the ground
is saturated, the photograph is usually tinted to match it or removed.** p28 tints its
photo red to sit on sage; p13 tints blue to sit on periwinkle; p25 tints pink on pink.
The ground and the image ink are never fighting.

## Twenty-three palettes taken from the posters

Grouped by ground type, because that is what has to agree with the layout. `bg` and
`accent` are sampled directly. `fg` is the measured neutral type tone where one was
cleanly separable, otherwise normalised to near-black or near-white — flagged with † .

### Neutral ground — the image carries the colour

| Name | bg | fg | accent | From |
|---|---|---|---|---|
| Bone & vermilion | `#F4EBD4` | `#2A2928` | `#F35300` | p01 |
| Paper & signal red | `#EAE7E2` | `#1A1A1A` † | `#D94010` | p39 (2nd duotone ink `#4D2B81`) |
| Bone & pure red | `#EBEBEB` | `#F10000` | — | p05 |
| Chalk & ink | `#EEF1F6` | `#181818` | — | p10 (no saturated ink at all) |
| Cool grey & ultramarine | `#D3D3D3` | `#2042E7` | `#6982EF` | p09 |
| Pale sage & brick | `#CED7D5` | `#833231` | `#D44D55` | p28 |
| Grey & lemon | `#D9DAD3` | `#28261F` | `#F1CC42` | p12 |

### Saturated field — the ground is the design

| Name | bg | fg | accent | From |
|---|---|---|---|---|
| Pink & pine | `#F4B1C7` | `#1C1417` | `#195754` | p08 |
| Meadow & ink | `#95C479` | `#040404` | — | p19 (no saturated ink) |
| Acid yellow & black | `#FDEC01` | `#000000` | — | p37 |
| Acid chartreuse & pitch | `#D0E537` | `#0D210D` | `#945F21` | p33 |
| Signal orange & concrete | `#E63E00` | `#FFFFFF` † | `#CDCDCD` | p38 |
| Blush & coral | `#E5AFA6` | `#7E3E2C` | `#EA5C4D` | p15 |
| Riso pink & ink | `#EDC4CA` | `#141211` | `#ED626E` | p25 |
| Periwinkle & lemon | `#757DEB` | `#ECE570` | `#151C4F` | p13 |
| Pale shell & navy | `#F5D5CE` | `#1A3758` | `#DE7237` | p04 |
| Deep red & bone | `#AD2527` | `#FFFFFF` † | — | p31 |

### Dark ground

| Name | bg | fg | accent | From |
|---|---|---|---|---|
| Deep forest & mint | `#324D43` | `#D9E4E3` | — | p14 (no saturated ink) |
| Bitumen & ember | `#150904` | `#F3EFE5` † | `#C93818` | p36 |
| Ink & lemon | `#151616` | `#FBFBFB` | `#E6CA2E` | p20 |
| Instrument black | `#0E0D0D` | `#C0B9C5` | `#616CD0` + `#8B3B3A` | p21 (two accents, by design) |
| Aubergine & sky | `#3E2358` | `#FCFCFC` | `#609CC3` | p18 |
| Oxblood & bone | `#5B1B1C` | `#C2AF90` | — | p11 |

Note that **six of the twenty-three have no accent at all**, matching what the posters
do. An `accent` field that is always populated is itself a source of sameness — the
type should allow `accent?: string`.

## Which families constrain which palettes

Palette must be selected *within* a family, not independently of it. The mapping the
posters actually support:

| Family | Ground group | Notes |
|---|---|---|
| Swiss editorial grid | Neutral only | The photo supplies colour. A saturated ground fights the grid — except p12, where the yellow is a *block within* the grid, not the ground. |
| Centred axial | Saturated or dark | p14 forest, p15 blush, p36 bitumen. A neutral ground leaves a symmetric layout looking empty. |
| Type-as-image | Saturated or dark | The ground is half the poster's area; it has to carry. p08 pink, p33 chartreuse, p30 yellow. |
| Display type over full-bleed photo | Ground is barely visible | Pick `fg`/`accent` from the photo, not from a list. p11 works because the ground matches the backdrop. |
| Duotone / halftone / riso | Neutral or saturated, **hue-matched to the ink** | Hard constraint: ground and image ink must share a hue family. p25 pink-on-pink, p13 blue-on-blue. A random pairing breaks it. |
| Dark technical | Dark only | Near-black is definitional. Accents stay under 2% coverage. |
| Collage & cutout | Any | The collage brings its own colour; the ground is a backing sheet (p32 black, p06 green). |
| Flat geometric / modular | Saturated, needs 3–4 colours | The only family that genuinely wants more than two. p04 uses shell, navy, orange and mint. |
| Illustration-led | Set by the artwork | Not selectable. |
| Object-on-field hero | Neutral or one saturated | p24 near-white, p38 signal orange. |

## Three recommendations

1. **Store palettes grouped by ground type** (neutral / saturated / dark), and let the
   family declare which groups it accepts. Selection becomes: solve family → filter
   palettes → hash within the filtered set. This kills the acid-green-under-a-Swiss-grid
   failure at the type level rather than by review.

2. **Make `accent` optional** and leave it off about a quarter of the time, as Lara does.

3. **Deduplicate at the wall, not in the hash.** Even 23 palettes only lifts the
   all-distinct probability for 8 posters from 0.24% to about 25% — better by two orders
   of magnitude and still not enough. The hash cannot see a poster's neighbours; the
   Mural can. Pass the neighbour palettes in, or pass an index, and let the selector
   avoid an immediate repeat. That is a small change with a larger visible effect than
   any number of new colours.
