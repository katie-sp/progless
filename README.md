# Prog Snippet

A tiny, replayable Songless-style game for progressive rock. Each round picks a random track and gives you escalating clips of **0.1, 1, 3, 5, 10, and 15 seconds**.

The included catalog is scoped to the current [ProgArchives top 50 studio albums](https://www.progarchives.com/top-prog-albums.asp?salbumtypes=1&smaxresults=50). ProgArchives supplies the album ranking; Apple supplies the playable preview clips and cover art. This project is fan-made and unaffiliated with either service.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

## Put it on GitHub Pages (free)

1. Create an empty GitHub repository.
2. Push this folder to its `main` branch.
3. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. The included workflow builds and publishes the game automatically. GitHub shows the public URL after the action finishes.

No server, API key, or paid account is required.

## Refresh the top-50 catalog

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

## Notes

- Preview availability can change by country or over time. If a clip fails, use **New song**.
- ProgArchives sometimes blocks automated requests, which is why `data/prog-albums.json` is committed as a reliable fallback.
- The production build uses relative asset paths, so it works at `username.github.io/repository-name/` as well as a custom domain.
