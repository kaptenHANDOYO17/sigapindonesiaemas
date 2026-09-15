# SIGAP Drainase

**Sistem Informasi Genangan dan Antisipasi Penyumbatan**

Pemantauan saluran drainase secara langsung di Kelurahan Mangunharjo, Kecamatan
Tugu, Kota Semarang. Sistem membaca tinggi permukaan, debit, dan pH air di
saluran, menilai tingkat penyumbatan, lalu mengirim peringatan berbeda kepada
warga dan petugas BPBD.

> Sebelum melangkah jauh, baca **[YANG_MASIH_KURANG.md](YANG_MASIH_KURANG.md)**.
> Berkas itu memuat batasan sistem yang perlu Anda ketahui sejak awal.

---

## Mengapa drainase

Pada Januari 2026, genangan di Mangunharjo merendam 280 kepala keluarga di RT 1
sampai 6, dengan ketinggian 10 sampai 40 sentimeter dan beberapa titik mencapai
60 sentimeter. BPBD Kota Semarang menyebut saluran drainase yang tidak sanggup
menampung debit sebagai salah satu penyebab yang memperparah keadaan.

Persoalannya bukan air yang datang tiba-tiba. Endapan menumpuk pelan-pelan
selama berminggu-minggu, dan tidak ada yang mengetahuinya sampai hujan turun.
Sistem ini mengubah penumpukan yang tak terlihat itu menjadi angka yang bisa
dipantau setiap hari.

---

## Cara kerja

```
VEGAPULS Air 23  ──NB-IoT──►  VEGA Inventory System ──REST API──┐
(radar 80 GHz, mandiri)                                          │
                                                                 ▼
Sensor debit + pH ──kabel──►  ESP32  ──HTTPS──►           Supabase (PostgreSQL)
                                                                 │
                                                    GitHub Actions (tiap 30 menit)
                                                                 │
                            ┌────────────────────────────────────┤
                            ▼                                    ▼
                    Matriks aturan +                       Dasbor Next.js
                    Isolation Forest +                     (Vercel)
                    LSTM ramalan 12 jam                          │
                            │                                    ▼
                            ▼                            Halaman verifikasi
                    AI Agent (src/agent.py)                    BPBD
                            │                                    │
                ┌───────────┴───────────┐                        │
                ▼                       ▼                        │
        Warga (Telegram/WA)     BPBD (laporan teknis)            │
                                                                 │
                            Pelatihan ulang bulanan  ◄───────────┘
                            (belajar dari verifikasi)
```

**Catatan arsitektur penting:** VEGAPULS Air 23 **tidak** dihubungkan ke ESP32.
Sensor itu perangkat mandiri berbaterai yang mengirim datanya sendiri lewat
jaringan seluler ke VEGA Inventory System. ESP32 hanya menangani sensor debit
dan pH.

---

## Matriks penilaian

| Endapan | Aliran | Status | Arti |
|---|---|---|---|
| rendah | normal | 🟢 **AMAN** | saluran sehat |
| tinggi | normal | 🟡 **WASPADA** | penyempitan |
| tinggi | menurun | 🟠 **SIAGA** | penyumbatan |
| sangat tinggi | sangat rendah | 🔴 **KRITIS** | sumbatan parah |

Di luar matriks pokok, ada empat pemicu tambahan yang menaikkan status:

- muka air mendekati bibir saluran → KRITIS
- endapan melewati separuh kedalaman → KRITIS, tanpa memandang debit
- muka air naik mendadak → SIAGA
- air tinggi tetapi aliran nyaris berhenti → SIAGA (sumbatan benda besar)

Pemicu terakhir ditambahkan karena matriks pokok hanya melihat endapan dasar,
sehingga kasur atau dahan yang menyumbat di hilir bisa lolos tanpa terdeteksi.

---

## Keputusan rancangan

**Aturan yang memutuskan, model yang memberi pendapat.** Status ditentukan
matriks aturan yang bisa dibaca dan diperiksa manusia. Model hanya berwenang
menaikkan status, dan tidak pernah boleh menyatakan keadaan aman. Pembatasan
ini dipertahankan meski model terawasi kini terbukti kuat, karena seluruh
angkanya masih berasal dari simulator.

**Model terawasi menggantikan Isolation Forest.** Isolation Forest mendeteksi
kejarangan, bukan bahaya, dan pada pengujian hanya menangkap 4 persen kejadian
sumbatan. Ia tidak dibuang, melainkan dipindahkan ke pekerjaan yang memang
cocok baginya: menandai pembacaan sensor yang menyimpang, yaitu gejala
kerusakan alat.

**Debit selalu dibandingkan terhadap curah hujan.** Saluran bersih pun berdebit
rendah saat kemarau. Membandingkan debit mentah dengan satu angka tetap akan
membunyikan alarm palsu sepanjang musim kering.

**Endapan disimpulkan, bukan diukur.** Radar tidak bisa melihat menembus air,
sehingga tinggi endapan ditaksir dari permukaan terendah selama periode kering.

**Ambang tidak pernah diubah otomatis.** Pelatihan ulang bulanan hanya
mengusulkan; manusia yang memutuskan. Ambang menyangkut keselamatan warga.

**Pesan memakai templat, bukan model bahasa.** Pesan kebencanaan harus dapat
diprediksi dan diaudit, serta tidak boleh mengarang.

---

## Struktur berkas

```
src/
  config.py            konfigurasi terpusat, geometri saluran, ambang
  rules.py             matriks status, perkiraan volume dan jenis sampah
  features.py          rekayasa fitur, penaksir tinggi endapan
  vega_client.py       penarik data radar dan curah hujan
  supabase_client.py   akses database
  classifier.py        inferensi model penilai status (terawasi)
  anomaly.py           inferensi Isolation Forest (pendeteksi sensor bermasalah)
  forecast.py          inferensi LSTM
  agent.py             ◄── PENYUSUN DAN PENGIRIM NOTIFIKASI
  main.py              pipeline utama

training/
  generate_dataset.py  simulator fisik untuk data awal
  train_classifier.py  pelatihan model penilai status (terawasi)
  train_anomaly.py     pelatihan Isolation Forest
  protokol.py          protokol latih / validasi / uji berstrata
  eksperimen.py        uji generalisasi lintas geometri saluran
  train_forecast.py    pelatihan LSTM (GPU)
  evaluate.py          pengukuran ketepatan dan arah kesalahan
  retrain.py           pelatihan ulang bulanan + belajar dari verifikasi
  cek_sistem.py        pemeriksaan menyeluruh

frontend/              Next.js + Recharts, siap deploy ke Vercel
  app/daftar           pendaftaran nomor warga
  app/admin            konfirmasi pendaftaran oleh pengelola
  app/api/             Route Handler sisi server (kunci rahasia tidak ke peramban)
  README.md            panduan deploy GitHub dan Vercel
firmware/              ESP32 untuk sensor debit dan pH
database/schema.sql    5 tabel, RLS, Realtime, view
database/migrasi_pendaftaran.sql     kolom untuk pendaftaran lewat situs
database/migrasi_admin_laporan.sql   tabel pengelola dan laporan warga
database/akun_pengelola.sql          pembuatan akun pengelola pertama
bot/                   bot Telegram
.github/workflows/     otomasi 30 menit dan bulanan
datasets/
  unduh_data_asli.py   pengunduh curah hujan dan pasang laut sungguhan
docs/                  kalibrasi, GPU, bot Telegram, WhatsApp, batasan sensor, model di Vercel
```

---

## Menjalankan

```bash
pip install -r requirements.txt
cp .env.example .env          # lalu isi nilainya

python -m training.generate_dataset --hari 365
python -m training.train_anomaly --sumber sintetis
python -m training.train_classifier --sumber sintetis
python -m training.train_forecast --sumber sintetis --epoch 60
python -m training.evaluate
python -m training.protokol

python -m training.cek_sistem
python -m src.main --dry-run
```

Panduan langkah demi langkah untuk yang belum terbiasa: **[PANDUAN_AWAM.md](PANDUAN_AWAM.md)**
Daftar periksa sebelum sistem dianggap siap: **[CHECKLIST.md](CHECKLIST.md)**

---

## Hasil pengujian

Diukur dengan protokol latih / validasi / uji: 18 saluran simulasi bergeometri
berbeda, dibagi berstrata menurut proporsi kondisi berbahaya. Pemilihan model
dan penyetelan ambang seluruhnya memakai data validasi; data uji dibuka satu
kali di akhir.

Pada tiga saluran uji (1.159 baris berbahaya, 972 di antaranya KRITIS):

| Ukuran | Aturan saja | Model saja | Aturan + model |
|---|---|---|---|
| Penilaian tepat | 90,8 % | 96,8 % | 92,3 % |
| Kondisi berbahaya tertangkap | 90,8 % | 95,2 % | **96,2 %** |
| Alarm palsu | 5,2 % | 0,2 % | 5,3 % |
| KRITIS terbaca AMAN | 0,00 % | 0,00 % | **0,00 %** |
| Kurang waspada | 3,8 % | 1,9 % | **1,1 %** |

Gabungan dipakai karena mengungguli keduanya pada dua ukuran yang paling
menyangkut keselamatan: bahaya yang tertangkap, dan seberapa jarang sistem
meremehkan keadaan.

Model peramalan muka air, diuji pada saluran yang belum pernah dilihat:

| Ukuran | Hasil |
|---|---|
| Galat 3 jam pertama | 27,9 mm |
| Galat pada jam ke-12 | 65,1 mm |
| Galat rerata keseluruhan | 53,7 mm |
| Pembanding: tebakan naif | 75,1 mm |
| Perbaikan atas pembanding | 28,5 % |

Jalankan sendiri dengan `python -m training.protokol`.

> **Seluruh angka di atas berasal dari simulator, bukan dari saluran
> Mangunharjo.** Data drainase asli berlabel tidak ada di dunia; satu-satunya
> sumbernya adalah petugas yang mengisi formulir verifikasi lapangan. Curah
> hujan yang mendorong simulasi dapat diganti menjadi data sungguhan dengan
> `python datasets/unduh_data_asli.py`, dan itu memang disarankan, tetapi
> labelnya tetap berasal dari model fisika.

## Cara model sampai ke halaman web

Model tidak berjalan di Vercel. Ia berjalan di GitHub Actions setiap 30 menit,
menulis hasilnya ke Supabase, lalu Vercel membaca angka yang sudah jadi.
Alasannya dan langkah lengkapnya ada di
[docs/PANDUAN_MODEL_DI_VERCEL.md](docs/PANDUAN_MODEL_DI_VERCEL.md).
