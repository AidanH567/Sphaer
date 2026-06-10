import { buildEventIcs, buildEventsIcs } from '../ics';
import type { EventWithRelations } from '@/types/event.types';

const ev = (over: Partial<EventWithRelations>): Parameters<typeof buildEventIcs>[0] =>
  ({
    id: 'evt-1',
    title: 'Open Mic',
    description: null,
    starts_at: '2026-10-07T19:30:00Z',
    ends_at: '2026-10-08T00:30:00Z',
    location_name: 'Cafe Lichtblick',
    address: 'Prenzlauer Allee 1',
    ...over,
  } as Parameters<typeof buildEventIcs>[0]);

describe('buildEventIcs', () => {
  it('emits a structurally valid VCALENDAR with one VEVENT', () => {
    const ics = buildEventIcs(ev({}));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(1);
  });

  it('uses CRLF line endings throughout (RFC 5545)', () => {
    const ics = buildEventIcs(ev({}));
    // Every \n must be preceded by \r — no bare LFs.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('formats times as UTC YYYYMMDDTHHMMSSZ', () => {
    const ics = buildEventIcs(ev({}));
    expect(ics).toContain('DTSTART:20261007T193000Z');
    expect(ics).toContain('DTEND:20261008T003000Z');
  });

  it('escapes commas, semicolons, and newlines in TEXT fields', () => {
    const ics = buildEventIcs(
      ev({ title: 'a;b,c', description: 'line1\nline2' }),
    );
    expect(ics).toContain('SUMMARY:a\\;b\\,c');
    expect(ics).toContain('DESCRIPTION:line1\\nline2');
  });

  it('builds a stable UID from the event id', () => {
    expect(buildEventIcs(ev({ id: 'abc' }))).toContain('UID:abc@sphaer.app');
  });

  it('joins location_name + address into LOCATION', () => {
    expect(buildEventIcs(ev({}))).toContain(
      'LOCATION:Cafe Lichtblick\\, Prenzlauer Allee 1',
    );
  });
});

describe('buildEventsIcs', () => {
  it('wraps multiple VEVENTs in a single VCALENDAR', () => {
    const ics = buildEventsIcs([ev({ id: 'a' }), ev({ id: 'b' })]);
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:a@sphaer.app');
    expect(ics).toContain('UID:b@sphaer.app');
  });

  it('drops events without starts_at', () => {
    // The generated DB type marks starts_at non-null, but draft/legacy rows
    // can carry null at runtime — buildEventsIcs guards for it, so the test
    // forces the value through the type.
    const undated = ev({ id: 'undated' });
    (undated as { starts_at: string | null }).starts_at = null;
    const ics = buildEventsIcs([ev({ id: 'a' }), undated]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).not.toContain('undated');
  });

  it('an empty list yields an empty-but-valid calendar', () => {
    const ics = buildEventsIcs([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
