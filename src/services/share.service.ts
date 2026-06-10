import { Platform, Share } from 'react-native';
import type { EventWithRelations } from '@/types/event.types';
import type { CircleWithCounts } from '@/types/circle.types';

/**
 * Centralised share entry-points.
 *
 * Today: every share() call opens the native iOS / Android share sheet (or
 * the web share sheet on browsers that implement navigator.share). The
 * shared payload includes a canonical https://sphaer.app/... URL — the
 * web-preview page at that URL doesn't exist yet, but baking the URL in
 * now means every share emitted from the app is forward-compatible the
 * moment the web preview + Universal Links / App Links land.
 *
 * Deferred (separate BACKLOG items — require external config):
 *   - The /event/<id>, /circles/<id>, /user/<id> web preview pages
 *     themselves (need DNS / hosting / OG-tag image generation).
 *   - Apple App Site Association + Android assetlinks.json (need Apple
 *     dev account credentials + Google Play app signing key).
 *
 * Once those land, no app-side change is needed — the URLs in the share
 * payload already point at the right place.
 */

const SHARE_BASE_URL = 'https://sphaer.app';

/** Build the canonical URL for an event detail page. */
export function eventShareUrl(eventId: string): string {
  return `${SHARE_BASE_URL}/event/${eventId}`;
}

/** Build the canonical URL for a circle detail page. */
export function circleShareUrl(circleId: string): string {
  return `${SHARE_BASE_URL}/circles/${circleId}`;
}

/** Build the canonical URL for a public profile page. */
export function profileShareUrl(userId: string): string {
  return `${SHARE_BASE_URL}/user/${userId}`;
}

/**
 * Share an event via the OS share sheet. Returns the action result so the
 * caller can opt to analytics-track shared / dismissed if it wants.
 *
 * Why we build two slightly different payloads:
 *   - iOS Share API uses `message` + `url` separately. Apps that receive
 *     the share (Messages, Mail) format the URL nicely as a preview card.
 *   - Android Share API only uses `message`; `url` is silently ignored.
 *     So we append the URL to the message on Android so it actually goes
 *     out with the share.
 */
export async function shareEvent(event: Pick<
  EventWithRelations,
  'id' | 'title' | 'location_name' | 'starts_at'
>): Promise<void> {
  const url = eventShareUrl(event.id);
  const where = event.location_name ? ` at ${event.location_name}` : '';
  const message = `${event.title}${where} — on Sphaer`;
  await Share.share(buildPayload({ message, url }), {
    dialogTitle: 'Share event',
    subject: event.title,
  });
}

/** Share a circle profile via the OS share sheet. */
export async function shareCircle(
  circle: Pick<CircleWithCounts, 'id' | 'name'>,
): Promise<void> {
  const url = circleShareUrl(circle.id);
  const message = `${circle.name} on Sphaer`;
  await Share.share(buildPayload({ message, url }), {
    dialogTitle: 'Share circle',
    subject: circle.name,
  });
}

/** Share a public profile via the OS share sheet. */
export async function shareProfile(profile: {
  id: string;
  display_name?: string | null;
  displayName?: string | null;
}): Promise<void> {
  const name = profile.display_name ?? profile.displayName ?? 'an artist';
  const url = profileShareUrl(profile.id);
  const message = `${name} on Sphaer`;
  await Share.share(buildPayload({ message, url }), {
    dialogTitle: 'Share profile',
    subject: name,
  });
}

/**
 * Cross-platform share payload. iOS keeps `url` separate so receiver apps
 * can render the link preview; Android folds it into `message` because
 * `url` is silently dropped there.
 */
function buildPayload({
  message,
  url,
}: {
  message: string;
  url: string;
}): { message: string; url?: string } {
  if (Platform.OS === 'ios') {
    return { message, url };
  }
  return { message: `${message}\n${url}` };
}
