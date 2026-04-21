const ANIME_TYPES = ["hoathinh"];

export function isAnime(item) {
  if (!item) return false;
  return item.type === "hoathinh";
}

export function isJapaneseAnime(item) {
  if (!isAnime(item)) return false;
  return item.country?.some((c) => c.slug === "nhat-ban") ?? false;
}

export function filterAnimeOnly(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(isAnime);
}

export function filterJapaneseAnime(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(isJapaneseAnime);
}
