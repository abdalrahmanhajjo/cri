/**
 * Multiple callers fetch GET /api/user/favourites (initial load, post-save sync, etc.).
 * An older in-flight response can finish last and overwrite fresh state — only the latest
 * read may apply to React state.
 */
let generation = 0;

export function beginFavouritesRead() {
  generation += 1;
  return generation;
}

export function shouldApplyFavouritesRead(requestGen) {
  return requestGen === generation;
}
