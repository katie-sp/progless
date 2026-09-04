import { readFile, writeFile } from "node:fs/promises";

const artists = JSON.parse(await readFile(new URL("../data/prog-artists.json", import.meta.url), "utf8"));
const output = new URL("../public/catalog.json", import.meta.url);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const songs = new Map();

for (const [index, artist] of artists.entries()) {
  const params = new URLSearchParams({ term: artist, entity: "song", attribute: "artistTerm", limit: "200", media: "music" });
  const response = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!response.ok) throw new Error(`Apple search failed for ${artist}: ${response.status}`);
  const data = await response.json();
  for (const item of data.results ?? []) {
    if (!item.previewUrl || !item.trackName || !item.artistName || !item.trackId) continue;
    if (item.artistName.toLocaleLowerCase() !== artist.toLocaleLowerCase()) continue;
    songs.set(item.trackId, {
      id: item.trackId,
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName ?? "Unknown album",
      preview: item.previewUrl.replace(/^http:/, "https:"),
      artwork: (item.artworkUrl100 ?? "").replace("100x100bb", "300x300bb").replace(/^http:/, "https:"),
      progarchives: `https://www.google.com/search?q=${encodeURIComponent(`site:progarchives.com ${item.artistName} ${item.trackName}`)}`,
    });
  }
  process.stdout.write(`\r${index + 1}/${artists.length} artists · ${songs.size} tracks`);
  await pause(70);
}

const catalog = [...songs.values()].sort((a,b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
await writeFile(output, `${JSON.stringify(catalog)}\n`);
console.log(`\nWrote ${catalog.length} playable tracks to public/catalog.json`);
