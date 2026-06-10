/**
 * iCalendar (.ics) generation + cross-platform "add to calendar" handoff.
 *
 * Why roll our own instead of using expo-calendar:
 *   - expo-calendar pulls a native dep + permission flow on iOS/Android.
 *   - .ics is the cross-platform format every calendar app (iOS Calendar,
 *     Google Calendar, Outlook, Fantastical, etc.) understands.
 *   - Works on web (Blob download) AND native (data: URI handed to
 *     Linking.openURL opens the system Calendar's "add event" sheet on iOS
 *     and triggers the calendar picker on Android).
 *
 * Format spec: RFC 5545 — we emit a minimal but valid VCALENDAR/VEVENT.
 *
 * Lines MUST be CRLF-separated per the spec. Strings inside FIELD:VALUE
 * MUST escape `\`, `;`, `,`, and newline characters. Times are in UTC
 * (Z suffix) to keep the file timezone-independent.
 */

import type { EventWithRelations } from '@/types/event.types';

/** Build an .ics file body for a single event. */
export function buildEventIcs(
  event: Pick<
    EventWithRelations,
    | 'id'
    | 'title'
    | 'description'
    | 'starts_at'
    | 'ends_at'
    | 'location_name'
    | 'address'
  >,
): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Sphaer//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push('BEGIN:VEVENT');
  // UID must be globally unique. The event id + the app's domain is
  // stable and prevents duplicates when re-imported.
  lines.push(`UID:${event.id}@sphaer.app`);
  // DTSTAMP is when this .ics was generated. Using starts_at as a stable
  // proxy keeps the output deterministic (Date.now() would break the
  // resume-cache and add noise to diffs in tests).
  const stamp = toIcsTime(event.starts_at ?? new Date().toISOString());
  lines.push(`DTSTAMP:${stamp}`);
  if (event.starts_at) {
    lines.push(`DTSTART:${toIcsTime(event.starts_at)}`);
  }
  if (event.ends_at) {
    lines.push(`DTEND:${toIcsTime(event.ends_at)}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title ?? '')}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  const location = [event.location_name, event.address].filter(Boolean).join(', ');
  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }
  lines.push(`URL:https://sphaer.app/event/${event.id}`);
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');
  // RFC 5545 mandates CRLF, not LF.
  return lines.join('\r\n') + '\r\n';
}

/**
 * Convert an ISO timestamp into the iCalendar UTC format: `YYYYMMDDTHHMMSSZ`.
 * Returns the input untouched if it can't be parsed (best-effort).
 */
function toIcsTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mi = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

/**
 * Escape characters that are reserved in iCalendar TEXT-typed fields.
 * Order matters — `\` must be escaped FIRST so we don't double-escape
 * the backslashes we add for the other replacements.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
