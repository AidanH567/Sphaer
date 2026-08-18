import fs from 'node:fs';
import crypto from 'node:crypto';

const CREATOR = 'a5dfc2bd-f7c6-499b-8abf-55f51d142620';
const BASE = 'https://dgxmesiouwajazyhbhkn.supabase.co/storage/v1/object/public/event-posters/lara-2026/';

// starts: Berlin local time, CEST (+02:00) — all dates fall before the 2026-10-25 DST change.
const E = [
 {p:'p01',f:'jam-session.png',t:'Jam Session',sub:'Basketball x Jazz Fusion',v:'Kulturfabrik Westend',nb:'Charlottenburg',s:'2026-08-20T19:30',dur:240,c:['Music','Community'],free:true,
  d:'An open jam session where jazz improvisation meets basketball culture. Doors at 19:30, the jam kicks off at 21:00, and entry is free.'},
 {p:'p03',f:'queer-film-night.png',t:'Queer Film Night',v:'Eislicht Kino',nb:'Neukoelln',s:'2026-08-21T20:00',dur:180,c:['Film','Community'],
  d:'A queer film night at a small Neukoelln cinema, screening work that puts queer lives at the centre of the frame. Stay for drinks and talk afterwards.'},
 {p:'p29',f:'berlin-open.png',t:'Berlin Open',sub:'Three days of open tennis',s:'2026-08-22T11:00',end:'2026-08-24T18:00',c:['Meet','Community'],
  d:'A three-day open tennis tournament across Berlin courts, with a draw open to players of every standard. Spectators welcome all three days.'},
 {p:'p18',f:'ink-grwm.png',t:'INK - Get Ready With Me',sub:'Tattoo pop-up showroom',v:'Tattoo Pop-Up Showroom',nb:'Kreuzberg',s:'2026-08-28T18:00',dur:240,c:['Art','Service'],
  d:'A tattoo pop-up in Kreuzberg where visiting artists show their flash and take walk-ins through the evening. Come to browse portfolios or to get inked.'},
 {p:'p37',f:'contact-improvisation.png',t:'Contact Improvisation',sub:'with Lena Fischer and Klaus Weber',s:'2026-08-29T18:00',dur:180,c:['Dance','Workshop'],free:false,price:20,
  d:'A three-hour contact improvisation jam led by Lena Fischer and Klaus Weber, working through weight-sharing, partner rolls and open group scores. All levels; reservation required.'},
 {p:'p13',f:'puppy-play-date.png',t:'Puppy Play Date',sub:'Bring your pup',v:'Tempelhofer Feld',nb:'Tempelhof',s:'2026-08-30T14:00',dur:180,c:['Meet','Community'],
  d:'A relaxed afternoon on Tempelhofer Feld for dog owners and their puppies to run, wrestle and socialise. Bring your pup, bring water, stay as long as you like.'},
 {p:'p09',f:'movement-photography.png',t:'Movement Photography Workshop',sub:'Exploring motion, light and the art of capturing movement',v:'Kunsthaus Kreuzberg',nb:'Kreuzberg',s:'2026-09-05T14:00',dur:240,c:['Workshop','Art'],
  d:'A four-hour photography workshop on shooting bodies in motion - long exposure, panning and available light, with dancers on hand to photograph.'},
 {p:'p30',f:'doin-damage.png',t:'City Spike Open',sub:'Open volleyball tournament, music and food',v:'Preussenpark',nb:'Wilmersdorf',s:'2026-09-06T12:00',dur:360,c:['Meet','Music'],
  d:'An open-air volleyball tournament in Preussenpark, open to all comers, with music and food running alongside the matches all afternoon.'},
 {p:'p38',f:'sonic-archives.png',t:'Sonic Archives Apparatus',sub:'A three-day sound instrument workshop',s:'2026-09-11T11:00',end:'2026-09-13T18:00',c:['Workshop','Music'],
  d:'Three days of building sound-making apparatus out of historic parts - vacuum tubes, gramophone horns, clock movements. Hands-on instrument making paired with experimental sound practice.'},
 {p:'p14',f:'ceramics-workshop.png',t:'Shaped by Hand, Fired by Time',sub:'A ceramics workshop',v:'Toepferei Kreuzberg',addr:'Oranienstrasse 142, 10969 Berlin',nb:'Kreuzberg',s:'2026-09-12T14:00',dur:240,c:['Workshop','Art'],
  d:'A hands-on afternoon at the wheel, throwing and shaping your own vessels with guidance from the studio potters. Pieces are fired and collected later.'},
 {p:'p19',f:'technology-nature-friction.png',t:'Technology and Nature Friction',sub:'A panel on hybrid futures, talks and open debate',v:'silent green Kulturquartier',addr:'Gerichtstrasse 35, 13347 Berlin',nb:'Wedding',s:'2026-09-13T15:00',dur:240,c:['Talk','Technology'],
  d:'A four-hour afternoon of talks and open debate on where technology and the natural world collide, and what a hybrid future actually asks of us.'},
 {p:'p33',f:'speak-up.png',t:'Speak Up',sub:'Berlin premiere screening',v:'Babylon Kino',nb:'Mitte',s:'2026-09-15T19:00',dur:150,c:['Film'],
  d:'The Berlin premiere of Speak Up, screened once with an ensemble cast introduction. A premium cinema selection, one evening only.'},
 {p:'p02',f:'illustrate-class.png',t:'Illustrate',sub:'Visual communication class',s:'2026-09-16T19:30',dur:150,c:['Workshop','Education'],
  d:'An evening class in visual communication and illustration - turning ideas into images that carry, and finding the line that says the most with the least.'},
 {p:'p28',f:'queer-gaze.png',t:'Queer Gaze',sub:'Screening and discussion',v:'Kino Neue Sicht',addr:'Luckenwalder Str. 3, 10963 Berlin',nb:'Kreuzberg',s:'2026-09-18T19:30',dur:180,c:['Film','Community'],
  d:'A screening followed by a moderated discussion on turning away from the male gaze toward a queer one. Presented with the Berlin Queer Film Circle; doors 19:00.'},
 {p:'p07',f:'sunset-synth-sessions.png',t:'Sunset Synth Sessions',sub:'Hands-on synths, sound design and live performance',v:'Spreelounge Rooftop',s:'2026-09-19T19:00',dur:180,c:['Workshop','Music'],
  d:'A rooftop electronic music session starting at sunset - patch a synth, shape a sound, and play it out over the Spree. Hands-on, no experience needed.'},
 {p:'p32',f:'flea-market-vintage.png',t:'Flea Market: Vintage Clothing Treasures',sub:'Vintage clothing and objects',v:'Studio Yard Berlin',s:'2026-09-20T11:00',dur:420,c:['Community','Service'],free:true,
  d:'A one-day yard market of second-hand and vintage clothing plus assorted objects - rails of coats, leather, furs and pattern. Entry is free.'},
 {p:'p22',f:'quantum-mesh-interfaces.png',t:'Quantum / Mesh Interfaces',sub:'A micro-summit on experimental human-machine signal design',v:'Kraftwerk Berlin',nb:'Mitte',s:'2026-09-24T19:30',dur:150,c:['Technology','Talk'],
  d:'A one-evening micro-summit on experimental human-machine signal design, covering neural latency mapping, tactile protocols and secure edge sensing. Limited passes.'},
 {p:'p15',f:'pleasure-of-the-senses.png',t:'Pleasure of the Senses',sub:'An evening of erotic aliveness',addr:'Hofgarten 14, Berlin-Mitte',nb:'Mitte',s:'2026-09-25T18:00',dur:240,c:['Wellness','Community'],
  d:'An evening built around sensuality, touch and embodied presence, held in a Mitte hofgarten. Slow, tactile and deliberately unhurried.'},
 {p:'p25',f:'eiswald.png',t:'Eiswald',sub:'Industrial folk assembly',v:'Kraftwerk Halle',nb:'Mitte',s:'2026-09-26T21:30',dur:300,c:['Music','Nightlife'],
  d:'A late-night industrial folk assembly in a power-station hall - one performer, a wall of speaker cabinets, and a sound system built to be felt.'},
 {p:'p27',f:'live-sketching-bauhaus.png',t:'Live Sketching Bauhaus Movements',sub:'with Lina Hart and Noa Weiss',v:'Studio Orbit',s:'2026-10-01T19:00',dur:150,c:['Art','Workshop'],
  d:'Dancers in Bauhaus-inspired costume hold and flow through movements while you draw them. Two and a half hours of gesture, rhythm and figure work. Materials provided.'},
 {p:'p39',f:'no-game-vr.png',t:'No Game',sub:'Virtual reality meet up',v:'The Spree-Sphere Virtual Stage',s:'2026-10-02T10:00',end:'2026-10-04T18:00',c:['Technology','Meet'],
  d:'A three-day virtual reality meet-up on the Spree-Sphere virtual stage, running 10:00 to 18:00 daily. For builders, players and the merely curious.'},
 {p:'p04',f:'jazz-basketball-fusion.png',t:'Jazz Basketball Fusion',v:'Arena Neukoelln',nb:'Neukoelln',s:'2026-10-03T20:30',dur:180,c:['Music','Concert'],
  d:'Live jazz played around and across a basketball court - horns, a rhythm section, and the squeak of the floor as part of the arrangement.'},
 {p:'p31',f:'light-in-painting.png',t:'Light in Painting',sub:'Masterclass on light techniques',v:'Berlin Painting Studio',nb:'Kreuzberg',s:'2026-10-04T10:00',dur:360,c:['Art','Workshop'],
  d:'A full-day masterclass on how light is constructed in painting, from window light on a figure to the modelling of a still life. Easels and paint provided.'},
 {p:'p05',f:'urban-futures-book-launch.png',t:'Urban Futures',sub:'A book launch on city planning',v:'Haus der Statistik',addr:'Karl-Marx-Allee 1, 10178 Berlin',nb:'Mitte',s:'2026-10-08T19:00',dur:120,c:['Talk','Education'],
  d:'A book launch and open discussion on how cities get shaped and who gets to shape them. Part of an ongoing series of urban planning dialogues.'},
 {p:'p16',f:'active-listening.png',t:'Active Listening',sub:'A sound art evening',v:'silent green',nb:'Wedding',s:'2026-10-09T20:00',dur:150,c:['Music','Art'],
  d:'An evening of sound art built around close, attentive listening - long-form pieces played in a room designed to reward sitting still.'},
 {p:'p11',f:'mono-no-aware.png',t:'Mono no Aware: Haruki-Nozomi Tanaka',sub:'Textiles and ceramics, curated by Yui Sakamoto',v:'Kraftwerk Mitte',nb:'Mitte',s:'2026-10-10T19:00',dur:180,c:['Exhibition','Art'],
  d:'A showroom evening of Japanese craft - boro textiles, indigo shibori studies and a quiet ceramic series. Curated by Yui Sakamoto.'},
 {p:'p34',f:'tibetan-teachings.png',t:'Tibetan Teachings in Berlin',sub:'An evening of contemplation and insight',v:'Haus der Stillen Wolken',s:'2026-10-12T19:00',dur:120,c:['Talk','Wellness'],
  d:'An evening of Tibetan Buddhist teaching and guided contemplation, held in front of a traditional thangka. Open to newcomers and long-time practitioners alike.'},
];

const q = s => (s === null || s === undefined) ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";
const arr = a => 'ARRAY[' + a.map(q).join(',') + ']::text[]';
const ts = local => "'" + local + ":00+02'::timestamptz";
const addMin = (local, m) => { const d = new Date(local + ':00Z'); d.setUTCMinutes(d.getUTCMinutes() + m); return d.toISOString().slice(0, 16); };

if (E.length !== 27) throw new Error('expected 27, got ' + E.length);
const seen = new Set();
for (const e of E) { if (seen.has(e.f)) throw new Error('dup poster ' + e.f); seen.add(e.f); }

const ids = E.map(() => crypto.randomUUID());
const withdraw = ids.map((i, n) => "--     '" + i + "'" + (n === ids.length - 1 ? '' : ',')).join('\n');

let sql = `-- Lara poster set -> Sphaer showcase events
-- Generated ${new Date().toISOString()}
--
-- 27 events, one per unused poster from Lara's 39-file set.
--   39 files - 1 byte-identical duplicate - 10 already live - 1 screen capture (p17) = 27
--
-- Every row: creator_id = the Sphaer profile (never a real person)
--            circle_id  = NULL  so events_notify_circle_after_insert CANNOT fire
--            source     = NULL  Sphaer's own showcase content, not aggregated
--
-- NOTE: trigger on_event_created fires WHEN (source IS NULL) and inserts a
-- self-registration into event_registrations for the creator. Expected; creates
-- no notifications.
--
-- NOTE: event dates deliberately do NOT match the dates printed on the artwork.
-- The printed dates are mostly in the past and would hide these from the feed and
-- the Mural. Starts are spread across 2026-08-20 .. 2026-10-12 instead.
--
-- ---------------------------------------------------------------------------
-- WITHDRAWAL - removes exactly these 27 rows and nothing else:
--
--   delete from public.events where id in (
${withdraw}
--   );
--
-- The event_registrations rows the trigger created go with them via the
-- event_registrations -> events foreign key. Storage objects, if also unwanted:
--   npx supabase storage rm ss:///event-posters/lara-2026/<name>.png --linked --experimental
-- ---------------------------------------------------------------------------

begin;

insert into public.events
  (id, creator_id, circle_id, title, subtitle, description, location_name, address,
   neighbourhood, starts_at, ends_at, categories, poster_url, visibility, is_free, price, source)
values
`;

const rows = E.map((e, n) => {
  const ends = e.end ? ts(e.end) : (e.dur ? ts(addMin(e.s, e.dur)) : 'NULL');
  // marker goes ABOVE the tuple: a trailing "-- pNN" would swallow the row-separator comma.
  return '  -- ' + e.p + ' ' + e.f + '\n' +
         '  (' + q(ids[n]) + ', ' + q(CREATOR) + ', NULL, ' + q(e.t) + ', ' + q(e.sub ?? null) + ',\n' +
         '   ' + q(e.d) + ',\n' +
         '   ' + q(e.v ?? null) + ', ' + q(e.addr ?? null) + ', ' + q(e.nb ?? null) + ',\n' +
         '   ' + ts(e.s) + ', ' + ends + ', ' + arr(e.c) + ',\n' +
         '   ' + q(BASE + e.f) + ',\n' +
         "   'anyone', " + (e.free === false ? 'false' : 'true') + ', ' + (e.price ?? 'NULL') + ', NULL)';
});

sql += rows.join(',\n') + ';\n\ncommit;\n';
fs.writeFileSync(process.argv[2], sql);
console.log('wrote ' + E.length + ' rows to ' + process.argv[2]);
const sorted = E.map(e => e.s).sort();
console.log('date span: ' + sorted[0] + ' .. ' + sorted[sorted.length - 1]);
console.log('circle_id NULL in all rows: ' + (sql.match(/, NULL, '/g) || []).length);
