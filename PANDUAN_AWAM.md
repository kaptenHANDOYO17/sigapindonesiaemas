# Panduan untuk Pemula

Ditulis dengan anggapan Anda belum pernah memakai GitHub, Supabase, maupun
Python. Ikuti berurutan. Seluruh proses memakan waktu sekitar tiga jam,
belum termasuk pemasangan sensor di lapangan.

---

## 1. Yang perlu disiapkan lebih dulu

| Kebutuhan | Biaya | Keterangan |
|---|---|---|
| Akun GitHub | gratis | github.com |
| Akun Supabase | gratis | supabase.com |
| Akun Vercel | gratis | vercel.com |
| Bot Telegram | gratis | lewat @BotFather |
| Python 3.11 | gratis | python.org, centang "Add to PATH" |
| Node.js 20 | gratis | nodejs.org |
| VEGAPULS Air 23 + langganan VIS | berbayar | lihat RAB |
| ESP32 + sensor debit + modul pH | berbayar | lihat RAB |

---

## 2. Menyiapkan database

1. Buka supabase.com, buat proyek baru. Pilih wilayah **Southeast Asia (Singapore)**.
2. Simpan kata sandi database yang Anda buat.
3. Setelah proyek jadi, buka menu **SQL Editor** di kiri.
4. Klik **New query**.
5. Buka berkas `database/schema.sql`, salin **seluruh isinya**, tempel, klik **Run**.
6. Buka menu **Table Editor**. Harus muncul lima tabel: `sensor_drainase`,
   `status_ai`, `kontak_stakeholder`, `log_notifikasi`, `verifikasi_lapangan`.

Lalu ambil kuncinya:

7. Buka **Project Settings → API**.
8. Salin **Project URL**, **anon public**, dan **service_role**.

> `service_role` bisa membaca dan mengubah seluruh isi database. Jangan pernah
> menaruhnya di halaman web atau mengunggahnya ke GitHub.

---

## 3. Membuat bot Telegram

1. Buka Telegram, cari **@BotFather**.
2. Ketik `/newbot`, ikuti pertanyaannya. Nama pengguna bot harus berakhiran `bot`.
3. BotFather memberi token panjang. Simpan.
4. Cari **@userinfobot**, kirim pesan apa saja. Ia membalas dengan angka ID Anda. Simpan.

---

## 4. Mengisi konfigurasi

Di folder proyek:

```
Windows PowerShell : Copy-Item .env.example .env
Linux / macOS      : cp .env.example .env
```

Buka `.env` dengan Notepad, isi:

- `SUPABASE_URL` dan `SUPABASE_KEY` (pakai **service_role**)
- `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_ADMIN_CHAT_ID`
- Biarkan bagian VEGA dan WhatsApp kosong dulu.

**Bagian geometri saluran wajib diukur langsung.** Baca `docs/KALIBRASI.md`
bagian 1. Selama angka ini masih nilai contoh, seluruh persentase yang
ditampilkan sistem adalah angka yang salah.

---

## 5. Melatih model

```bash
pip install -r requirements-train.txt

python -m training.generate_dataset --hari 365
python -m training.train_anomaly --sumber sintetis
python -m training.train_forecast --sumber sintetis --epoch 60
```

Pelatihan LSTM memakan waktu 20 sampai 90 menit tergantung kartu grafis. Bila
GPU tidak terdeteksi, baca `docs/PANDUAN_GPU.md`.

Lalu periksa hasilnya:

```bash
python -m training.evaluate
```

Perhatikan baris **"Kondisi KRITIS yang terbaca AMAN"**. Angka itu harus kecil.
Perhatikan juga apakah sistem cenderung berlebih waspada, bukan meremehkan.

---

## 6. Memeriksa keseluruhan

```bash
python -m training.cek_sistem
```

Perbaiki semua yang bertanda **GAGAL**. Yang bertanda **PERHATIAN** boleh
ditunda, tetapi bacalah keterangannya.

Lalu uji satu siklus penuh tanpa mengirim apa pun:

```bash
python -m src.main --dry-run
```

---

## 7. Mengunggah ke GitHub

1. Buat repositori baru di github.com. Boleh publik.
2. Unggah seluruh isi folder. **Pastikan berkas `.env` tidak ikut** — sudah
   dicegah oleh `.gitignore`, tetapi periksa sendiri.
3. Buka **Settings → Secrets and variables → Actions**.
4. Tab **Secrets**, tambahkan: `SUPABASE_URL`, `SUPABASE_KEY`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, dan bila sudah ada,
   `VEGA_API_TOKEN` serta `VEGA_DEVICE_ID`.
5. Tab **Variables**, tambahkan seluruh angka geometri dan ambang:
   `SALURAN_ID`, `SALURAN_NAMA`, `SALURAN_LAT`, `SALURAN_LON`,
   `TINGGI_PASANG_MM`, `LEBAR_SALURAN_MM`, `KEDALAMAN_SALURAN_MM`,
   `PANJANG_SEGMEN_M`, `DEBIT_RANCANGAN_LPM`, seluruh `AMBANG_*`, dan `SITUS_URL`.

Sistem mulai berjalan otomatis setiap 30 menit. Untuk mencoba segera, buka tab
**Actions**, pilih alur **SIGAP Drainase**, klik **Run workflow**.

---

## 8. Menerbitkan dasbor

1. Buka vercel.com, klik **Add New → Project**, sambungkan ke repositori Anda.
2. Pada **Root Directory**, pilih folder `frontend`.
3. Pada **Environment Variables**, isi:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pakai **anon**, bukan service_role)
   - `NEXT_PUBLIC_TELEGRAM_BOT` (nama pengguna bot tanpa tanda @)
4. Klik **Deploy**.
5. Salin alamat hasilnya, masukkan ke GitHub Variables sebagai `SITUS_URL`.

---

## 9. Memasang perangkat di lapangan

1. **VEGAPULS Air 23** dipasang di atas saluran, menghadap lurus ke bawah,
   pada posisi yang tidak terhalang. Ikuti petunjuk pabrik. Daftarkan
   perangkat di VEGA Inventory System, ambil token API dan ID perangkat,
   lalu masukkan ke GitHub Secrets.
2. **ESP32** dirakit sesuai `firmware/README.md`. Ubah bagian atas berkas
   `esp32_drainase.ino`, unggah lewat Arduino IDE.
3. Ukur geometri saluran, perbarui GitHub Variables.

---

## 10. Mengajak warga dan petugas

- Warga mendaftar lewat `https://t.me/NAMA_BOT?start=warga`
- Petugas BPBD mendaftar lewat `https://t.me/NAMA_BOT?start=bpbd`

Kedua tautan itu berbeda, dan perbedaannya menentukan jenis pesan yang mereka
terima. Warga menerima peringatan sederhana beserta langkah persiapan; petugas
menerima laporan teknis lengkap dengan titik lokasi dan saran penanganan.

---

## Bila ada masalah

| Gejala | Kemungkinan penyebab |
|---|---|
| Alur GitHub Actions merah | Secrets belum lengkap. Baca lognya. |
| Dasbor kosong | `.env.local` di Vercel belum diisi, atau belum ada data sensor. |
| Bot diam saja | Token salah, atau alur belum pernah berjalan. |
| Semua persentase aneh | Geometri saluran belum diukur. |
| Peringatan terus-menerus | Ambang terlalu ketat. Baca `docs/KALIBRASI.md`. |

Jalankan `python -m training.cek_sistem` lebih dulu. Biasanya penyebabnya
langsung terlihat di situ.
