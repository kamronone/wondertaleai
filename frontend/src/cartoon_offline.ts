import type {Lang} from "./i18n";

export const classicFilmIds = new Set(["three-pigs", "red-hood"]);
const filmCache = "wondertale-offline-films-v1";
const captions = ["ru", "uz", "en"] as const;

export function classicFilmUrl(storyId: string, language: Lang) {
  return `/cartoons/${storyId}/film-${language}.mp4`;
}

export function classicFilmPoster(storyId: string) {
  return `/images/classics/${storyId}/pages/page-1.png`;
}

export async function findOfflineFilmLanguage(storyId: string, unavailable: Lang) {
  const cache = await caches.open(filmCache);
  for (const language of captions) {
    if (language !== unavailable && await cache.match(classicFilmUrl(storyId, language))) {
      return language;
    }
  }
  return null;
}

export async function hasOfflineFilm(storyId: string, language: Lang) {
  const cache = await caches.open(filmCache);
  return Boolean(await cache.match(classicFilmUrl(storyId, language)));
}

export async function saveOfflineFilm(storyId: string, language: Lang) {
  if (!classicFilmIds.has(storyId)) throw new Error("Unknown film");
  const assets = [
    [classicFilmUrl(storyId, language), "video/mp4"],
    [classicFilmPoster(storyId), "image/png"],
    ...captions.map(lang => [`/cartoons/${storyId}/${lang}.vtt`, "text/vtt"])
  ];
  const downloads = await Promise.all(assets.map(async ([url, mime]) => {
    const response = await fetch(url);
    if (response.status !== 200 || !response.headers.get("content-type")?.toLowerCase().startsWith(mime)) {
      throw new Error("Film download failed");
    }
    return {url, response};
  }));
  const cache = await caches.open(filmCache);
  const [video, ...tracks] = downloads;
  await Promise.all(tracks.map(({url, response}) => cache.put(url, response)));
  await cache.put(video.url, video.response);
}

export async function removeOfflineFilm(storyId: string, language: Lang) {
  const cache = await caches.open(filmCache);
  await cache.delete(classicFilmUrl(storyId, language));
}
