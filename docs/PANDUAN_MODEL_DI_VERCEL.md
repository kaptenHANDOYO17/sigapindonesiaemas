# Panduan Menggunakan Model di Web Vercel

Berkas ini menjawab satu pertanyaan: setelah model dilatih di komputer Anda,
bagaimana hasilnya sampai ke halaman web yang dibuka warga?

---

## 1. Jawaban singkat: model TIDAK berjalan di Vercel

Ini keputusan rancangan, bukan keterbatasan. Alasannya ada tiga.

**Vercel tidak cocok menjalankan model.** Berkas model berukuran beberapa
megabita, dan memuatnya butuh scikit-learn serta TensorFlow. Fungsi tanpa
server di Vercel punya batas ukuran dan waktu mulai. Setiap kali ada
pengunjung, model harus dimuat ulang dari nol. Itu lambat dan mahal.

**Penilaian tidak boleh bergantung pada pengunjung.** Bila model hanya
berjalan ketika ada yang membuka situs, maka pada pukul dua pagi ketika tidak
ada yang membuka, tidak ada penilaian sama sekali. Padahal justru saat itulah
hujan turun dan saluran perlu dipantau.

**Kunci rahasia tidak boleh ada di peramban.** Menjalankan model di sisi
pengunjung berarti membocorkan akses ke basis data.

Karena itu alurnya seperti ini:

```
Model dilatih di komputer Anda
        │  (berkas model diunggah ke GitHub)
        ▼
GitHub Actions  ──setiap 30 menit──►  memuat model, menilai, menyimpan hasil
        │
        ▼
   Supabase  ◄── satu baris status per siklus
        │
        ▼
   Vercel  ── membaca Supabase, menggambar halaman
        │
        ▼
   Warga membuka situs
```

Vercel hanya membaca angka yang sudah jadi. Ia tidak pernah menjalankan model,
dan tidak perlu tahu apa pun tentang scikit-learn maupun TensorFlow.

---

## 2. Langkah demi langkah

### Langkah 1 — Latih model di komputer Anda

```bash
python datasets/unduh_data_asli.py --tahun 10      # curah hujan asli
python -m training.generate_dataset --hujan-asli --hari 730
python -m training.train_classifier --sumber sintetis
python training/latih_lstm.py
python -m training.protokol                         # periksa hasilnya
```

Setelah selesai, folder `models/` berisi:

| Berkas | Isi |
|---|---|
| `klasifikasi_status.joblib` | model penilai status |
| `klasifikasi_meta.json` | catatan pelatihan dan ambang |
| `lstm_level.keras` | model ramalan muka air |
| `ramalan_scaler.joblib` | penskala untuk ramalan |
| `ramalan_meta.json` | catatan pelatihan ramalan |
| `isolation_forest.joblib` | pendeteksi sensor bermasalah |

### Langkah 2 — Unggah model ke GitHub

```bash
git add models/
git commit -m "Model hasil pelatihan ulang"
git push
```

Bila total berkas model melebihi 100 MB, pakai Git LFS:

```bash
git lfs install
git lfs track "models/*.joblib" "models/*.keras"
git add .gitattributes models/
git commit -m "Model dengan Git LFS"
git push
```

Alur `pipeline.yml` sudah menyalakan `lfs: true` pada langkah checkout, jadi
model tetap terunduh dengan benar saat berjalan.

### Langkah 3 — Pastikan pipeline memakainya

Buka tab **Actions** di GitHub, jalankan alur **SIGAP Drainase** secara manual.
Pada catatan jalannya, Anda harus melihat baris seperti:

```
Model klasifikasi dimuat (sumber sintetis, dilatih 2026-...).
Model klasifikasi menduga WASPADA (keyakinan 87 persen).
>>> STATUS: WASPADA — ...
```

Bila muncul `Model klasifikasi belum ada`, berarti berkas model tidak ikut
terunggah. Periksa `.gitignore`; pastikan `models/` tidak ikut diabaikan.

### Langkah 4 — Periksa Supabase

Buka **Table Editor → status_ai**. Harus muncul baris baru setiap 30 menit,
berisi kolom `status`, `rasio_endapan`, `estimasi_volume_m3`, dan `ramalan`.

Bila kosong, masalahnya ada di pipeline, bukan di Vercel.

### Langkah 5 — Vercel tinggal membaca

Tidak ada yang perlu diubah di Vercel. Dasbor sudah membaca tabel `status_ai`
lewat kunci `anon`, dan memperbarui tampilan sendiri lewat Realtime setiap kali
ada baris baru.

Periksa saja dua hal di **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL       = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJhbGciOi...
NEXT_PUBLIC_TELEGRAM_BOT       = nama_bot_anda
```

Gunakan kunci **anon**, bukan `service_role`. Kunci anon aman berada di
peramban karena basis data sudah dikunci: publik hanya bisa membaca status dan
data sensor, sedangkan nomor kontak warga tidak dapat diakses sama sekali.

---

## 3. Apa yang tampil di halaman

| Bagian halaman | Sumber angkanya |
|---|---|
| Penampang saluran | `rasio_endapan` dan `rasio_air` dari tabel `status_ai` |
| Judul dan alasan status | `status` dan `alasan` |
| Perkiraan material | `estimasi_volume_m3` |
| Grafik endapan dan aliran | riwayat `status_ai` 48 jam terakhir |
| Grafik ramalan 12 jam | kolom `ramalan` berbentuk JSON |
| Grafik debit dan hujan | tabel `sensor_drainase` |
| Halaman verifikasi | menulis ke tabel `verifikasi_lapangan` |

Seluruhnya sudah tersambung. Bila salah satu bagian kosong, penyebabnya hampir
selalu kolom yang belum terisi di Supabase, bukan kesalahan di sisi web.

---

## 4. Memeriksa apakah model benar-benar terpakai

Jalankan di komputer Anda:

```bash
python -m training.cek_sistem
```

Bagian **5. Model AI** harus menunjukkan:

```
LULUS      Model klasifikasi status
LULUS      KRITIS terbaca AMAN: 0.xx persen
LULUS      Model ramalan LSTM
LULUS      Galat 3 jam pertama: xx.x mm
```

Untuk memastikan seluruh rantai berjalan, dari sensor sampai kalimat pesan:

```bash
python -m src.main --dry-run
```

Mode uji coba ini menjalankan semuanya tanpa menulis ke basis data dan tanpa
mengirim pesan ke siapa pun.

---

## 5. Bila Anda tetap ingin model berjalan di Vercel

Ada satu keadaan yang membenarkannya: bila Anda ingin petugas dapat menekan
tombol "hitung ulang sekarang" dan memperoleh jawaban seketika, tanpa menunggu
siklus 30 menit berikutnya.

Cara membuatnya:

1. Buat berkas `frontend/api/nilai.py`.
2. Muat hanya model klasifikasi, jangan model LSTM. TensorFlow terlalu besar
   untuk fungsi tanpa server; scikit-learn masih muat.
3. Tambahkan `frontend/requirements.txt` berisi `scikit-learn`, `joblib`,
   `numpy`, `pandas`.
4. Simpan kunci `service_role` sebagai Environment Variable di Vercel, dan
   jangan pernah memakai awalan `NEXT_PUBLIC_` untuk kunci itu.

Tiga hal yang perlu Anda sadari sebelum menempuh jalan ini:

- Waktu mulai fungsi akan terasa, sekitar dua sampai lima detik pada panggilan
  pertama, karena model dimuat ulang.
- Fitur `ramalan` tidak akan tersedia, karena LSTM tidak ikut.
- Anda kini punya dua tempat yang menjalankan penilaian. Bila suatu saat
  ambang batas diubah di satu tempat dan tidak di tempat lain, keduanya akan
  memberi jawaban berbeda untuk data yang sama. Itu jenis kekeliruan yang
  sangat sulit ditemukan.

Saran: jangan tempuh jalan ini kecuali petugas benar-benar memintanya. Siklus
30 menit sudah jauh lebih cepat daripada penumpukan endapan, yang berlangsung
dalam hitungan minggu.

---

## 6. Bila ada masalah

| Gejala | Penyebab yang paling sering |
|---|---|
| Dasbor kosong | Env var di Vercel belum diisi, atau tabel `status_ai` masih kosong |
| Status ada, ramalan tidak muncul | Model LSTM belum diunggah, atau data sensor kurang dari 18 jam |
| Angka tidak berubah berjam-jam | Alur GitHub Actions gagal. Periksa tab Actions |
| Peringatan "data sensor basi" | Sensor mati, baterai lemah, atau sinyal terputus |
| `Model klasifikasi belum ada` di log Actions | `models/` tidak ikut terunggah ke GitHub |
| Halaman verifikasi menolak menyimpan | Petugas belum masuk dengan akun yang berwenang |

Aturan umum: bila angka di Supabase benar tetapi halaman salah, masalahnya di
Vercel. Bila angka di Supabase sendiri sudah salah atau kosong, masalahnya di
pipeline atau di sensor, dan membuka Vercel tidak akan membantu.
