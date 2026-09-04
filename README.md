# play at [https://katie-sp.github.io/progless/](https://katie-sp.github.io/progless/)
A Songless-style game for prog with Easy (top 10 albums), Medium (top 25), and Hard (top 50) modes. Each round gives you escalating clips of 0.1, 0.5, 2, 4, 8, and 15 seconds.

The included catalog is scoped to the current [ProgArchives top 50 studio albums](https://www.progarchives.com/top-prog-albums.asp?salbumtypes=1&smaxresults=50). ProgArchives supplies the album ranking; Apple supplies the playable preview clips and cover art.

## Notes

- Preview availability can change by country or over time. If a clip fails, use **New song**.
- ProgArchives sometimes blocks automated requests, which is why `data/prog-albums.json` is committed as a reliable fallback.

## Refresh the top-50 catalog - for katie if debugging needed idk

Run both catalog stages with:

```bash
npm run catalog:refresh
```

The first stage tries to refresh `data/prog-albums.json` from ProgArchives. If ProgArchives rejects automated access, the script safely keeps the checked-in top-50 fallback. The second stage finds each album through Apple's Search API, downloads only that album's track metadata, and rewrites `public/catalog.json`.

You can also run the stages independently:

```bash
npm run albums   # refresh data/prog-albums.json
npm run catalog  # regenerate public/catalog.json from that album list
```

Commit the regenerated files and GitHub Pages will redeploy them.
