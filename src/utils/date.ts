export function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
  });
}

export function formatEventTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }) + 'hs';
}

export function formatEventDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "21:00-23:30" — start/end time range in 24h format. */
export function formatEventTimeRange(startStr: string, endStr?: string | null): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (!endStr) return fmt(startStr);
  return `${fmt(startStr)}-${fmt(endStr)}`;
}

/** "Fri 27.May" — compact weekday + day.month used on the booking bar. */
export function formatEventDateCompact(dateStr: string): string {
  const date = new Date(dateStr);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = date.toLocaleDateString('en-GB', { day: 'numeric' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  return `${weekday} ${day}.${month}`;
}

export function formatMessageTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function isUpcoming(dateStr: string): boolean {
  return new Date(dateStr) > new Date();
}

export function formatSeenTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Seen';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Seen just now';
  if (minutes < 60) return `Seen ${minutes}m ago`;
  if (hours < 24) return `Seen ${hours}h ago`;
  if (days < 7) return `Seen ${days}d ago`;
  return `Seen ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}
