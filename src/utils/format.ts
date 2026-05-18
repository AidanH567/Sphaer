export function formatPrice(price: number | null, isFree: boolean): string {
  if (isFree || price === 0) return 'FREE';
  if (price === null) return '';
  const rounded = Number.isInteger(price) ? price : price.toFixed(2);
  return `${rounded}€`;
}

export function formatPriceRange(min: number, max: number): string {
  if (min === max) return `${min}€`;
  return `${min}€ - ${max}€`;
}

export function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace('.0', '')}k`;
  }
  return count.toString();
}

export function formatMemberCount(count: number): string {
  return `${count.toLocaleString('de-DE')} members`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
