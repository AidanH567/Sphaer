-- Add Bezirk (borough) classification alongside the existing Ortsteil
-- (neighbourhood) column. Some Google geocoder results only resolve to
-- the Bezirk level; we want to preserve that signal honestly instead of
-- forcing it down to an arbitrary Ortsteil.
ALTER TABLE events ADD COLUMN borough TEXT;

-- Index for borough-level filtering. Partial index since most events
-- will have a borough but null is allowed.
CREATE INDEX events_borough_idx
  ON events(borough)
  WHERE borough IS NOT NULL;

-- Backfill borough from the existing neighbourhood column via a static
-- Ortsteil → Bezirk lookup. Keeps existing events filterable by both
-- levels without re-geocoding.
UPDATE events SET borough = CASE neighbourhood
  WHEN 'Mitte'             THEN 'Mitte'
  WHEN 'Tiergarten'        THEN 'Mitte'
  WHEN 'Hansaviertel'      THEN 'Mitte'
  WHEN 'Wedding'           THEN 'Mitte'
  WHEN 'Moabit'            THEN 'Mitte'
  WHEN 'Gesundbrunnen'     THEN 'Mitte'
  WHEN 'Kreuzberg'         THEN 'Friedrichshain-Kreuzberg'
  WHEN 'Friedrichshain'    THEN 'Friedrichshain-Kreuzberg'
  WHEN 'Neukölln'          THEN 'Neukölln'
  WHEN 'Prenzlauer Berg'   THEN 'Pankow'
  WHEN 'Pankow'            THEN 'Pankow'
  WHEN 'Weißensee'         THEN 'Pankow'
  WHEN 'Charlottenburg'    THEN 'Charlottenburg-Wilmersdorf'
  WHEN 'Wilmersdorf'       THEN 'Charlottenburg-Wilmersdorf'
  WHEN 'Schöneberg'        THEN 'Tempelhof-Schöneberg'
  WHEN 'Tempelhof'         THEN 'Tempelhof-Schöneberg'
  WHEN 'Lichtenberg'       THEN 'Lichtenberg'
  WHEN 'Rummelsburg'       THEN 'Lichtenberg'
  WHEN 'Treptow'           THEN 'Treptow-Köpenick'
  WHEN 'Köpenick'          THEN 'Treptow-Köpenick'
  WHEN 'Steglitz'          THEN 'Steglitz-Zehlendorf'
  WHEN 'Zehlendorf'        THEN 'Steglitz-Zehlendorf'
  WHEN 'Reinickendorf'     THEN 'Reinickendorf'
  WHEN 'Spandau'           THEN 'Spandau'
  WHEN 'Marzahn'           THEN 'Marzahn-Hellersdorf'
  WHEN 'Hellersdorf'       THEN 'Marzahn-Hellersdorf'
  ELSE NULL
END
WHERE neighbourhood IS NOT NULL;
