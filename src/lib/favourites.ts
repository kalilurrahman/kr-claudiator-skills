const STORAGE_KEY = "claudiator_favourites";

export function getFavourites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function isFavourite(skillId: string): boolean {
  return getFavourites().includes(skillId);
}

export function toggleFavourite(skillId: string): boolean {
  const favs = getFavourites();
  const idx = favs.indexOf(skillId);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(skillId);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  window.dispatchEvent(new Event("favourites-updated"));
  return idx < 0; // returns true if added
}
