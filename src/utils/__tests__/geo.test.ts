import { haversineKm, NEAR_ME_RADIUS_KM } from '../geo';

// Reference coordinates checked against external haversine calculators.
const ALEXANDERPLATZ = { lat: 52.5219, lng: 13.4132 };
const BRANDENBURG_GATE = { lat: 52.5163, lng: 13.3777 };
const MUNICH = { lat: 48.1351, lng: 11.582 };

describe('haversineKm', () => {
  it('zero distance for identical points', () => {
    expect(haversineKm(ALEXANDERPLATZ, ALEXANDERPLATZ)).toBe(0);
  });

  it('Alexanderplatz → Brandenburg Gate ≈ 2.5 km', () => {
    const d = haversineKm(ALEXANDERPLATZ, BRANDENBURG_GATE);
    expect(d).toBeGreaterThan(2.2);
    expect(d).toBeLessThan(2.8);
  });

  it('Berlin → Munich ≈ 500 km', () => {
    const d = haversineKm(ALEXANDERPLATZ, MUNICH);
    expect(d).toBeGreaterThan(480);
    expect(d).toBeLessThan(520);
  });

  it('is symmetric', () => {
    expect(haversineKm(ALEXANDERPLATZ, MUNICH)).toBeCloseTo(
      haversineKm(MUNICH, ALEXANDERPLATZ),
      10,
    );
  });

  it('cross-Berlin landmarks fall inside the Near-me radius', () => {
    expect(haversineKm(ALEXANDERPLATZ, BRANDENBURG_GATE)).toBeLessThan(NEAR_ME_RADIUS_KM);
  });
});
