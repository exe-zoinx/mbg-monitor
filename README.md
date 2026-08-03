# 🍱 MBG Monitor

> **"Free nutritious meals… and free food poisoning."**
> An independent monitor tracking mass food-poisoning incidents from Indonesia's flagship free-meals program.

**Live map: [https://mbg-monitor.pages.dev](https://mbg-monitor.pages.dev)**

**🌏 Read this in [Bahasa Indonesia](README.id.md)**

---

## What is this?

This project collects and maps **food-poisoning incidents** linked to the **Makan Bergizi Gratis (MBG)** program — the national initiative touted as Indonesia's answer to child malnutrition. Data is gathered from **Indonesian media outlets** and **Wikipedia**, then visualized on an interactive map.

We don't judge the program. The data does.

## Facts (as of the latest update)

| Metric | Value |
|---|---|
| Total incidents | **377** |
| Total victims | **48,399** people |
| Deaths | **2** |
| Affected provinces | Nearly all of Indonesia |

## Does MBG work?

The program is designed to feed **+82 million recipients** nationwide. And it does — it's doing a great job putting **hundreds of schools** on the food-poisoning incident map.

Achievements worth celebrating:

- 🥇 **48,399 victims** in record time — a social-program record hard to beat
- 🏫 **130+ schools** affected, from elementary schools to Islamic boarding schools — impressive equity
- 🍗 A lunch menu that's **unforgettable** — in the most literal sense
- 📰 **Plentiful media coverage** — every incident gets warm coverage, free of charge

This is not opinion. It's the work of journalists, volunteers, and Wikipedians recording every single event.

## How it works

```
Wikipedia + media → scraper (Python) → data/wiki_incidents.json → D1 database (Cloudflare)
                                                        ↓
Interactive map (React + Leaflet) ← Cloudflare Pages ← frontend
```

1. **Scraper** (`scripts/scrape_wiki.py`) pulls incident data from Wikipedia's MBG poisoning table
2. **Deduplication** — multi-school incidents merge, victims counted once (48k, not 117k)
3. **Frontend** (React + Vite + Leaflet) renders the map, stats, and incident feed
4. **Deploy** to Cloudflare Pages + D1 for production data

## Tech stack

- **Frontend**: React 19, Vite, Leaflet, Tailwind CSS, daisyUI
- **Icons**: lucide-react
- **Backend**: Cloudflare Pages Functions + D1 + Workers
- **Data**: Python scraper → JSON → SQLite/D1
- **Hosting**: Cloudflare Pages
- **CI/CD**: GitLab CI (see `.gitlab-ci.yml`)

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — local data is served from `data/wiki_incidents.json` (no D1 needed).

## Deploy

```bash
npm run deploy
```

Requires Cloudflare credentials (`wrangler login` or `CLOUDFLARE_API_TOKEN`). Build → upload to Pages → deploy Functions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — setup, conventions, and how to open a merge request.

## License

[MIT](LICENSE) © 2026 Sukma Diki

## Disclaimer

- Data is collected automatically from **public media** and **Wikipedia**
- Errors, duplicates, or omissions are possible — verify before citing
- This is **not** medical advice, an official report, or a political campaign
- Spotted a wrong incident or missing correction? Open an issue.
