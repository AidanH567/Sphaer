import { Linking, Platform } from 'react-native';
import { buildEventIcs, buildEventsIcs } from '@/utils/ics';
import type { EventWithRelations } from '@/types/event.types';

/**
 * Hand the event off to the system calendar.
 *
 * Web:
 *   Create a Blob URL of the .ics file and trigger an <a download> click.
 *   Most browsers will auto-open it in the user's default calendar app
 *   (Google Calendar via the web GMail integration on Chrome, Outlook
 *   on Edge, etc.) or save it to disk so the user can double-click it.
 *
 * iOS / Android:
 *   Build a `data:text/calendar;base64,...` URI. iOS Safari/Linking opens
 *   the system Calendar app's "Add Event" sheet. Android opens the
 *   calendar picker. No new permissions needed because we're not
 *   touching the device calendar directly — we're handing the OS an
 *   .ics URI and letting it route to whatever app the user picked.
 */
export async function addEventToCalendar(
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
): Promise<void> {
  const ics = buildEventIcs(event);
  const filename = `sphaer-event-${event.id}.ics`;

  if (Platform.OS === 'web') {
    downloadIcsOnWeb(ics, filename);
    return;
  }

  // Native: base64-encode the ICS content and hand it off via data: URI.
  // expo-router / supabase-js already polyfill `btoa` on RN runtimes.
  const base64 = encodeBase64(ics);
  const uri = `data:text/calendar;base64,${base64}`;
  const supported = await Linking.canOpenURL(uri).catch(() => false);
  if (!supported) {
    throw new Error('Calendar handoff not supported on this device.');
  }
  await Linking.openURL(uri);
}

/**
 * Bulk: export every event passed in as a single .ics file with multiple
 * VEVENTs. Same handoff machinery as `addEventToCalendar` — one prompt
 * for the user, not N.
 */
export async function addEventsToCalendar(
  events: Pick<
    EventWithRelations,
    | 'id'
    | 'title'
    | 'description'
    | 'starts_at'
    | 'ends_at'
    | 'location_name'
    | 'address'
  >[],
): Promise<void> {
  const ics = buildEventsIcs(events);
  const filename = `sphaer-saved-${Date.now()}.ics`;
  if (Platform.OS === 'web') {
    downloadIcsOnWeb(ics, filename);
    return;
  }
  const base64 = encodeBase64(ics);
  const uri = `data:text/calendar;base64,${base64}`;
  const supported = await Linking.canOpenURL(uri).catch(() => false);
  if (!supported) {
    throw new Error('Calendar handoff not supported on this device.');
  }
  await Linking.openURL(uri);
}

function downloadIcsOnWeb(ics: string, filename: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Anchor must be in the DOM for some browsers (Firefox) to honour the
  // click. Append, click, remove, then release the Blob URL.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function encodeBase64(s: string): string {
  // `btoa` operates on byte strings, not Unicode. Encode to UTF-8 bytes
  // first so emoji / non-ASCII characters in the description survive.
  if (typeof btoa === 'function') {
    const utf8 = unescape(encodeURIComponent(s));
    return btoa(utf8);
  }
  // RN's polyfill via global Buffer — covered by supabase-js's deps.
  const buf = (globalThis as any).Buffer;
  if (buf?.from) {
    return buf.from(s, 'utf8').toString('base64');
  }
  throw new Error('No base64 encoder available.');
}
