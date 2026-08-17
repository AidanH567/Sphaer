import type { CircleWithCounts } from '@/types/circle.types';

/**
 * The Circles screen's search + category predicate, in one place.
 *
 * Pulled out of the screen when the "My circles" section landed (Lara #8):
 * two lists on the same page must narrow by the same rule, or typing into
 * the search box would filter the discovery rows while leaving "My circles"
 * showing everything — which reads as a bug.
 *
 *   - searchText: case-insensitive substring over name, description, tags
 *   - categories: keep a circle whose `tags[]` includes at least one selected
 *                 category (intersection, not superset)
 */
export function filterCircles(
  circles: CircleWithCounts[],
  searchText: string,
  selectedCategories: string[],
): CircleWithCounts[] {
  const q = searchText.trim().toLowerCase();

  const textFiltered = q
    ? circles.filter((c) => {
        const haystack = [c.name, c.description ?? '', (c.tags ?? []).join(' ')]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
    : circles;

  if (selectedCategories.length === 0) return textFiltered;

  return textFiltered.filter((c) =>
    (c.tags ?? []).some((t) => selectedCategories.includes(t)),
  );
}
