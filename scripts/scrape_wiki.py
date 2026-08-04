#!/usr/bin/env python3
"""
Scrape MBG poisoning incidents from Indonesian Wikipedia.
Lightweight: requests + wikitextparser only.

  pip install requests wikitextparser
"""
WIKI_PAGE = "Daftar_kasus_keracunan_massal_makan_siang_gratis"
import requests
import wikitextparser as wwp
import re, json, sys, os, time, math, urllib.request, urllib.parse

# Cache geocode results per query to avoid re-hitting the API (persisted to disk)
GEO_CACHE = {}
GEO_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'geo_cache.json')
try:
    with open(GEO_CACHE_FILE) as _f:
        GEO_CACHE = json.load(_f)
except Exception:
    GEO_CACHE = {}

# ── Config ────────────────────────────────────────────────────────────────────
API_URL   = "https://id.wikipedia.org/w/api.php"

# ── Geo lookup ─────────────────────────────────────────────────────────────────
CITY_COORDS = {
    # ACEH
    'kabupaten aceh barat daya': (4.0, 96.6), 'kabupaten aceh besar': (5.4, 95.3),
    'kabupaten aceh jaya': (4.9, 95.7), 'kabupaten aceh selatan': (3.2, 97.4),
    'kabupaten aceh singkil': (2.3, 98.0), 'kabupaten aceh tengah': (4.6, 96.4),
    'kabupaten aceh tenggara': (3.4, 97.6), 'kabupaten aceh timur': (4.7, 97.7),
    'kabupaten aceh utara': (5.0, 96.9), 'kabupaten bireuen': (5.0833, 96.7),
    'kabupaten gayo lues': (4.2, 97.3), 'kabupaten nagan raya': (4.2, 96.5),
    'kabupaten pidie': (5.2, 95.9), 'kabupaten pidie jaya': (5.0, 96.2),
    'kabupaten simeulue': (2.6, 96.0), 'kota banda aceh': (5.5483, 95.3238),
    'kota langsa': (4.5, 97.9), 'kota lhokseumawe': (5.18, 97.15),
    'kota sabang': (5.9, 95.3), 'kota subulussalam': (2.7, 98.0),
    # NORTH SUMATRA
    'kabupaten asahan': (2.9, 99.5), 'kabupaten batubara': (3.1, 99.3),
    'kabupaten dairi': (2.5, 98.1), 'kabupaten deli serdang': (3.5, 98.7),
    'kabupaten humbang hasundutan': (2.0, 98.6), 'kabupaten karo': (3.1, 98.5),
    'kabupaten labuhanbatu': (1.8, 100.0), 'kabupaten labuhanbatu selatan': (1.5, 100.2),
    'kabupaten labuhanbatu utara': (2.2, 99.8), 'kabupaten langkat': (3.9, 98.3),
    'kabupaten mandailing natal': (0.8, 99.2), 'kabupaten nias': (1.1, 97.6),
    'kabupaten nias barat': (1.0, 97.5), 'kabupaten nias selatan': (0.5, 97.9),
    'kabupaten nias utara': (1.4, 97.4), 'kabupaten padang lawas': (1.5, 99.5),
    'kabupaten padang lawas utara': (1.8, 99.3), 'kabupaten pakpak bharat': (2.6, 98.2),
    'kabupaten samosir': (2.5, 98.8), 'kabupaten serdang bedagai': (3.5, 99.0),
    'kabupaten simalungun': (2.9, 99.0), 'kabupaten tapanuli selatan': (1.3, 99.0),
    'kabupaten tapanuli tengah': (1.9, 98.7), 'kabupaten tapanuli utara': (2.2, 98.8),
    'kabupaten toba': (2.3, 99.0), 'kota binjai': (3.6, 98.5),
    'kota gunungsitoli': (1.3, 97.6), 'kota medan': (3.5952, 98.6722),
    'kota padangsidimpuan': (1.4, 99.2), 'kota pematangsiantar': (2.9, 99.0),
    'kota sibolga': (1.7, 98.8), 'kota tanjungbalai': (2.0, 99.8),
    'kota tebing tinggi': (3.6, 99.1),
    # WEST SUMATRA
    'kabupaten agam': (-0.6, 100.5), 'kabupaten dharmasraya': (-1.3, 101.4),
    'kabupaten lima puluh kota': (-0.3, 100.5), 'kabupaten mentawai': (-1.8, 99.3),
    'kabupaten padang pariaman': (-0.7, 100.4), 'kabupaten pasaman': (-0.2, 100.0),
    'kabupaten pasaman barat': (0.2, 99.5), 'kabupaten pesisir selatan': (-1.3, 100.7),
    'kabupaten solok': (-0.9, 100.6), 'kabupaten solok selatan': (-1.4, 101.2),
    'kabupaten tanah datar': (-0.5, 100.6), 'kota bukittinggi': (-0.3, 100.4),
    'kota padang': (-0.9489, 100.3613), 'kota payakumbuh': (-0.2, 100.6),
    'kota sawahlunto': (-0.7, 100.8), 'kota solok': (-0.9, 100.6),
    # RIAU
    'kabupaten bengkalis': (1.5, 102.1), 'kabupaten indragiri hilir': (0.0, 103.0),
    'kabupaten indragiri hulu': (-0.5, 102.3), 'kabupaten kampar': (0.4, 101.1),
    'kabupaten kuantan singingi': (-0.4, 101.5), 'kabupaten pelalawan': (0.8, 102.0),
    'kabupaten rokan hilir': (1.8, 100.8), 'kabupaten rokan hulu': (1.2, 101.0),
    'kabupaten siak': (1.0, 102.0), 'kota dumai': (1.7, 101.4),
    'kota pekanbaru': (0.5071, 101.4478), 'kota batam': (1.1, 104.0),
    'kabupaten karimun': (1.0, 103.3), 'kabupaten kepulauan anambas': (3.0, 106.0),
    # JAMBI
    'kabupaten bungo': (-1.4, 102.1), 'kabupaten kerinci': (-2.0, 101.5),
    'kabupaten merangin': (-2.3, 102.1), 'kabupaten muaro jambi': (-1.6, 103.5),
    'kabupaten sarolangun': (-2.0, 102.9), 'kabupaten sungai penuh': (-1.5, 103.1),
    'kabupaten tanjung jabung barat': (-1.1, 103.6),
    'kabupaten tanjung jabung timur': (-1.0, 103.5), 'kabupaten tebo': (-1.5, 102.4),
    'kota jambi': (-1.6, 103.6),
    # SOUTH SUMATRA
    'kabupaten banyuasin': (-3.0, 104.6), 'kabupaten empat lawang': (-3.7, 102.8),
    'kabupaten lahat': (-3.8, 103.5), 'kabupaten muara enim': (-3.5, 103.5),
    'kabupaten musi banyuasin': (-3.0, 103.5), 'kabupaten musi rawas': (-3.0, 103.2),
    'kabupaten musi rawas utara': (-2.8, 103.1), 'kabupaten ogan ilir': (-3.5, 104.5),
    'kabupaten ogan komering ilir': (-3.6, 105.2), 'kabupaten ogan komering ulu': (-4.0, 104.0),
    'kabupaten ogan komering ulu selatan': (-4.3, 104.1),
    'kabupaten ogan komering ulu timur': (-4.0, 105.0),
    'kabupaten penukal abab lematang ilir': (-3.2, 103.9),
    'kota lubuklinggau': (-3.3, 102.9), 'kota pagaralam': (-4.0, 103.1),
    'kota palembang': (-2.9908, 104.7558), 'kota prabumulih': (-3.5, 104.2),
    # BENGKULU
    'kabupaten bengkulu selatan': (-4.3, 102.6), 'kabupaten bengkulu tengah': (-3.8, 102.3),
    'kabupaten bengkulu utara': (-3.8, 102.3), 'kabupaten kaur': (-4.5, 103.2),
    'kabupaten kepahiang': (-3.6, 102.5), 'kabupaten lebbong': (-3.0, 102.2),
    'kabupaten rejang lebong': (-3.4, 102.5), 'kabupaten seluma': (-4.0, 102.5),
    'kota bengkulu': (-3.8, 102.3),
    # LAMPUNG
    'kabupaten lampung barat': (-5.0, 103.8), 'kabupaten lampung selatan': (-5.6, 105.4),
    'kabupaten lampung tengah': (-4.95, 105.2), 'kabupaten lampung timur': (-4.8, 105.7),
    'kabupaten lampung utara': (-4.9, 104.8), 'kabupaten mesuji': (-4.0, 105.4),
    'kabupaten pesawaran': (-5.24, 105.07), 'kabupaten pringsewu': (-5.36, 104.97),
    'kabupaten tanggamus': (-5.4, 104.5), 'kabupaten tulang bawang': (-4.3, 105.3),
    'kabupaten tulang bawang barat': (-4.5, 105.0), 'kabupaten way kanan': (-5.1, 104.4),
    'kota Bandar lampung': (-5.4299, 105.262), 'kota metro': (-5.1, 105.3),
    # BANTEN
    'kabupaten lebak': (-6.56, 106.22), 'kabupaten pandeglang': (-6.36, 105.6),
    'kabupaten serang': (-6.1156, 106.1842), 'kabupaten tangerang': (-6.25, 106.6),
    'kota cilegon': (-6.0, 106.0), 'kota tangerang': (-6.1781, 106.63),
    'kota tangerang selatan': (-6.34, 106.72),
    # DKI
    'jakarta barat': (-6.17, 106.65), 'jakarta pusat': (-6.1751, 106.83),
    'jakarta selatan': (-6.26, 106.81), 'jakarta timur': (-6.22, 106.88),
    'jakarta utara': (-6.12, 106.87),
    'kota administrasi jakarta barat': (-6.17, 106.65),
    'kota administrasi jakarta pusat': (-6.1751, 106.83),
    'kota administrasi jakarta selatan': (-6.26, 106.81),
    'kota administrasi jakarta timur': (-6.22, 106.88),
    'kota administrasi jakarta utara': (-6.12, 106.87),
    # WEST JAVA
    'kabupaten bandung': (-6.95, 107.6), 'kabupaten bandung barat': (-6.93, 107.35),
    'kabupaten bekasi': (-6.25, 107.0), 'kabupaten bogor': (-6.6, 106.7),
    'kabupaten ciamis': (-7.32, 108.35), 'kabupaten cianjur': (-6.8176, 107.1457),
    'kabupaten cirebon': (-6.7328, 108.5527), 'kabupaten garut': (-7.2181, 107.9036),
    'kabupaten indramayu': (-6.35, 108.05), 'kabupaten karawang': (-6.3064, 107.3366),
    'kabupaten kuningan': (-6.97, 108.5), 'kabupaten majalengka': (-6.83, 108.2),
    'kabupaten pangandaran': (-7.7, 108.6), 'kabupaten purwakarta': (-6.5569, 107.4432),
    'kabupaten subang': (-6.5597, 107.7593), 'kabupaten sukabumi': (-6.92, 106.93),
    'kabupaten sumedang': (-6.83, 107.92),
    'kabupaten tasikmalaya': (-7.3267, 108.2243), 'kota bandung': (-6.9175, 107.6191),
    'kota bekasi': (-6.23, 106.99), 'kota bogor': (-6.6127, 106.8),
    'kota cimahi': (-6.88, 107.55), 'kota cirebon': (-6.7328, 108.5527),
    'kota depok': (-6.4, 106.8), 'kota sukabumi': (-6.92, 106.93),
    'kota tasikmalaya': (-7.3267, 108.2243),
    # CENTRAL JAVA
    'kabupaten banyumas': (-7.5, 109.3), 'kabupaten batang': (-7.0, 109.9),
    'kabupaten blora': (-7.0231, 111.4029), 'kabupaten boyolali': (-7.5321, 110.5274),
    'kabupaten brebes': (-6.8, 108.9), 'kabupaten cilacap': (-7.5, 109.0),
    'kabupaten demak': (-6.9, 110.7), 'kabupaten grobogan': (-7.05, 110.9),
    'kabupaten jepara': (-6.5, 110.6), 'kabupaten karanganyar': (-7.6, 110.9),
    'kabupaten kebumen': (-7.6, 109.6), 'kabupaten kendal': (-6.9, 110.1),
    'kabupaten klaten': (-7.7055, 110.5911), 'kabupaten kudus': (-6.8042, 110.8416),
    'kabupaten magelang': (-7.5, 110.2), 'kabupaten pati': (-6.7, 111.0),
    'kabupaten pekalongan': (-6.8886, 109.6755), 'kabupaten pemalang': (-6.9, 109.4),
    'kabupaten purbalingga': (-7.4, 109.3), 'kabupaten purwodadi': (-7.1, 110.9),
    'kabupaten purworejo': (-7.7, 110.0), 'kabupaten rembang': (-6.7, 111.3),
    'kabupaten semarang': (-7.0, 110.4), 'kabupaten sidoarjo': (-7.4542, 112.7178),
    'kabupaten sragen': (-7.4, 111.0), 'kabupaten tegal': (-6.8741, 109.1402),
    'kabupaten temanggung': (-7.3, 110.2), 'kabupaten wonogiri': (-7.867, 110.907),
    'kabupaten wonosobo': (-7.4, 109.9), 'kota magelang': (-7.5, 110.2),
    'kota pekalongan': (-6.8886, 109.6755), 'kota salatiga': (-7.33, 110.5),
    'kota semarang': (-6.9667, 110.4204), 'kota surakarta': (-7.6, 110.83),
    'kota tegal': (-6.8741, 109.1402),
    # EAST JAVA
    'kabupaten bangkalan': (-7.0, 112.9), 'kabupaten banyuwangi': (-8.2192, 114.3695),
    'kabupaten blitar': (-8.0892, 112.0489), 'kabupaten bojonegoro': (-7.2, 111.9),
    'kabupaten bondowoso': (-7.9, 113.8), 'kabupaten gresik': (-7.1583, 112.6512),
    'kabupaten jember': (-8.1853, 113.6825), 'kabupaten jombang': (-7.5, 112.2),
    'kabupaten kediri': (-7.8483, 112.0169), 'kabupaten lamongan': (-7.1176, 112.4173),
    'kabupaten lumajang': (-8.1321, 113.2214), 'kabupaten madiun': (-7.6, 111.5),
    'kabupaten magetan': (-7.6, 111.3), 'kabupaten malang': (-7.9784, 112.6311),
    'kabupaten mojokerto': (-7.5215, 112.4188), 'kabupaten nganjuk': (-7.6038, 111.9017),
    'kabupaten ngawi': (-7.7, 111.1), 'kabupaten pacitan': (-8.2, 111.1),
    'kabupaten pamekasan': (-7.2, 113.5), 'kabupaten pasuruan': (-7.76, 112.9078),
    'kabupaten ponorogo': (-7.8672, 111.4719), 'kabupaten probolinggo': (-7.7551, 113.1547),
    'kabupaten sampang': (-7.1, 113.2), 'kabupaten situbondo': (-7.7069, 114.0104),
    'kabupaten sukoharjo': (-7.7149, 110.8258), 'kabupaten trenggalek': (-8.1, 111.7),
    'kabupaten tuban': (-6.898, 112.0486), 'kabupaten tulungagung': (-8.1, 111.9),
    'kota Batu': (-7.87, 112.52), 'kota kediri': (-7.8483, 112.0169),
    'kota malang': (-7.9784, 112.6311), 'kota mojokerto': (-7.5215, 112.4188),
    'kota pasuruan': (-7.76, 112.9078), 'kota surabaya': (-7.2571, 112.7521),
    'kota madiun': (-7.6, 111.5),
    # DIY
    'kabupaten bantul': (-7.8885, 110.3275), 'kabupaten gunungkidul': (-7.9997, 110.5985),
    'kabupaten kulon progo': (-7.6667, 110.15), 'kabupaten sleman': (-7.7158, 110.3554),
    'kota yogyakarta': (-7.7972, 110.3615),
    # BALI
    'kabupaten badung': (-8.6, 115.17), 'kabupaten bangli': (-8.3, 115.3),
    'kabupaten buleleng': (-8.15, 115.0), 'kabupaten gianyar': (-8.47, 115.33),
    'kabupaten jembrana': (-8.3, 114.6), 'kabupaten klungkung': (-8.53, 115.4),
    'kabupaten tabanan': (-8.55, 115.07), 'kota denpasar': (-8.6525, 115.2192),
    # NTB
    'kabupaten bima': (-8.5, 118.7), 'kabupaten dompu': (-8.5, 118.5),
    'kabupaten lombok barat': (-8.65, 116.1), 'kabupaten lombok tengah': (-8.6, 116.3),
    'kabupaten lombok timur': (-8.5, 116.5), 'kabupaten lombok utara': (-8.35, 116.4),
    'kabupaten sumbawa': (-8.7, 117.5), 'kota mataram': (-8.5833, 116.1167),
    'kota bima': (-8.5, 118.7),
    # NTT
    'kabupaten alor': (-8.3, 124.6), 'kabupaten belu': (-9.0, 125.0),
    'kabupaten ende': (-8.8, 121.7), 'kabupaten flores timur': (-8.4, 123.0),
    'kabupaten kupang': (-10.1774, 123.6635), 'kabupaten lamahela': (-8.6, 122.5),
    'kabupaten malaka': (-9.4, 124.9), 'kabupaten manggarai': (-8.6, 120.5),
    'kabupaten manggarai barat': (-8.6, 120.0), 'kabupaten manggarai timur': (-8.5, 121.0),
    'kabupaten nagekeo': (-8.7, 121.0), 'kabupaten ngada': (-8.7, 121.0),
    'kabupaten rote ndao': (-10.7, 123.3), 'kabupaten sikka': (-8.6, 122.1),
    'kabupaten sumba barat': (-9.6, 119.5), 'kabupaten sumba barat daya': (-9.6, 119.2),
    'kabupaten sumba tengah': (-9.6, 119.5), 'kabupaten sumba timur': (-9.6, 121.0),
    'kabupaten timor tengah norte': (-9.3, 124.5),
    'kabupaten timor tengah selatan': (-9.7, 124.8), 'kota kupang': (-10.1774, 123.6635),
    # WEST KALIMANTAN
    'kabupaten kapuas hulu': (0.8, 112.3), 'kabupaten kayong utara': (-1.2, 110.1),
    'kabupaten ketapang': (-1.8, 110.0), 'kabupaten kubu raya': (-0.2, 109.8),
    'kabupaten landak': (0.1, 109.4), 'kabupaten melawi': (-0.8, 111.5),
    'kabupaten pontianak': (-0.03, 109.33), 'kabupaten sambas': (1.4, 108.9),
    'kabupaten sanggau': (0.4, 110.6), 'kabupaten sekadau': (0.0, 110.9),
    'kabupaten sintang': (0.0, 111.5), 'kota pontianak': (-0.03, 109.33),
    'kota singkawang': (0.9, 108.9),
    # CENTRAL KALIMANTAN
    'kabupaten arut selatan': (-2.6, 111.6), 'kabupaten barito selatan': (-2.5, 114.2),
    'kabupaten barito tengah': (-1.8, 113.5), 'kabupaten barito timur': (-2.0, 114.8),
    'kabupaten barito utara': (-1.3, 114.6), 'kabupaten gunung mas': (-1.2, 113.3),
    'kabupaten kapuas': (-1.5, 113.0), 'kabupaten katingan': (-1.5, 113.0),
    'kabupaten kotawaringin barat': (-2.8, 111.6),
    'kabupaten kotawaringin timur': (-2.1, 112.9), 'kabupaten lamandau': (-1.9, 112.2),
    'kabupaten murung raya': (0.1, 114.8), 'kabupaten pulang pisau': (-2.7, 113.9),
    'kabupaten seruyan': (-2.5, 112.5), 'kabupaten sukamara': (-2.5, 111.2),
    'kota palangka raya': (-2.2138, 113.9213),
    # SOUTH KALIMANTAN
    'kabupaten balangan': (-2.3, 115.4), 'kabupaten banjar': (-3.5, 114.8),
    'kabupaten barito kuala': (-3.2, 114.6), 'kabupaten hulu sungai selatan': (-2.7, 115.3),
    'kabupaten hulu sungai tengah': (-2.5, 115.3), 'kabupaten hulu sungai utara': (-2.4, 115.2),
    'kabupaten kotabaru': (-2.5, 116.0), 'kabupaten tabalong': (-1.9, 115.7),
    'kabupaten tanah bumbu': (-2.9, 115.9), 'kabupaten tanah laut': (-3.6, 114.7),
    'kabupaten tapin': (-2.9, 115.0), 'kota banjarmasin': (-3.318, 114.5912),
    'kota banjarbaru': (-3.5, 114.8),
    # EAST KALIMANTAN
    'kabupaten berau': (2.0, 117.5), 'kabupaten kutai kartanegara': (0.5, 117.0),
    'kabupaten kutai timur': (1.0, 118.0), 'kabupaten mahakam ulu': (0.8, 115.5),
    'kabupaten nunukan': (4.0, 117.5), 'kabupaten paser': (-1.5, 115.8),
    'kabupaten penajam paser utara': (-1.3, 116.5), 'kabupaten bulungan': (3.0, 117.0),
    'kota balikpapan': (-1.2671, 116.8286), 'kota bontang': (0.1, 117.5),
    'kota samarinda': (-0.4943, 117.1488), 'kota tarakan': (3.3, 117.6),
    # NORTH SULAWESI
    'kabupaten bitung': (1.4, 125.0), 'kabupaten boalemo': (0.6, 122.3),
    'kabupaten bolmong': (0.7, 123.7), 'kabupaten minahasa': (1.3, 124.9),
    'kabupaten minahasa selatan': (1.2, 124.8), 'kabupaten minahasa tenggara': (1.3, 125.0),
    'kabupaten minahasa utara': (1.5, 124.9), 'kota bitung': (1.4, 125.0),
    'kota kotamobagu': (0.7, 124.3), 'kota manado': (1.4741, 124.8412),
    'kota tomohon': (1.3, 124.8),
    # CENTRAL SULAWESI
    'kabupaten buol': (1.2, 121.4), 'kabupaten donggala': (-0.7, 119.7),
    'kabupaten morowali': (-2.7, 121.5), 'kabupaten parigi moutong': (-0.8, 120.2),
    'kabupaten poso': (-1.4, 120.7), 'kabupaten sigi': (-1.8, 119.9),
    'kabupaten tolitoli': (1.0, 120.8), 'kota palu': (-0.9025, 119.87),
    # SOUTH SULAWESI
    'kabupaten bantaeng': (-5.5, 120.0), 'kabupaten barru': (-4.0, 119.7),
    'kabupaten bone': (-4.2, 120.3), 'kabupaten bulukumba': (-5.6, 120.2),
    'kabupaten enrekang': (-3.7, 119.8), 'kabupaten gowa': (-5.3, 119.7),
    'kabupaten jeneponto': (-5.6, 119.7), 'kabupaten luwu': (-3.0, 120.3),
    'kabupaten luwu timur': (-2.5, 120.8), 'kabupaten luwu utara': (-2.5, 120.3),
    'kabupaten maros': (-5.0, 119.7), 'kabupaten pangkajene dan kepulauan': (-4.8, 119.6),
    'kabupaten pinrang': (-3.8, 119.7), 'kabupaten sidenreng rappang': (-3.9, 120.0),
    'kabupaten sinjai': (-5.3, 120.1), 'kabupaten soppeng': (-3.8, 120.0),
    'kabupaten takalar': (-5.4, 119.4), 'kabupaten tana toraja': (-3.0, 119.8),
    'kabupaten toraja utara': (-3.0, 119.8), 'kabupaten wajo': (-4.0, 120.0),
    'kota makassar': (-5.1427, 119.4125), 'kota parepare': (-3.8, 119.6),
    'kota palopo': (-3.0, 120.2),
    # SOUTHEAST SULAWESI
    'kabupaten bombana': (-4.5, 122.0), 'kabupaten buton': (-5.4, 122.6),
    'kabupaten buton selatan': (-5.6, 122.5), 'kabupaten buton tengah': (-5.3, 122.7),
    'kabupaten buton utara': (-5.0, 122.8), 'kabupaten kolaka': (-4.2, 121.6),
    'kabupaten kolaka timur': (-4.1, 121.8), 'kabupaten kolaka utara': (-4.1, 121.8),
    'kabupaten konawe': (-4.0, 122.0), 'kabupaten konawe kepulauan': (-4.1, 123.0),
    'kabupaten konawe selatan': (-4.2, 122.0), 'kabupaten konawe utara': (-3.5, 122.0),
    'kabupaten muna': (-5.0, 122.5), 'kabupaten muna barat': (-5.3, 122.4),
    'kabupaten wakatobi': (-5.2, 123.5), 'kota bau-bau': (-5.4, 122.6),
    'kota kendari': (-3.9865, 122.5146),
    # GORONTALO
    'kabupaten bone bolango': (0.5, 123.0), 'kabupaten gorontalo': (0.5, 123.0),
    'kabupaten gorontalo utara': (0.6, 122.5), 'kabupaten pohuwato': (0.7, 122.8),
    'kota gorontalo': (0.540, 123.062),
    # WEST SULAWESI
    'kabupaten majene': (-3.54, 118.97), 'kabupaten mamuju': (-2.5, 119.4),
    'kabupaten mamuju tengah': (-2.5, 119.3), 'kabupaten mamuju utara': (-2.2, 119.4),
    'kabupaten polewali mandar': (-3.42, 119.32),
    # MALUKU
    'kabupaten buru': (-3.4, 126.5), 'kabupaten buru selatan': (-3.6, 126.4),
    'kabupaten kepulauan aru': (-6.2, 134.5), 'kabupaten maluku barat daya': (-7.8, 128.0),
    'kabupaten maluku central': (-3.5, 128.0), 'kabupaten maluku tenggara': (-6.0, 132.0),
    'kabupaten maluku tenggara barat': (-7.5, 130.0),
    'kabupaten seram bagian barat': (-3.0, 128.0), 'kabupaten seram bagian timur': (-3.0, 130.0),
    'kota ambon': (-3.7, 128.2), 'kota ternate': (0.8, 127.4),
    'kota tidore kepulauan': (0.7, 127.5), 'kota tual': (-5.6, 132.7),
    # NORTH MALUKU
    'kabupaten halmahera barat': (1.3, 127.5), 'kabupaten halmahera selatan': (0.5, 128.0),
    'kabupaten halmahera tengah': (0.5, 128.5), 'kabupaten halmahera utara': (1.5, 127.8),
    'kabupaten kepulauan sula': (-1.8, 125.5), 'kota ternate': (0.8, 127.4),
    'kota tidore kepulauan': (0.7, 127.5),
    # PAPUA
    'kabupaten fakfak': (-3.0, 133.0), 'kabupaten jayapura': (-2.6, 140.7),
    'kabupaten manokwari': (-0.9, 134.0), 'kabupaten maybrat': (-1.0, 132.0),
    'kabupaten mimika': (-4.5, 136.9), 'kabupaten nabire': (-3.5, 135.5),
    'kabupaten sorong': (-0.9, 131.2), 'kabupaten teluk bintuni': (-2.2, 133.5),
    'kabupaten raja ampat': (-0.5, 130.5), 'kota jayapura': (-2.6, 140.7),
    'kota sorong': (-0.9, 131.2),
    # Province-level fallbacks
    'aceh': (5.5483, 95.3238), 'sumatera utara': (3.6, 98.7),
    'sumatera barat': (-0.9, 100.4), 'riau': (0.5, 101.5),
    'jambi': (-1.6, 103.6), 'sumatera selatan': (-3.0, 104.0),
    'bengkulu': (-3.8, 102.3), 'lampung': (-4.9956, 105.2836),
    'banten': (-6.12, 106.15), 'jakarta': (-6.2088, 106.8456),
    'jawa barat': (-6.9, 107.6), 'jawa tengah': (-7.15, 110.14),
    'jawa timur': (-7.5, 112.5), 'yogyakarta': (-7.7972, 110.3615),
    'bali': (-8.34, 115.09), 'ntb': (-8.65, 117.4),
    'ntt': (-8.75, 121.5), 'kalimantan barat': (0.0, 109.3),
    'kalimantan tengah': (-1.5, 113.0), 'kalimantan selatan': (-3.1, 115.2),
    'kalimantan timur': (1.0, 116.0), 'sulawesi selatan': (-4.0, 120.0),
    'sulawesi tengah': (-1.0, 121.0), 'sulawesi utara': (1.0, 124.8),
    'sulawesi tenggara': (-4.0, 122.5), 'sulawesi barat': (-2.8, 119.4),
    'gorontalo': (0.540, 123.062), 'maluku': (-3.0, 128.0),
    'maluku utara': (0.5, 128.0), 'papua': (-3.5, 136.0),
}

# ── Outlet name lookup ─────────────────────────────────────────────────────────
OUTLET_NAMES = {
    'kompas.com': 'Kompas.com', 'regional.kompas.com': 'Kompas.com',
    'detik.com': 'Detik.com', 'detiknews.com': 'Detik.com',
    'news.detik.com': 'Detik.com',
    'cnnindonesia.com': 'CNN Indonesia', 'www.cnnindonesia.com': 'CNN Indonesia',
    'tribunnews.com': 'Tribunnews.com', 'www.tribunnews.com': 'Tribunnews.com',
    'tribun-jabar.com': 'Tribunnews.com', 'tribun-timur.com': 'Tribunnews.com',
    'tribunbali.com': 'Tribunnews.com', 'tribunpekanbaru.com': 'Tribunnews.com',
    'tribunpontianak.com': 'Tribunnews.com', 'tribunmedan.com': 'Tribunnews.com',
    'tribunpadang.com': 'Tribunnews.com', 'tribunsolo.com': 'Tribunnews.com',
    'tribunbogor.com': 'Tribunnews.com', 'tribundepok.com': 'Tribunnews.com',
    'tribunjateng.com': 'Tribunnews.com', 'tribunjatim.com': 'Tribunnews.com',
    'tribunlampung.com': 'Tribunnews.com',
    'antaranews.com': 'Antara', 'rmol.id': 'RMOL.id',
    'mediaindonesia.com': 'Media Indonesia', 'suara.com': 'Suara.com',
    'suaracommerce.com': 'Suara.com', 'tempo.co': 'Tempo.co',
    'www.tempo.co': 'Tempo.co', 'pikiran-rakyat.com': 'Pikiran Rakyat',
    'pikiranrakyat.com': 'Pikiran Rakyat',
    'www.pikiran-rakyat.com': 'Pikiran Rakyat',
    'rri.co.id': 'RRI.co.id', 'www.rri.co.id': 'RRI.co.id',
    'ajnn.net': 'AJNN.net', 'www.ajnn.net': 'AJNN.net',
    'harian-analisa.com': 'Harian Analisa', 'acehtoday.id': 'Aceh Today',
    'www.acehtoday.id': 'Aceh Today',
    'solopos.com': 'Solopos.com', 'www.solopos.com': 'Solopos.com',
    'waspada.co.id': 'Waspada Online', 'www.waspada.co.id': 'Waspada Online',
    'banjarmasinpost.co.id': 'Banjarmasin Post',
    'www.banjarmasinpost.co.id': 'Banjarmasin Post',
    'jambonews.id': 'Jambo News', 'jambiseru.com': 'Jambi Seru',
    'paluekspres.co.id': 'Palu Ekspres', 'www.paluekspres.co.id': 'Palu Ekspres',
    'sulteng raya.com': 'Sulteng Raya', 'sultengrayanews.com': 'Sulteng Raya',
    'fajar.co.id': 'Fajar.co.id', 'www.fajar.co.id': 'Fajar.co.id',
    'makassar.terkini.id': 'Terbit Indonesia', 'terkini.id': 'Terbit Indonesia',
    'sultra.terkini.id': 'Terbit Indonesia',
    'radarsultra.co.id': 'Radar Sultra', 'www.radarsultra.co.id': 'Radar Sultra',
    'kendariinfo.com': 'Kendari Info', 'www.kendariinfo.com': 'Kendari Info',
    'lombokpost.jawapos.com': 'Lombok Post', 'jawapos.com': 'Jawa Pos',
    'www.jawapos.com': 'Jawa Pos', 'jatimnetwork.com': 'Jatim Network',
    'wartabromo.com': 'Warta Bromo', 'www.wartabromo.com': 'Warta Bromo',
    'kaltimkeadilan.id': 'Kaltim Keadilan', 'www.kaltimkeadilan.id': 'Kaltim Keadilan',
    'infoblitar.co.id': 'Info Blitar', 'wartajatim.com': 'WartaJatim.com',
    'beritadaerah.com': 'Beritadaerah.com', 'kliksulteng.com': 'Klik Sulteng',
    'infopublik.id': 'InfoPublik.id', 'www.infopublik.id': 'InfoPublik.id',
    'katadata.co.id': 'Katadata', 'radarbanyumas.com': 'Radar Banyumas',
    'radarjateng.com': 'Radarjateng.com', 'radarsemarang.com': 'Radar Semarang',
}

def geo_lookup(text):
    t = text.lower().strip()
    if t in CITY_COORDS:
        return CITY_COORDS[t]
    for key in sorted(CITY_COORDS.keys(), key=len, reverse=True):
        if key in t:
            return CITY_COORDS[key]
    return None, None


def normalize_school_name(name):
    """Expand Indonesian school abbreviations Nominatim understands:
    SMKN 6 Semarang -> SMK Negeri 6 Semarang, SDN 1 X -> SD Negeri 1 X, etc."""
    n = re.sub(r'\bSMKN\b', 'SMK Negeri', name, flags=re.I)
    n = re.sub(r'\bSMK N\b', 'SMK Negeri', n, flags=re.I)
    n = re.sub(r'\bSDN\b', 'SD Negeri', n, flags=re.I)
    n = re.sub(r'\bSD N\b', 'SD Negeri', n, flags=re.I)
    n = re.sub(r'\bSMPN\b', 'SMP Negeri', n, flags=re.I)
    n = re.sub(r'\bSMP N\b', 'SMP Negeri', n, flags=re.I)
    n = re.sub(r'\bMAN\b', 'Madrasah Aliyah Negeri', n, flags=re.I)
    n = re.sub(r'\bMIN\b', 'Madrasah Ibtidaiyah Negeri', n, flags=re.I)
    n = re.sub(r'\bMI\b', 'Madrasah Ibtidaiyah', n, flags=re.I)
    n = re.sub(r'\bTK\b', 'Taman Kanak-Kanak', n, flags=re.I)
    return n.strip()


def geocode_nominatim(query):
    """Geocode via Nominatim, cached. Returns (lat, lng) or (None, None).
    Nominatim usage policy: max 1 request/sec. We sleep between cache misses."""
    key = query.lower()
    if key in GEO_CACHE:
        return GEO_CACHE[key]
    params = urllib.parse.urlencode({
        'q': query + ', Indonesia', 'format': 'json', 'limit': 1, 'countrycodes': 'id',
    })
    url = 'https://nominatim.openstreetmap.org/search?' + params
    try:
        req = urllib.request.Request(url, headers=NOMINATIM_HEADERS)
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        result = (float(data[0]['lat']), float(data[0]['lon'])) if data else (None, None)
    except Exception:
        result = (None, None)
    GEO_CACHE[key] = result
    time.sleep(1.1)  # Nominatim 1 req/sec policy
    if len(GEO_CACHE) % 25 == 0:
        print(f'  ...geocoded {len(GEO_CACHE)} unique queries', flush=True)
    return result


def geo_lookup_enhanced(school, kabupaten, province):
    """Best-effort geocode: exact school -> kabupaten/kelurahan -> static CITY_COORDS.
    Returns (lat, lng)."""
    if school and school.lower() not in ('tidak disebutkan', 'tba', 'spesifik tidak disebutkan'):
        norm = normalize_school_name(school)
        # Single query: school + kabupaten context (Nominatim resolves the school)
        lat, lng = geocode_nominatim(f'{norm}, {kabupaten}')
        if lat and lng:
            return lat, lng
    # Fallback: kabupaten or province from static dict
    lat, lng = geo_lookup(kabupaten) or geo_lookup(province) or (None, None)
    return lat, lng

def unwikify(text):
    return re.sub(r'\[\[([^\]|]+?\|)?([^\]]+?)\]\]', r'\2', text)

def cite_url(cite_text):
    # Extract URL from Cite web template: url=VALUE where VALUE ends at | or }}
    m = re.search(r'\burl\s*=\s*https?://[^\s|]+', cite_text, re.IGNORECASE)
    if not m:
        return ""
    url = m.group(0).split("=", 1)[1].strip()
    return url

def ref_url(ref_cell, wikitext):
    inline = cite_url(ref_cell)
    if inline:
        return inline
    m = re.search(r'<ref[^>]+name="([^"]+)', ref_cell)
    if not m:
        return ""
    ref_id = m.group(1)
    pattern = re.compile(
        r'<ref[^>]*name="[^"]*' + re.escape(ref_id) + r'"[^>]*>(.*?)</ref>',
        re.DOTALL | re.IGNORECASE,
    )
    for match in pattern.finditer(wikitext):
        url = cite_url(match.group(1))
        if url:
            return url
    return ""

def extract_outlet(url):
    if not url:
        return 'Wikipedia'
    url_lower = url.lower()
    for key, name in OUTLET_NAMES.items():
        if key in url_lower:
            return name
    domain = re.sub(r'^https?://(www\.)?', '', url_lower).split('/')[0]
    name = domain.split('.')[0].replace('-', ' ').replace('_', ' ').title()
    return name or 'Wikipedia'

def parse_num(s):
    m = re.sub(r'[^\d]', '', str(s)) if s else ''
    return int(m) if m else 0

def fmt_n(n):
    """Indonesian thousands separator: 1333 -> '1.333'."""
    return f"{n:,}".replace(",", ".")

def format_date(raw):
    """Convert '29 September 2025' to '2025-09-29' for JS Date() parsing."""
    raw = unwikify(raw).strip()
    months = {
        'januari':'01','februari':'02','maret':'03','april':'04',
        'mei':'05','juni':'06','juli':'07','agustus':'08',
        'september':'09','oktober':'10','november':'11','desember':'12',
    }
    m = re.match(r'(\d{1,2})\s+(\w+)\s+(\d{4})', raw)
    if m:
        day   = m.group(1).zfill(2)
        month = months.get(m.group(2).lower(), m.group(2))
        year  = m.group(3)
        return f"{year}-{month}-{day}"
    return raw

def scrape(out_file="data/wiki_incidents.json"):
    print("Fetching wikitext from MediaWiki API...")
    resp = requests.get(API_URL, params={
        "action": "parse", "page": WIKI_PAGE, "prop": "wikitext", "format": "json",
    }, headers={"User-Agent": "mbg-monitor/1.0 (educational)"})
    resp.raise_for_status()
    wikitext = resp.json()["parse"]["wikitext"]["*"]
    print(f"  {len(wikitext):,} chars")

    tables = wwp.parse(wikitext).tables
    if not tables:
        raise SystemExit("No tables found")
    table = tables[0]
    rows = table.data()
    print(f"  {len(rows)} rows (incl. headers)")

    incidents = []
    for row in rows[2:]:
        if len(row) < 7:
            continue
        date_raw = str(row[0]).strip()
        if not date_raw or date_raw in {'Tanggal Kejadian', 'TOTAL'}:
            continue

        province = unwikify(str(row[1]).strip())
        city     = unwikify(str(row[2]).strip())
        school   = unwikify(str(row[3]).strip())
        symp     = str(row[4]).strip()
        deaths_s = str(row[5]).strip()
        url = cite_url(str(row[6]).strip())

        victims = parse_num(symp)
        deaths  = parse_num(deaths_s)

        tba_patterns = ('tba', 'tidak disebutkan', 'tidak disebut')
        is_tba = any(school.lower().startswith(p) for p in tba_patterns) if school else True
        title = school if not is_tba else city
        loc   = city

        lat, lng = geo_lookup(city) or geo_lookup(province) or (None, None)

        note = f"{fmt_n(victims)} Keracunan"
        if deaths > 0:
            note += f" | {fmt_n(deaths)} Meninggal"
        lat, lng = geo_lookup_enhanced(school, city, province)
        source = extract_outlet(url)

        incidents.append({
            "cat": "keracunan", "date": format_date(date_raw),
            "lat": lat, "lng": lng, "province": province,
            "kabupaten": city, "school": school, "loc": loc,
            "victims": victims, "deaths": deaths,
            "title": title, "source": source,
            "source_url": url, "note": note,
        })

    # Dedup: Wikipedia lists one row per school for a single incident, each row
    # carrying the SAME total victim count. Treating rows independently inflates
    # totals N-fold. Merge rows that share (date, kabupaten, source) into one
    # incident; victims stay the incident total, counted exactly once.
    from collections import OrderedDict
    groups = OrderedDict()
    for inc in incidents:
        key = (inc["date"], inc["kabupaten"], inc["source_url"])
        groups.setdefault(key, []).append(inc)

    merged = []
    for key, group in groups.items():
        if len(group) == 1:
            merged.append(group[0])
            continue
        first = group[0]
        victims = max(i["victims"] for i in group)
        deaths  = max(i["deaths"] for i in group)
        schools = [i["school"] for i in group if i["school"]]
        note = f"{fmt_n(victims)} korban dari {fmt_n(len(group))} sekolah"
        if deaths > 0:
            note += f" | {fmt_n(deaths)} Meninggal"
        merged.append({
            **first,
            "school": f"{len(group)} sekolah terdampak",
            "schools_list": schools,
            "victims": victims,
            "deaths": deaths,
            "title": first["kabupaten"] or first["loc"] or first["province"],
            "note": note,
        })
    incidents = merged

    # ── Spiral offset: separate schools sharing the same kelurahan/kabupaten point ──
    from collections import defaultdict
    loc_groups = defaultdict(list)
    for inc in incidents:
        if inc['lat'] is not None and inc['lng'] is not None:
            loc_groups[(round(inc['lat'], 3), round(inc['lng'], 3))].append(inc)
    for group in loc_groups.values():
        if len(group) > 1:
            for idx, inc in enumerate(group):
                # Golden-angle spiral, ~90m per step
                angle = idx * 2.399963
                radius = math.sqrt(idx) * 0.0012
                inc['lat'] += radius * math.cos(angle)
                inc['lng'] += radius * math.sin(angle)

    geo_count = sum(1 for i in incidents if i["lat"] is not None)
    url_count = sum(1 for i in incidents if i["source_url"])
    total_v = sum(i["victims"] for i in incidents)
    total_d = sum(i["deaths"] for i in incidents)
    print(f"  {len(incidents)} incidents | {geo_count} geo | {url_count} urls")
    print(f"  Total korban: {total_v:,} | Total meninggal: {total_d}")

    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"incidents": incidents}, f, ensure_ascii=False, indent=2)
    # Persist geocode cache for fast re-runs
    with open(GEO_CACHE_FILE, "w") as f:
        json.dump(GEO_CACHE, f)
    print(f"OK {len(incidents)} -> {out_file}")

    for inc in incidents[:3]:
        print(f"  {inc['title']} | {inc['loc']} | {inc['date']} | {inc['note']} | {inc['source']}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "data/wiki_incidents.json"
    scrape(out)
