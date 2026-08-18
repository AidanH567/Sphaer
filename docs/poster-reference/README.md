# Poster reference — Lara's 39

A structured design reference built from 39 posters by Lara, a Sphaer co-creator.
It exists so the poster generator can be built from evidence rather than from one
person's taste on one afternoon.

## Where the images are

**The 39 PNGs are NOT in this repo.** They are ~56 MB, and this project's rule
(decision of 2026-08-09) is that a capture's assets live outside git while its
writing lives where it is read.

| | |
|---|---|
| Working copy (read this one) | `C:\Users\Aidan\.tina\sphaer-poster-refs\originals\` |
| Aidan's original folder (do not modify) | `C:\Users\Aidan\Desktop\Sphaer Posters\` |
| Files | 39 PNG, ~56 MB, 763–1024 px wide |
| Extraction scripts | `C:\Users\Aidan\.tina\sphaer-poster-refs\*.py` |

The five scripts that produced this reference sit beside the images, so every number
below can be regenerated rather than trusted: `prep.py` (thumbnails, dimensions, seed
matching), `palette.py` and `ink.py` (the two sampling passes), `gen_posters.py`
(emits `posters.md`), `sheet.py` (emits `contact-sheet.jpg`). They need only Pillow.

If that directory is missing, the analysis below still stands on its own, but the
palettes and the per-poster claims cannot be re-verified. Re-copy from the Desktop
folder to restore it.

`contact-sheet.jpg` (314 KB) is committed here on purpose. Every poster is on it,
labelled `p01`–`p39`, and those ids are the keys used throughout. Being able to see
all 39 at once is what makes the taxonomy checkable.

## What is here

| File | What it is |
|---|---|
| [contact-sheet.jpg](contact-sheet.jpg) | All 39 at thumbnail size, labelled `p01`–`p39` |
| [families.md](families.md) | The compositional taxonomy — ten families, by how each poster is BUILT |
| [posters.md](posters.md) | All 39 individually: real name, family, sampled hex palette, type treatment, what to steal |
| [generator-implications.md](generator-implications.md) | What the generator can and cannot actually do, ranked by value-for-effort |
| [palettes.md](palettes.md) | Twenty palettes taken from the posters, and which families constrain which |

## Two facts to know before reading

**The existing seed assets are a subset of this set.** All ten files in
`scripts/seed-assets/posters/` appear here — verified by perceptual hash, all ten
matched at a Hamming distance of 8 or less over a 256-bit hash, six of them at 0 or 1.
The repo has been designing against a quarter of the available evidence.

| Seed asset | is | Seed asset | is |
|---|---|---|---|
| `afro-cuban-summer.png` | p06 | `civic-ai-berlin.png` | p21 |
| `berlin-shiatsu.png` | p08 | `women-in-network.png` | p24 |
| `lines-borders-bodies.png` | p10 | `sensory-drift.png` | p26 |
| `refined-play.png` | p12 | `earthbodies.png` | p35 |
| `nigerian-film-festival.png` | p20 | `fuego-libre.png` | p36 |

**39 files, 38 distinct posters.** `Use AI Image Jun 16, 2026, 15_17_46 1.png` and
`… 1 (1).png` are byte-identical (md5 `14808e60ab3e839c21c63bed0ac937eb`). They are
kept as p22 and p23 so the ids line up with the folder listing.

One other caveat worth carrying: **p17 is a screen capture, not a poster file.** A
play-button UI control is baked into its top-right corner. Its composition is still
readable and it is analysed normally, but it should not be used as a rendering target.

## Method

Every poster was opened and looked at. None of the analysis is inferred from
filenames — 34 of the 39 are named `Use AI Image Jun 12, 2026, 19_11_55 1.png` or
similar and carry no information at all.

Palettes were sampled programmatically, never by eye, in two passes:

1. Pillow median-cut quantisation to 8 colours over the whole image, which gives the
   grounds and the large fields.
2. A second quantisation restricted to pixels above 45% saturation and 30% value,
   which recovers thin coloured type. Pass 1 alone reported p05's headline as a muddy
   `#804A3D` because a hairline red serif on light grey averages into its background;
   pass 2 correctly reports `#F10000`.

Ground colour is the dominant colour in a 5% border ring, which is a better proxy for
"the paper" than the overall mode.
