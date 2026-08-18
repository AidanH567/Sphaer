# The 39 posters, one by one

Every entry below was written after looking at the image, not at its filename. The hex values were sampled programmatically (Pillow median-cut over the full image, plus a second pass restricted to pixels above 45% saturation so that thin coloured type is not averaged away into its background). They are what is actually in the file.

`Ground` is the dominant colour in a 5% border ring, which is a better proxy for the paper than the overall mode. `Ink` lists the saturated colours occupying at least 0.3% of the poster, largest first. `Dark` / `light` are the extreme tones, which is usually where the type colour lives. `Field colours` is the whole quantised set. Median-cut splits one flat colour into several near-identical bins, so entries within a small distance of each other have been merged and their coverage summed.

Reproducibility codes are explained in [generator-implications.md](generator-implications.md):
**A** = a layout solver can build it from event data alone - **B** = needs a supplied photograph - **C** = needs human illustration or generated imagery.

Images live outside git - see [README.md](README.md) for the path. The ids below (`p01`...`p39`) match the labels on [contact-sheet.jpg](contact-sheet.jpg).

---

## Swiss editorial grid  
*5 posters*

### p05 - Urban Futures - Book Launch

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 19_06_59 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#EBEBEB` |
| Ink | `#F10000` (2.1%), `#895937` (1.9%), `#E21C1B` (1.7%) |
| Dark / light | `#7C342A` / `#EEF2F2` |
| Field colours | `#EBEBEB` `#804A3D` `#CBBEBA` |

**Type.** Red transitional serif headline, two flush-left lines; time and date set in the SAME size as the headline, flush right.

**Worth stealing.** The date is display type, not caption type. For an events product where date is the point, this is the most directly useful idea in the set.

### p10 - Lines, Borders, Bodies

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 19_45_20 1.png` |
| Size | 768 x 1344 px (0.571) |
| Seed asset | **yes** - `scripts/seed-assets/posters/lines-borders-bodies.png` |
| Reproducibility | **B - needs a photo** |
| Ground | `#EEF1F6` |
| Ink | _none above threshold_ |
| Dark / light | `#343434` / `#F5F7F8` |
| Field colours | `#EEF1F5` `#E2E5E7` `#373737` |

**Type.** Centred grotesk caps headline; 01/02/03 numbered captions above each image; centred venue and date block.

**Worth stealing.** Three portraits in a row with numbered labels - a speaker line-up solved as a grid. Directly maps onto an event with named hosts.

### p12 - Refined Play. Elevated.

| | |
|---|---|
| Source file | `Use AI Image Jun 13, 2026, 13_22_08 1.png` |
| Size | 832 x 1248 px (0.667) |
| Seed asset | **yes** - `scripts/seed-assets/posters/refined-play.png` |
| Reproducibility | **B - needs a photo** |
| Ground | `#D9DAD3` |
| Ink | `#F1CC42` (35.5%) |
| Dark / light | `#555B55` / `#DFE2E0` |
| Field colours | `#DADACF` `#F1CC42` `#5A5E54` `#CEC590` |

**Type.** Heavy grotesk in three short sentences with full stops; small bold meta block; a wordmark bottom-left.

**Worth stealing.** A thin blue keyline frame crossing both the yellow colour field and the photograph. One frame unifies two blocks that share nothing else.

### p19 - Technology & Nature Friction

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 12_23_13 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#95C479` |
| Ink | _none above threshold_ |
| Dark / light | `#080808` / `#A5CE8B` |
| Field colours | `#95C478` `#090909` `#6B815D` |

**Type.** Condensed caps headline with a rule beneath; two labelled meta columns (DATE / LOCATION) with bullet markers and rules.

**Worth stealing.** The clearest information design in the set. Labelled fields with rules is exactly how event data wants to be set.

### p28 - Queer Gaze

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 15_56_25 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#CED7D5` |
| Ink | `#833231` (9.8%), `#5F2A29` (8.1%), `#D44D55` (6.3%) |
| Dark / light | `#502524` / `#D0DBD9` |
| Field colours | `#CED7D5` `#512524` `#9D3C3E` `#CF6C6F` |

**Type.** Very large lowercase grotesk headline with a rule under it, then a fine-print block; barcode and micro-type in the footer.

**Worth stealing.** The photograph tinted to a single red so it stops being a photograph and becomes a colour field. Hides a mediocre image completely.

---

## Centred axial  
*5 posters*

### p09 - Movement Photography Workshop

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 19_39_03 1.png` |
| Size | 896 x 1152 px (0.778) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#D3D3D3` |
| Ink | `#6982EF` (8.7%), `#4160EA` (8.2%), `#1E41E6` (7.7%) |
| Dark / light | `#2042E7` / `#D9D9DA` |
| Field colours | `#D3D3D3` `#2B4CE8` `#647EEC` `#A8B4EA` |

**Type.** High-contrast display serif, three centred lines, with a lighter serif standfirst beneath.

**Worth stealing.** The duotone blue of the photo is EXACTLY the type blue. One hue does the entire poster; the photo becomes a tint rather than a picture.

### p14 - Shaped by Hand, Fired by Time - Ceramics Workshop

| | |
|---|---|
| Source file | `Use AI Image Jun 14, 2026, 19_57_21 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#324D43` |
| Ink | _none above threshold_ |
| Dark / light | `#282D2B` / `#DAE5E4` |
| Field colours | `#334D43` `#D7E3E2` `#2D3C35` |

**Type.** Heavy grotesk caps in two centred headline blocks sandwiching the image; a single-line footer holding every detail.

**Worth stealing.** The most mechanically reproducible poster here: margin, keyline, headline, framed image, second headline, one-line footer. Nothing else happens.

### p15 - Pleasure of the Senses

| | |
|---|---|
| Source file | `Use AI Image Jun 14, 2026, 20_03_41 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#E5AFA6` |
| Ink | `#EA5C4D` (26.0%), `#B04C32` (3.2%) |
| Dark / light | `#7E3E2C` / `#DDC3B7` |
| Field colours | `#E96151` `#E5AFA6` `#DDC3B7` `#C65242` |

**Type.** Display serif with an italic middle word; date and time as small blocks flanking the circle left and right.

**Worth stealing.** Two concentric circles - a pale field, then the photo cropped round - turn a plain centred layout into a target. Radial symmetry from two shapes.

### p34 - Tibetan Teachings in Berlin

| | |
|---|---|
| Source file | `Use AI Image Jun 18, 2026, 16_31_42 1.png` |
| Size | 763 x 1133 px (0.673) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#AB7C59` |
| Ink | `#AF5539` (9.6%), `#CC724E` (8.2%), `#774235` (8.0%) |
| Dark / light | `#68473E` / `#E6D8C2` |
| Field colours | `#C4AD9D` `#BD7455` `#697169` `#DECEB8` `#AE573B` |

**Type.** White display serif, centred, deliberately low-contrast against the artwork behind it.

**Worth stealing.** A photograph OF an artwork, full bleed, with its own edges and texture left in. The object's imperfection is the design.

### p36 - Fuego Libre

| | |
|---|---|
| Source file | `fuego-libre-poster 1.png` |
| Size | 821 x 1158 px (0.709) |
| Seed asset | **yes** - `scripts/seed-assets/posters/fuego-libre.png` |
| Reproducibility | **A - solver only** |
| Ground | `#150904` |
| Ink | `#C93818` (14.9%) |
| Dark / light | `#100703` / `#C56749` |
| Field colours | `#120904` `#C2593A` |

**Type.** Cream condensed caps name centred low; letterspaced mono meta as a running head and a footer rule.

**Worth stealing.** Near-black ground with one saturated circle. The cheapest high-impact poster in the set - a rect, a circle, and three text blocks.

---

## Type-as-image  
*6 posters*

### p07 - Sunset Synth Sessions

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 19_31_45 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **A - solver only** |
| Ground | `#D49775` |
| Ink | `#E77475` (16.1%), `#EB8963` (9.0%), `#EB9D50` (6.5%) |
| Dark / light | `#000000` / `#8FAECF` |
| Field colours | `#A692BC` `#EB7874` `#DF9071` `#91A9CA` `#010100` |

**Type.** The headline set twice, rotated to two different angles so the two settings overlap and interfere.

**Worth stealing.** A hard horizontal split between two gradients, with a black footer bar as a third register. No photograph anywhere and it still looks art-directed.

### p08 - Berlin Shiatsu Workshop

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 19_36_21 1.png` |
| Size | 864 x 1184 px (0.730) |
| Seed asset | **yes** - `scripts/seed-assets/posters/berlin-shiatsu.png` |
| Reproducibility | **A - solver only** |
| Ground | `#F4B1C7` |
| Ink | `#195754` (11.4%) |
| Dark / light | `#1E2E2F` / `#F6B5CA` |
| Field colours | `#F4B1C7` `#1E4544` |

**Type.** Giant condensed caps rotated 90 degrees running the full poster height; date numerals set large and horizontal across it.

**Worth stealing.** The entire left third given to a vertical title. This is the answer to 'the event has no image' - it needs nothing but a title and a colour.

### p20 - Nigerian Film Festival

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 13_23_38 1.png` |
| Size | 832 x 1248 px (0.667) |
| Seed asset | **yes** - `scripts/seed-assets/posters/nigerian-film-festival.png` |
| Reproducibility | **B - needs a photo** |
| Ground | `#151616` |
| Ink | `#E6CA2E` (1.8%) |
| Dark / light | `#0B0B0C` / `#F2F2F1` |
| Field colours | `#161717` `#959595` `#BDB9A6` `#F1EFE8` |

**Type.** White grotesk caps running along all four edges, each side rotated to face inward, boxing the image in.

**Worth stealing.** Type used as a frame. The halftone photo sits in the well the type creates, and two yellow tape marks are the only colour in the poster.

### p29 - Berlin Open

| | |
|---|---|
| Source file | `Use AI Image Jun 17, 2026, 17_09_28 1.png` |
| Size | 816 x 1049 px (0.778) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#5F8FB5` |
| Ink | `#5B94BD` (36.8%), `#427AA2` (9.7%) |
| Dark / light | `#5F5960` / `#E7E8E0` |
| Field colours | `#5586AC` `#67A0C9` `#E2E0D6` `#5792BC` `#C3CCC1` |

**Type.** Giant translucent white display caps; the hand and ball pass in front of some letters and behind others.

**Worth stealing.** Subject-aware masking of the headline. It is the whole trick of the poster and it needs a depth mask, not just an alpha.

### p30 - Doin Damage - City Spike Open

| | |
|---|---|
| Source file | `Use AI Image Jun 17, 2026, 17_18_41 1.png` |
| Size | 896 x 1152 px (0.778) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#FAF809` |
| Ink | `#F9F608` (24.4%), `#646034` (13.7%) |
| Dark / light | `#4A4325` / `#E3DF5C` |
| Field colours | `#FAF706` `#B8BC9C` `#6F9497` `#617160` `#4A4426` |

**Type.** Yellow display caps warped along an arc; marquee repeat strips top and bottom; rotated labels up both margins.

**Worth stealing.** Repeating the event name as a border marquee. It fills dead space with brand instead of with nothing.

### p33 - Speak Up

| | |
|---|---|
| Source file | `Use AI Image Jun 18, 2026, 15_53_58 1.png` |
| Size | 832 x 1248 px (0.667) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#D0E537` |
| Ink | `#CEE336` (36.1%), `#945F21` (19.3%) |
| Dark / light | `#0D210D` / `#D2E839` |
| Field colours | `#CEE237` `#0D210D` `#CB8F35` |

**Type.** Giant display caps with photography knocked INSIDE the letterforms; a film-billing block at the foot.

**Worth stealing.** Text as a clip path over an acid ground. Highest impact per unit of data in the whole set - it needs only a title and a face.

---

## Display type over full-bleed photo  
*3 posters*

### p11 - Mono no Aware - Haruki-Nozomi Tanaka

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 20_04_47 1.png` |
| Size | 768 x 1344 px (0.571) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#5B1B1C` |
| Ink | `#521718` (22.6%), `#651F1F` (20.4%), `#7F2526` (10.7%) |
| Dark / light | `#230D0C` / `#C3B193` |
| Field colours | `#551E1C` `#471213` `#762826` |

**Type.** Heavy caps name bottom-left; dense small-caps information block top-right; a sponsor logo strip in the footer.

**Worth stealing.** The studio backdrop and the poster ground are the same deep red, so the photo has no visible edge. Full-bleed without looking like a stock photo.

### p17 - Voices of the Black Diasporia

| | |
|---|---|
| Source file | `Use AI Image Jun 14, 2026, 20_37_39 1.png` |
| Size | 896 x 1152 px (0.778) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#FAFBF7` |
| Ink | `#AF3B1E` (15.6%), `#812C16` (14.2%), `#A45A2A` (10.2%) |
| Dark / light | `#26110F` / `#FDFEFD` |
| Field colours | `#9D2F19` `#B14623` `#F5F7EC` `#C3CC86` `#3E391A` |

**Type.** Centred display serif caps in white, with grotesk caps for the practical details.

**Worth stealing.** Checkerboard strips top and bottom framing a blurred photo. NOTE: this file is a screen capture - a play-button UI control is baked into the top-right corner.

### p18 - INK - Get ready with me

| | |
|---|---|
| Source file | `Use AI Image Jun 14, 2026, 20_47_53 1.png` |
| Size | 880 x 992 px (0.887) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#3E2358` |
| Ink | `#3E2358` (37.5%), `#609CC3` (13.4%) |
| Dark / light | `#0E0E15` / `#E9EDEF` |
| Field colours | `#3E2358` `#7AA6C3` `#E7EBEE` `#1E162A` |

**Type.** Geometric sans headline above the photo, then a giant white INK knocked across the photo's middle.

**Worth stealing.** The title word sized to the photo's exact width and placed at the subject's torso, not over her face. Placement is subject-aware.

---

## Duotone / halftone / riso  
*4 posters*

### p13 - Puppy Play Date

| | |
|---|---|
| Source file | `Use AI Image Jun 13, 2026, 13_31_51 1.png` |
| Size | 864 x 1184 px (0.730) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#757DEB` |
| Ink | `#626BE3` (25.6%), `#757DEB` (22.0%), `#30377C` (13.9%) |
| Dark / light | `#151C4F` / `#ECE570` |
| Field colours | `#757CEB` `#656EE5` `#191F55` `#7D84DE` |

**Type.** Heavy caps rotated a few degrees off horizontal, in yellow; small angled labels scattered as counterweights.

**Worth stealing.** A barely-visible checkerboard tint on the ground, so a flat colour field still has surface. Cheap texture that survives compression.

### p16 - Active Listening - A Sound Art Evening

| | |
|---|---|
| Source file | `Use AI Image Jun 14, 2026, 20_11_04 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **A - solver only** |
| Ground | `#FFFFFF` |
| Ink | `#5C9E9E` (2.4%), `#FBEC56` (4.3%) |
| Dark / light | `#000000` / `#FFFFFF` |
| Field colours | `#000000` `#FFFFFF` `#B8BCA1` `#FBFAE3` `#576767` |

**Type.** Yellow condensed caps headline on black; footer split into a left and right column.

**Worth stealing.** The 'artwork' is two circles of ruled lines with sine curves through them. A canvas renderer can DRAW this - it needs no photograph and no artist.

### p25 - Eiswald - Industrial Folk Assembly

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 15_31_12 1.png` |
| Size | 864 x 1184 px (0.730) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#EDC4CA` |
| Ink | `#ED626E` (2.0%), `#853F4A` (1.6%), `#CB5663` (1.5%) |
| Dark / light | `#1C171A` / `#F6D1D8` |
| Field colours | `#1C171A` `#EEC8D0` `#B16871` |

**Type.** Huge condensed caps name across the bottom; small caps meta right-aligned above it; deliberately degraded micro-type.

**Worth stealing.** Crop marks at the four corners plus a cut-out subject floating in pink. It reads as a printed object rather than an image.

### p39 - No Game - VR Meet Up

| | |
|---|---|
| Source file | `use-this-as-a-reference-replace-the-pige_NdbOi4TxXE2pTz79XmSZ9A_YTR7KAIpQ42ytpSj5T7O7g 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#EAE7E2` |
| Ink | `#4D2B81` (9.6%), `#D73D0D` (16.8%) |
| Dark / light | `#743160` / `#F2EFE9` |
| Field colours | `#D94010` `#EAE7E2` `#8D5673` |

**Type.** Enormous condensed caps in orange-red overlapping the subject; the footer set as two full-width lines.

**Worth stealing.** A blue halftone photo plus orange-red type on paper stock. Two inks, and the type overlaps the image with no containing box.

---

## Dark technical / scientific  
*3 posters*

### p21 - Civic AI Berlin

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 15_11_02 1.png` |
| Size | 864 x 1184 px (0.730) |
| Seed asset | **yes** - `scripts/seed-assets/posters/civic-ai-berlin.png` |
| Reproducibility | **C - needs an artist** |
| Ground | `#0E0D0D` |
| Ink | `#616CD0` (1.5%), `#8B3B3A` (1.1%), `#C76563` (1.0%) |
| Dark / light | `#0B0A0B` / `#8D8091` |
| Field colours | `#0E0D0D` `#8B7F90` |

**Type.** Light-weight sans throughout; tiny running heads at all four corners; nothing set heavy.

**Worth stealing.** Red and blue registration squares with crosshairs laid over the subject. Two rectangles and four ticks buy instant scientific-instrument authority.

### p22 - Quantum / Mesh Interfaces

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 15_17_46 1 (1).png` |
| Size | 832 x 1248 px (0.667) |
| Seed asset | no |
| Reproducibility | **C - needs an artist** |
| Ground | `#DADADA` |
| Ink | `#3C8C96` (3.2%), `#295760` (2.2%), `#46AFB5` (2.0%) |
| Dark / light | `#110F16` / `#F2F2F2` |
| Field colours | `#191B21` `#F3F3F3` `#3D626A` |

**Type.** Heavy grotesk headline in a left column; hairline meta rows across the top and foot; an outsized 19 bottom-right.

**Worth stealing.** Presented as a poster-on-wall mockup, with a white paper margin and a drop shadow. The mockup itself is doing some of the work.

### p23 - Quantum / Mesh Interfaces (duplicate file)

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 15_17_46 1.png` |
| Size | 832 x 1248 px (0.667) |
| Seed asset | no |
| Reproducibility | **C - needs an artist** |
| Ground | `#DADADA` |
| Ink | `#3C8C96` (3.2%), `#295760` (2.2%), `#46AFB5` (2.0%) |
| Dark / light | `#110F16` / `#F2F2F2` |
| Field colours | `#191B21` `#F3F3F3` `#3D626A` |

**Type.** Byte-identical to p22.

**Worth stealing.** Nothing new - this is the same file supplied twice. 39 files, 38 distinct posters.

---

## Collage & cutout  
*5 posters*

### p02 - Illustrate - Visual Communication Class

| | |
|---|---|
| Source file | `Group 1.png` |
| Size | 924 x 1184 px (0.780) |
| Seed asset | no |
| Reproducibility | **C - needs an artist** |
| Ground | `#1A1A1A` |
| Ink | `#814EBD` (3.8%), `#2F317A` (3.7%), `#E45270` (3.2%) |
| Dark / light | `#040505` / `#C5C1AF` |
| Field colours | `#1D1B1A` `#AA5B8E` `#C4C0AE` `#3C2F47` |

**Type.** High-contrast didone display bleeding off the top edge, partly occluded by the hand.

**Worth stealing.** The subject passes IN FRONT of the display type. The poster reads as depth rather than stacked layers, and it costs one mask.

### p06 - Afro-Cuban Summer

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 19_22_48 1.png` |
| Size | 896 x 1152 px (0.778) |
| Seed asset | **yes** - `scripts/seed-assets/posters/afro-cuban-summer.png` |
| Reproducibility | **B - needs a photo** |
| Ground | `#9CC270` |
| Ink | `#41413F` (5.9%), `#D8AB44` (5.1%), `#807938` (4.4%) |
| Dark / light | `#0C191E` / `#BED381` |
| Field colours | `#60955B` `#24281F` `#9DC170` `#CBB761` `#527745` |

**Type.** Chartreuse heavy caps top-left, white caps floating free at mid-right, centred three-line footer block.

**Worth stealing.** A dot-grid ground behind a photo block that stops short of the margins, so the photo reads as pasted onto a printed sheet.

### p26 - Sensory Drift

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 15_44_42 1.png` |
| Size | 896 x 1152 px (0.778) |
| Seed asset | **yes** - `scripts/seed-assets/posters/sensory-drift.png` |
| Reproducibility | **C - needs an artist** |
| Ground | `#B3A39C` |
| Ink | `#884243` (2.6%), `#CF4D71` (2.2%), `#C1616C` (1.9%) |
| Dark / light | `#242221` / `#B6C1A1` |
| Field colours | `#AFAFAD` `#B07B8B` `#7B7671` `#864D54` `#282725` |

**Type.** Black condensed caps top, centred; a four-line caps footer block.

**Worth stealing.** A chromatic rainbow glow bleeding in from all four edges of a flat grey field. The glow is a border, not a background.

### p32 - Flea Market - Vintage Clothing Treasures

| | |
|---|---|
| Source file | `Use AI Image Jun 17, 2026, 17_33_50 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **C - needs an artist** |
| Ground | `#232323` |
| Ink | `#753A35` (7.1%), `#DD3B83` (6.7%), `#CE704D` (6.3%) |
| Dark / light | `#1F1E1E` / `#DBC8A3` |
| Field colours | `#232323` `#ABDAA7` `#C4665B` `#63594F` |

**Type.** Heavy caps headline half-hidden behind the photo; taped paper labels in a second, smaller face.

**Worth stealing.** Neon colour blocks behind the subject and torn-paper labels on top. Depth from three distinct material layers.

### p35 - Earthbodies: Eco-Feminist Playground

| | |
|---|---|
| Source file | `earthbodies 1.png` |
| Size | 865 x 1112 px (0.778) |
| Seed asset | **yes** - `scripts/seed-assets/posters/earthbodies.png` |
| Reproducibility | **C - needs an artist** |
| Ground | `#1E3326` |
| Ink | `#C79C4B` (10.1%), `#733938` (5.3%) |
| Dark / light | `#0F130F` / `#D7C7B0` |
| Field colours | `#223827` `#CABAA0` `#B68975` `#C39D58` `#757A5E` |

**Type.** Pink caps headline top, two lines; centred two-line footer.

**Worth stealing.** A motion-blurred green field behind a sharp portrait on a yellow card. Blur used as a background generator - any photo becomes usable.

---

## Flat geometric / modular  
*3 posters*

### p01 - Jam Session

| | |
|---|---|
| Source file | `Bildschirmfoto 2026-06-12 um 19.11.55 1.png` |
| Size | 847 x 1202 px (0.705) |
| Seed asset | no |
| Reproducibility | **A - solver only** |
| Ground | `#F4EBD4` |
| Ink | `#F35300` (8.1%) |
| Dark / light | `#BA7A54` / `#FBF5DD` |
| Field colours | `#F4EBD4` `#BC7E59` |

**Type.** Condensed grotesk display stacked flush-left over two sizes; letterspaced mono caps for all meta; hairline rules separating registers.

**Worth stealing.** One orange circle reads as basketball AND vinyl AND sun, with a musical stave ruled straight through it. A single primitive carrying three meanings costs a generator almost nothing.

### p04 - Jazz Basketball Fusion

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 19_01_39 1.png` |
| Size | 831 x 1150 px (0.723) |
| Seed asset | no |
| Reproducibility | **A - solver only** |
| Ground | `#F5D5CE` |
| Ink | `#1A3758` (14.1%), `#E6914B` (8.6%), `#DE7237` (7.2%) |
| Dark / light | `#192D44` / `#F9DBD4` |
| Field colours | `#F5D4CD` `#CE6737` `#182D44` `#D69A6A` |

**Type.** Heavy grotesk caps set vertically up the right margin at 90 degrees; meta flush-left beneath the tile block.

**Worth stealing.** A 4x4 tile grid of flat colour, with ONE continuous line (the saxophone) crossing cell boundaries. Grid plus a deliberate rule-breaker.

### p37 - Contact Improvisation

| | |
|---|---|
| Source file | `use-image-for-colors-and-fonts-to-make-a_XPo9VGuDUY-p-miN8pgzQQ_G4ZF4ZkfQXafDLgCTnGIrA 1 (2).png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **B - needs a photo** |
| Ground | `#FDEC01` |
| Ink | `#FDED01` (24.7%) |
| Dark / light | `#000000` / `#FDEF08` |
| Field colours | `#000000` `#FCEC00` `#85857B` `#616059` |

**Type.** Grotesk caps top-left; the title rotated 90 degrees running up the centre-left; footer split left and right.

**Worth stealing.** Black rounded-rectangle blocks cut into a yellow field as a bespoke mask for the photograph. The mask is the identity.

---

## Illustration-led & painterly  
*3 posters*

### p03 - Queer Film Night

| | |
|---|---|
| Source file | `Use AI Image Jun 12, 2026, 18_57_10 1.png` |
| Size | 673 x 1151 px (0.585) |
| Seed asset | no |
| Reproducibility | **C - needs an artist** |
| Ground | `#E1AB67` |
| Ink | `#C85937` (18.4%), `#334873` (18.3%), `#BA7E4C` (15.9%) |
| Dark / light | `#1A1E42` / `#F1D88C` |
| Field colours | `#D78345` `#2B4976` `#1A1F44` `#DDA168` `#D85636` |

**Type.** Deco-flavoured display caps filled with a gold-to-coral gradient, two centred lines.

**Worth stealing.** One long curving object (the film strip) drawn across the whole field ties three unrelated figures into one composition.

### p27 - Live Sketching Bauhaus Movements

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 15_50_17 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **C - needs an artist** |
| Ground | `#FEFEFE` |
| Ink | `#E78559` (6.3%), `#E47243` (5.8%), `#75DEEA` (3.8%) |
| Dark / light | `#664535` / `#FFFFFF` |
| Field colours | `#97644B` `#FEFEFE` `#A0B0AB` |

**Type.** Heavy grotesk caps top-left; rotated micro-type running up both side margins as texture.

**Worth stealing.** Two rough brush strokes, orange and cyan, behind line drawings. The entire colour scheme is two gestures and their overlap.

### p31 - Light in Painting

| | |
|---|---|
| Source file | `Use AI Image Jun 17, 2026, 17_25_47 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **C - needs an artist** |
| Ground | `#AD2527` |
| Ink | `#AD2527` (75.5%) |
| Dark / light | `#691E1E` / `#806256` |
| Field colours | `#AD2527` `#8D2123` `#856457` |

**Type.** White display serif caps set across the waist of the mask, letterspaced wide.

**Worth stealing.** An hourglass silhouette used as a clipping mask on a classical painting. The image container is a shape, not a rectangle.

---

## Object-on-field hero  
*2 posters*

### p24 - Women in Tech Berlin Network

| | |
|---|---|
| Source file | `Use AI Image Jun 16, 2026, 15_26_36 1.png` |
| Size | 896 x 1152 px (0.778) |
| Seed asset | **yes** - `scripts/seed-assets/posters/women-in-network.png` |
| Reproducibility | **C - needs an artist** |
| Ground | `#FBFBFB` |
| Ink | `#173656` (1.7%), `#445760` (1.5%), `#5A7257` (0.8%) |
| Dark / light | `#1F2935` / `#FCFCFC` |
| Field colours | `#FAFAFA` `#4A555B` `#D9E1DE` |

**Type.** Heavy caps title lower-left; right-aligned meta on the right edge; a tiny centred tagline near the foot.

**Worth stealing.** A near-white ground with a soft dark halo behind the subject. The glow IS the background - no rectangle, no frame, no colour field.

### p38 - Sonic Archives Apparatus

| | |
|---|---|
| Source file | `use-the-image-as-template-for-colors-fon_xF42PF_dUEaPtMxU_dZ9Dg_yDl8t6SfRNWda5O9WveOFA 1.png` |
| Size | 1024 x 1024 px (1.000) |
| Seed asset | no |
| Reproducibility | **C - needs an artist** |
| Ground | `#E63E00` |
| Ink | `#E53E00` (30.7%), `#C83707` (4.9%) |
| Dark / light | `#3E3532` / `#CECDCD` |
| Field colours | `#CDCDCD` `#E53E00` `#646361` `#918884` |

**Type.** A boxed footer lockup divided into ruled cells; a small-caps running head across the top.

**Worth stealing.** The footer built as a bordered table of cells - venue, date, code, mark. Event metadata as a technical specification plate.

---

