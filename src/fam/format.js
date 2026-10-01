export function directionsUrl(place) {
  const query = encodeURIComponent(`${place.name}, ${place.address}`);
  const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
  return place.placeId ? `${url}&query_place_id=${encodeURIComponent(place.placeId)}` : url;
}

export const hasCoords = (p) => typeof p.lat === 'number' && typeof p.lng === 'number';

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
export const byText = (a, b) => collator.compare(a, b);

// Short display lines break before the last word ("where we're / eating"),
// unless the data already has a line break in it.
export function displayLines(text) {
  if (text.includes('\n')) return text.split('\n');
  const words = text.trim().split(/\s+/);
  return words.length < 2 ? [text] : [words.slice(0, -1).join(' '), words[words.length - 1]];
}
