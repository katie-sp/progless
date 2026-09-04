# Prog Snippet

A tiny, replayable Songless-style game for progressive rock. Each round picks a random track and gives you escalating clips of **0.1, 1, 3, 5, 10, and 15 seconds**.

The included catalog contains 11,000+ playable previews from 100+ artists catalogued by [ProgArchives](https://www.progarchives.com/). ProgArchives is used as the scope/reference; Apple supplies the legal preview clips and cover art. This project is fan-made and unaffiliated with either service.

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

## Refresh or expand the catalog

Edit `data/prog-artists.json`, keeping only artists represented on ProgArchives, then run:

```bash
npm run catalog
```

The generator asks Apple's Search API for currently playable previews and rewrites `public/catalog.json`. Commit the new file and GitHub Pages will redeploy it.

## Notes

- Preview availability can change by country or over time. If a clip fails, use **New song**.
- The catalog generator deliberately uses a curated ProgArchives artist list because ProgArchives blocks automated bulk scraping.
- The production build uses relative asset paths, so it works at `username.github.io/repository-name/` as well as a custom domain.
