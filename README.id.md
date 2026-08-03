# 🍱 MBG Monitor

> Peta independen yang memantau peristiwa kesehatan yang dilaporkan terkait
> program Makan Bergizi Gratis (MBG) di Indonesia.

**Peta langsung: [https://mbg-monitor.pages.dev](https://mbg-monitor.pages.dev)**

**🌏 Baca versi bahasa [English](README.md)**

---

## Apa ini?

MBG Monitor adalah peta independen yang melacak insiden keracunan makanan dari
program **Makan Bergizi Gratis (MBG)** — inisiatif nasional pemenuhan gizi anak
Indonesia. Data dikumpulkan otomatis dari **media massa Indonesia** dan
**Wikipedia**, serta lokasi dapur SPPG dari peta sebaran SPPG Kementerian Pertanian.

**Tujuannya adalah transparansi.** Dengan data terbuka dan terlihat, publik,
pemerintah, dan pembuat kebijakan dapat mengevaluasi dan memperbaiki program
MBG demi masa depan yang lebih baik.

## Mengapa transparansi penting

Program seperti MBG menyentuh jutaan kehidupan. Ketika insiden terjadi,
insiden itu harus terlihat, terhitung, dan bisa dipelajari. Peta ini ada agar
setiap insiden terdokumentasi — bukan untuk mengkritik program, tetapi untuk
membantu program menjadi lebih baik.

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

> **Proyek ini adalah bagian dari upaya transparansi.** Data terbuka tentang
> program MBG membantu publik dan pemerintah mengevaluasi apa yang berjalan
> baik dan apa yang perlu diperbaiki — agar program dapat melayani anak-anak
> Indonesia lebih baik di masa depan.

> **Pernyataan non-afiliasi:** Proyek ini independen dan tidak berafiliasi
> dengan atau disponsori oleh lembaga pemerintah, kementerian, atau organisasi
> mana pun.
- Data dikumpulkan secara otomatis dari **media publik**, **Wikipedia**, dan
  **peta sebaran SPPG Kementerian Pertanian**
- Bisa ada kesalahan, duplikasi, atau kelalaian — verifikasi sebelum dikutip
- Ini **bukan** saran medis, bukan laporan resmi, dan bukan kampanye politik
- Jika ada insiden yang salah atau perlu dikoreksi, silakan buka issue.
