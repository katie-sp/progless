import { readFile, writeFile } from "node:fs/promises";

const albums = JSON.parse(await readFile(new URL("../data/prog-albums.json", import.meta.url), "utf8"));
const output = new URL("../public/catalog.json", import.meta.url);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value = "") => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\b(the|and|of|a|an|in)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (value) => new Set(normalize(value).split(" ").filter(Boolean));
const similarity = (left, right) => {
  const a = tokens(left); const b = tokens(right);
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((token) => b.has(token)).length;
  return overlap / Math.max(a.size, b.size);
};
const albumSimilarity = (wanted, candidate) => {
  const wantedTokens = tokens(wanted); const candidateTokens = tokens(candidate);
  if (wantedTokens.size && [...wantedTokens].every((token) => candidateTokens.has(token))) return 1;
  return similarity(wanted, candidate);
};
async function fetchJson(url, label) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`${label}: HTTP ${response.status}`);
    if (attempt === 3) throw new Error(`${label}: HTTP ${response.status} after retries`);
    const retryAfter = Number(response.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30_000 * (attempt + 1);
    console.log(`\nApple rate limit reached; retrying in ${Math.round(wait / 1000)} seconds…`);
    await pause(wait);
  }
}
const albumUrl = (entry) => entry.progarchives ?? `https://www.google.com/search?q=${encodeURIComponent(`site:progarchives.com ${entry.artist} ${entry.album}`)}`;
const songs = new Map();
const misses = [];

for (const [index, entry] of albums.entries()) {
  let best = entry.appleCollectionId ? { item: { collectionId: entry.appleCollectionId, artworkUrl100: "" }, score: 1 } : null;
  if (!best) {
    const params = new URLSearchParams({ term: `${entry.artist} ${entry.album}`, entity: "album", limit: "25", media: "music" });
    const search = await fetchJson(`https://itunes.apple.com/search?${params}`, `Apple album search failed for ${entry.artist} — ${entry.album}`);
    const candidates = (search.results ?? []).map((item) => {
    const candidateName = item.collectionName ?? "";
    const wantedTokens = tokens(entry.album);
    const editionWords = new Set(["ep", "single", "deluxe", "edition", "expanded", "remaster", "remastered", "mix", "stereo"]);
    const hasUnwantedTitleWords = [...tokens(candidateName)].some((token) => !wantedTokens.has(token) && !editionWords.has(token) && !/^\d+$/.test(token));
    const editionPenalty =
      (/\blive\b/i.test(candidateName) && !/\blive\b/i.test(entry.album) ? 0.3 : 0) +
      (/super deluxe/i.test(candidateName) ? 0.3 : 0) +
      (/\bdeluxe\b/i.test(candidateName) ? 0.12 : 0) +
      (/expanded|elemental mixes/i.test(candidateName) ? 0.1 : 0) +
      (/\b(ep|single)\b/i.test(candidateName) && hasUnwantedTitleWords ? 0.4 : 0);
    return {
      item,
      score: similarity(entry.artist, item.artistName) * 0.45 + albumSimilarity(entry.album, candidateName) * 0.55 - editionPenalty,
    };
    }).filter(({ item }) => item.collectionId).sort((a, b) => b.score - a.score);
    best = candidates[0];
  }

  if (!best || best.score < 0.58) {
    misses.push(`${entry.rank}. ${entry.artist} — ${entry.album}`);
    process.stdout.write(`\r${index + 1}/${albums.length} albums · ${songs.size} tracks · ${misses.length} misses`);
    await pause(150);
    continue;
  }

  const details = await fetchJson(`https://itunes.apple.com/lookup?id=${best.item.collectionId}&entity=song`, `Apple album lookup failed for ${entry.artist} — ${entry.album}`);
  for (const item of details.results ?? []) {
    if (item.wrapperType !== "track" || !item.previewUrl || !item.trackName || !item.trackId) continue;
    songs.set(item.trackId, {
      id: item.trackId,
      title: item.trackName,
      artist: item.artistName ?? entry.artist,
      album: item.collectionName ?? entry.album,
      rank: entry.rank,
      preview: item.previewUrl.replace(/^http:/, "https:"),
      artwork: (item.artworkUrl100 ?? best.item.artworkUrl100 ?? "").replace("100x100bb", "300x300bb").replace(/^http:/, "https:"),
      progarchives: albumUrl(entry),
    });
  }
  process.stdout.write(`\r${index + 1}/${albums.length} albums · ${songs.size} tracks · ${misses.length} misses`);
  await pause(150);
}

const catalog = [...songs.values()].sort((a, b) => a.rank - b.rank || a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
if (catalog.length < 100) throw new Error(`Only ${catalog.length} playable tracks were found; refusing to replace the existing catalog.`);
await writeFile(output, `${JSON.stringify(catalog)}\n`);
console.log(`\nWrote ${catalog.length} playable tracks from ${albums.length - misses.length}/${albums.length} top albums.`);
if (misses.length) console.warn(`No confident Apple album match for:\n- ${misses.join("\n- ")}`);
