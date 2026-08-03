# 🍱 MBG Monitor

> **"Makan bergizi, gratis, dan… beracun?"**
> Monitor independen yang melacak insiden keracunan massal dari program andalan pemerintah.

**Peta langsung: [https://mbg-monitor.pages.dev](https://mbg-monitor.pages.dev)**

**🌏 Baca versi bahasa [English](README.md)**

---

## Apa ini?

Proyek ini mengumpulkan dan memetakan **insiden keracunan makanan** yang terkait dengan program **Makan Bergizi Gratis (MBG)** — program nasional yang digadang-gadang sebagai solusi gizi anak Indonesia. Data dikumpulkan dari **media massa Indonesia** dan **Wikipedia**, lalu ditampilkan di peta interaktif.

Kami tidak menilai programnya. Data yang berbicara.

## Fakta (per pembaruan terakhir)

| Metrik | Angka |
|---|---|
| Total insiden | **377** |
| Total korban | **48.399** orang |
| Korban meninggal | **2** jiwa |
| Provinsi terdampak | Hampir seluruh Indonesia |

*"Korban vs populasi: 0,0168% — masih aman."* — pemerintah, mungkin.

## Apakah MBG berhasil?

Program ini dirancang untuk memberi makan **+82 juta penerima** di seluruh Indonesia. Dan memang berhasil — berhasil membuat **ratusan sekolah** masuk daftar insiden keracunan.

Beberapa pencapaian yang patut dibanggakan:

- 🥇 **48.399 korban** dalam kurun waktu singkat — rekor program sosial yang sulit ditandingi
- 🏫 **130+ sekolah** terdampak, dari SD hingga pesantren — pemerataan yang mengagumkan
- 🍗 Menu makan siang yang **tak terlupakan** — dalam arti yang paling literal
- 📰 **Media berlimpah** — setiap insiden mendapat liputan hangat, gratis untuk semua

Data ini bukan opini. Ini hasil kerja keras para wartawan, relawan, dan Wikipediawan yang mencatat setiap kejadian.

## Cara kerja

```
Wikipedia + media → scraper (Python) → data/wiki_incidents.json → D1 database (Cloudflare)
                                                        ↓
Peta interaktif (React + Leaflet) ← Cloudflare Pages ← frontend
```

1. **Scraper** (`scripts/scrape_wiki.py`) menarik data insiden dari halaman Wikipedia
2. **Deduplikasi** — insiden multi-sekolah digabung, korban dihitung sekali (48k, bukan 117k)
3. **Frontend** (React + Vite + Leaflet) menampilkan peta, statistik, dan feed insiden
4. **Deploy** ke Cloudflare Pages + D1 untuk data produksi

## Tech stack

- **Frontend**: React 19, Vite, Leaflet, Tailwind CSS, daisyUI
- **Icons**: lucide-react
- **Backend**: Cloudflare Pages Functions + D1 + Workers
- **Data**: scraper Python → JSON → SQLite/D1
- **Hosting**: Cloudflare Pages
- **CI/CD**: GitLab CI (lihat `.gitlab-ci.yml`)

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:5173` — data lokal disajikan dari `data/wiki_incidents.json` (tanpa D1).

## Deploy

```bash
npm run deploy
```

Membutuhkan kredensial Cloudflare (`wrangler login` / `CLOUDFLARE_API_TOKEN`). Build → upload ke Pages → deploy Functions.

## Kontribusi

Lihat [CONTRIBUTING.md](CONTRIBUTING.md) — setup, konvensi, dan cara membuka merge request.

## Lisensi

[MIT](LICENSE) © 2026 Sukma Diki

## Disclaimer

- Data dikumpulkan secara otomatis dari **media publik** dan **Wikipedia**
- Bisa ada kesalahan, duplikasi, atau kelalaian — verifikasi sebelum dikutip
- Ini **bukan** saran medis, bukan laporan resmi, dan bukan kampanye politik
- Jika ada insiden yang salah atau perlu dikoreksi, silakan buka issue.
