/**
 * Great-circle distance between two coordinates, in kilometres. Standard
 * haversine — close enough at city scale (the curvature error over <100 km
 * is well under 0.5%). We use this client-side rather than wiring up PostGIS
 * because (a) the seeded data set is ~40 rows, so any radius filter is
 * cheap, and (b) PostGIS hasn't been enabled on the project yet. Replace
 * with `ST_DWithin` later when the row count justifies it (tracked as
 * Activities v2 #11).
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // Earth radius, km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Radius for the "Near me" feed filter — Berlin scale. */
export const NEAR_ME_RADIUS_KM = 5;
