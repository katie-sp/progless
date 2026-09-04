import { readFile, writeFile } from "node:fs/promises";

const TOP_URL = "https://www.progarchives.com/top-prog-albums.asp?salbumtypes=1&smaxresults=50";
const output = new URL("../data/prog-albums.json", import.meta.url);
const existing = JSON.parse(await readFile(output, "utf8"));

const decode = (text) => text
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
  .replace(/\s+/g, " ").trim();

function extractAlbums(html) {
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']*album\.asp\?id=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const albums = [];
  const seen = new Set();

  for (const match of anchors) {
    const id = match[2];
    const album = decode(match[3]);
    if (!album || seen.has(id)) continue;

    const afterAlbum = html.slice(match.index + match[0].length, match.index + match[0].length + 700);
    const artistMatch = afterAlbum.match(/<a\b[^>]*href=["'][^"']*artist\.asp\?id=\d+[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    const artist = decode(artistMatch?.[1] ?? "");
    if (!artist) continue;

    seen.add(id);
    albums.push({
      rank: albums.length + 1,
      artist,
      album,
      progarchives: new URL(match[1].replace(/^\//, ""), "https://www.progarchives.com/").href,
    });
    if (albums.length === 50) break;
  }
  return albums;
}

try {
  const response = await fetch(TOP_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ProgSnippetCatalog/1.0; one-time personal catalog refresh)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const albums = extractAlbums(await response.text());
  if (albums.length !== 50) throw new Error(`found ${albums.length} album records instead of 50`);
  await writeFile(output, `${JSON.stringify(albums, null, 2)}\n`);
  console.log(`Updated data/prog-albums.json with ${albums.length} albums from ProgArchives.`);
} catch (error) {
  console.warn(`ProgArchives refresh unavailable (${error.message}). Keeping the checked-in ${existing.length}-album fallback.`);
}
