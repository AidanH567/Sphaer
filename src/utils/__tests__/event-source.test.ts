import {
  isAggregated,
  isCommunityPosted,
  matchesOrigin,
  sourceCreditLabel,
  sourceHost,
} from '../event-source';

// The discriminator, restated so a regression here fails loudly:
//   source IS NULL       → a person posted it
//   source LIKE 'tina:%' → Tina's aggregator imported it
// Production on 2026-08-18: 56 human, 94 tina:jsonld, 2 tina:ics.

describe('isAggregated / isCommunityPosted', () => {
  it('null source is a person', () => {
    expect(isAggregated({ source: null })).toBe(false);
    expect(isCommunityPosted({ source: null })).toBe(true);
  });

  it('an absent source column is a person (pre-migration + mock events)', () => {
    expect(isAggregated({})).toBe(false);
    expect(isCommunityPosted({})).toBe(true);
  });

  it('both live tina: prefixes are aggregated', () => {
    expect(isAggregated({ source: 'tina:jsonld' })).toBe(true);
    expect(isAggregated({ source: 'tina:ics' })).toBe(true);
    expect(isCommunityPosted({ source: 'tina:jsonld' })).toBe(false);
  });

  it('is not hard-coded to the tina: prefix — any non-empty source is machine-imported', () => {
    // The migration's rule is "NULL vs not NULL", not "starts with tina:".
    // A future importer under a different prefix must not be misfiled as a
    // human post the moment it lands.
    expect(isAggregated({ source: 'partner:resident-advisor' })).toBe(true);
  });

  it('an empty or whitespace source counts as a person, not a bad import', () => {
    // A blank string is not a feed name. Calling it aggregated would stamp a
    // "via ..." credit onto somebody's own event.
    expect(isAggregated({ source: '' })).toBe(false);
    expect(isAggregated({ source: '   ' })).toBe(false);
  });

  it('the two are exact complements', () => {
    for (const source of [null, undefined, '', 'tina:ics', 'x']) {
      expect(isAggregated({ source })).toBe(!isCommunityPosted({ source }));
    }
  });
});

describe('matchesOrigin', () => {
  const human = { source: null };
  const imported = { source: 'tina:jsonld' };

  it('undefined origin is "All" — everything passes', () => {
    expect(matchesOrigin(human, undefined)).toBe(true);
    expect(matchesOrigin(imported, undefined)).toBe(true);
  });

  it('community keeps only human-posted', () => {
    expect(matchesOrigin(human, 'community')).toBe(true);
    expect(matchesOrigin(imported, 'community')).toBe(false);
  });

  it('aggregated keeps only imported', () => {
    expect(matchesOrigin(human, 'aggregated')).toBe(false);
    expect(matchesOrigin(imported, 'aggregated')).toBe(true);
  });

  it('the two states partition the set — no event is in both or neither', () => {
    const all = [human, imported, { source: '' }, {}, { source: 'tina:ics' }];
    const community = all.filter((e) => matchesOrigin(e, 'community'));
    const aggregated = all.filter((e) => matchesOrigin(e, 'aggregated'));
    expect(community.length + aggregated.length).toBe(all.length);
    expect(community.some((e) => aggregated.includes(e))).toBe(false);
  });
});

describe('sourceHost', () => {
  it('strips scheme, www, path and query', () => {
    expect(sourceHost('https://www.privatclub-berlin.de/events/123?utm=x')).toBe(
      'privatclub-berlin.de',
    );
  });

  it('handles http, a bare host, a port, and a fragment', () => {
    expect(sourceHost('http://sameheads.de/programm')).toBe('sameheads.de');
    expect(sourceHost('trauma-bar.com')).toBe('trauma-bar.com');
    expect(sourceHost('https://example.org:8443/x')).toBe('example.org');
    expect(sourceHost('https://example.org#now')).toBe('example.org');
  });

  it('lowercases the host', () => {
    expect(sourceHost('HTTPS://WWW.Berghain.Berlin/Events')).toBe('berghain.berlin');
  });

  it('returns null rather than a broken credit for junk input', () => {
    expect(sourceHost(null)).toBeNull();
    expect(sourceHost(undefined)).toBeNull();
    expect(sourceHost('')).toBeNull();
    expect(sourceHost('   ')).toBeNull();
    // No dot — not a host we should print.
    expect(sourceHost('localhost/events')).toBeNull();
    expect(sourceHost('just some text')).toBeNull();
  });

  it('produces a readable credit for every host actually in production', () => {
    // The four venues behind all 96 aggregated rows on 2026-08-18
    // (privatclub-berlin.de 51, ilkino.de 43, yaam.de 1, arena.berlin 1).
    // Checked against the live shape of `source_url` rather than invented
    // URLs, so a parser that only works on tidy examples fails here.
    expect(sourceHost('https://www.privatclub-berlin.de/veranstaltung/xyz/')).toBe(
      'privatclub-berlin.de',
    );
    expect(sourceHost('https://www.ilkino.de/film/1234')).toBe('ilkino.de');
    expect(sourceHost('https://yaam.de/events/')).toBe('yaam.de');
    // A dotted TLD-style host with no .de/.com — must not be mistaken for a
    // path segment.
    expect(sourceHost('https://arena.berlin/event/abc')).toBe('arena.berlin');
  });

  it('never throws on malformed input (it runs inside a FlatList row)', () => {
    for (const junk of ['://', 'https://', '%%%', 'ht tp://a.de']) {
      expect(() => sourceHost(junk)).not.toThrow();
    }
  });
});

describe('sourceCreditLabel', () => {
  it('credits the host an aggregated listing was read from', () => {
    expect(
      sourceCreditLabel({
        source: 'tina:jsonld',
        source_url: 'https://www.privatclub-berlin.de/e/1',
        location_name: 'Privatclub',
      }),
    ).toBe('via privatclub-berlin.de');
  });

  it('falls back to the venue when the row has no usable source_url', () => {
    expect(
      sourceCreditLabel({ source: 'tina:ics', source_url: null, location_name: 'Sameheads' }),
    ).toBe('via Sameheads');
  });

  it('is null for human-posted events — nothing to credit', () => {
    expect(
      sourceCreditLabel({
        source: null,
        source_url: 'https://example.com/x',
        location_name: 'Görlitzer Park',
      }),
    ).toBeNull();
  });

  it('is null when there is nothing to name — better no line than "via"', () => {
    expect(sourceCreditLabel({ source: 'tina:ics', source_url: null, location_name: null })).toBeNull();
    expect(sourceCreditLabel({ source: 'tina:ics', source_url: 'nonsense', location_name: '  ' })).toBeNull();
  });
});
