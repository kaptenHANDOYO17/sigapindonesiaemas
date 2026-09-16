# Panduan Fitur Baru: Peta Sensor, Unggah Media, dan Bot Lengkap

Panduan ini menuntun dari mengganti berkas sampai semua fitur baru berjalan.
Tidak ada pelatihan model sama sekali; model yang lama tetap dipakai.

---

## PERTAMA: cabut kunci Groq Anda

Kunci Groq Anda sudah tertulis dalam percakapan ini, jadi anggap ia bocor.

1. Buka **[console.groq.com](https://console.groq.com)** → **API Keys**.
2. Hapus kunci yang lama.
3. Tekan **Create API Key**, salin yang baru.

Pakai kunci baru itu pada Langkah 4. Satu menit, dan mencegah orang lain
memakai kuota Anda.

---

## Apa saja yang baru

| Bagian | Isi |
|---|---|
| Bot Telegram | Perintah `/riwayat`, `/lokasi`, `/dashboard`, dan obrolan santai |
| Halaman `/peta` | Peta titik sensor beserta statusnya, terbuka untuk umum |
| Halaman `/lapor` | Tombol bagikan lokasi, serta unggah foto atau video |
| Halaman `/admin` | Tab baru **Titik Sensor**, dengan tambah, ubah, dan hapus |

---

# Langkah 1 — Ganti berkas

1. Ekstrak `sigap-drainase.zip` yang baru ke Desktop.
2. Buka folder hasil ekstrak, tekan **Ctrl + A** lalu **Ctrl + C**.
3. Buka folder proyek lama Anda, tekan **Ctrl + V**.
4. Pilih **Replace the files in the destination**.

Folder `.git` dan berkas `.env` Anda tidak ikut tertimpa, karena zip ini
memang tidak memuat keduanya.

---

# Langkah 2 — Jalankan SQL baru di Supabase

**Bagian ini tidak bisa dilewati.** Peta dan unggah media memerlukan tabel
serta kolom yang belum ada di basis data Anda.

1. Buka **[supabase.com](https://supabase.com)** → proyek Anda.
2. Menu kiri, klik **SQL Editor** → **New query**.
3. Buka berkas **`database/migrasi_peta_media.sql`** dengan Notepad.
4. Salin seluruh isinya, tempel, tekan **Run**.

Harus muncul **Success**. Berkas ini aman dijalankan berulang kali.

### Apa yang dibuatnya

| Yang dibuat | Kegunaan |
|---|---|
| Tabel `titik_sensor` | Menyimpan letak dan ukuran setiap titik |
| 3 titik awal di Meteseh | MTS-01, MTS-02, MTS-03 |
| Kolom `lat`, `lon`, `media_url` pada laporan | Menyimpan lokasi dan foto/video |
| Bucket `laporan` | Tempat menyimpan foto dan video, batas 15 MB |
| View `peta_sensor` | Menggabungkan titik dengan status terkininya |

### Memeriksa hasilnya

Di SQL Editor, jalankan:

```sql
select kode, nama, lat, lon, terpasang from titik_sensor order by kode;
```

Harus muncul tiga baris MTS-01 sampai MTS-03.

> **Koordinat ketiga titik itu masih perkiraan dari peta, bukan hasil
> pengukuran di lapangan.** Perbaiki lewat halaman admin setelah survei,
> karena tautan peta dan arahan petugas bergantung padanya.

---

# Langkah 3 — Unggah ke GitHub

Klik kanan di folder proyek → **Open in Terminal**, lalu ketik berurutan:

```
git status --porcelain | Select-String ".env"
```

Harus kosong. Bila muncul nama berkas `.env`, ketik dulu
`git rm --cached .env` sebelum melanjutkan.

```
git add .
git commit -m "Tambah peta sensor, unggah media laporan, dan perintah bot baru"
git push
```

---

# Langkah 4 — Isi Environment Variables di Vercel

Buka **[vercel.com](https://vercel.com)** → proyek Anda → **Settings** →
**Environment Variables**.

## Yang baru

| Key | Value | Wajib |
|---|---|---|
| `GROQ_API_KEY` | kunci **baru** dari console.groq.com | untuk obrolan bot |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | tidak, ini bawaannya |
| `NEXT_PUBLIC_SITUS_URL` | `https://sigapindonesiaemas.vercel.app` | untuk `/dashboard` di bot |

Untuk setiap baris, centang **Production**, **Preview**, dan **Development**.

## Yang harus sudah ada dari sebelumnya

| Key | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | alamat proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | kunci anon |
| `SUPABASE_SERVICE_ROLE_KEY` atau `SUPABASE_KEY` | kunci service_role |
| `TELEGRAM_BOT_TOKEN` | token bot |
| `TELEGRAM_WEBHOOK_SECRET` | kata sandi webhook |
| `TELEGRAM_ADMIN_CHAT_ID` | chat ID Anda |
| `NEXT_PUBLIC_TELEGRAM_BOT` | `aisigap_bot` |

### Catatan tentang Groq dan xAI

Bot akan memakai **Groq** bila `GROQ_API_KEY` terisi. Bila kosong, ia mencoba
`XAI_API_KEY`. Bila keduanya kosong, bot tetap berjalan normal dan hanya
menjawab dengan daftar perintah biasa ketika menerima pesan bebas.

Groq didahulukan karena gratis pada tingkat pemakaian wajar. Akun xAI Anda
masih bersaldo nol, jadi memang belum bisa dipakai.

---

# Langkah 5 — Terbitkan ulang

**Jangan dilewati.** Environment Variables hanya terbaca pada penerbitan
berikutnya.

1. Tab **Deployments**.
2. Baris teratas → titik tiga **⋯** → **Redeploy** → **Redeploy**.
3. Tunggu sampai **Ready** berwarna hijau.

---

# Langkah 6 — Pasang menu perintah bot

Agar warga melihat daftar perintah saat mengetik garis miring.

1. Buka Telegram, cari **@BotFather**.
2. Kirim **`/setcommands`**.
3. Pilih **aisigap_bot**.
4. Salin seluruh teks di bawah ini, tempel, lalu kirim:

```
status - Kondisi saluran terkini
prediksi - Ramalan muka air 12 jam
riwayat - Kejadian 7 hari terakhir
lapor - Laporkan sampah atau genangan
mitigasi - Langkah pencegahan genangan
lokasi - Titik sensor dan ukuran saluran
daftar - Mulai terima peringatan
berhenti - Berhenti terima peringatan
bantuan - Daftar perintah
dashboard - Website Sigap
```

Teks yang sama juga tersimpan di `bot/botfather_commands.txt`.

---

# Langkah 7 — Periksa satu per satu

## Bot

Kirim ke @aisigap_bot, satu per satu:

| Yang dikirim | Yang seharusnya muncul |
|---|---|
| `/riwayat` | Daftar tujuh hari terakhir, status terparah tiap harinya |
| `/lokasi` | Tiga titik MTS beserta tautan peta dan ukuran salurannya |
| `/dashboard` | Empat tautan situs |
| `halo, saluran gimana?` | Balasan santai memakai angka sungguhan |
| `gimana cara cegah jentik nyamuk?` | Saran kebersihan lingkungan |

Bila obrolan tidak jalan tetapi perintah lain jalan, berarti `GROQ_API_KEY`
belum terisi atau belum di-redeploy.

## Peta

1. Buka `https://sigapindonesiaemas.vercel.app/peta`
2. Harus muncul peta dengan tiga penanda abu-abu di sekitar Meteseh.
3. Klik penandanya, muncul keterangan titik.
4. Klik baris di tabel bawah, peta ikut memusat ke titik itu.

Penanda berwarna abu-abu karena alatnya memang belum terpasang. Setelah
dicentang **Alat sudah terpasang** di admin dan pembacaan pertamanya masuk,
warnanya mengikuti status.

## Laporan dengan lokasi dan foto

1. Buka `/lapor` **dari ponsel**, karena GPS ponsel jauh lebih teliti.
2. Isi keterangan, tekan **Bagikan lokasi saya**.
3. Peramban meminta izin lokasi, pilih **Izinkan**.
4. Tekan **Pilih foto atau video**, ambil foto.
5. Kirim.
6. Buka `/admin` → tab **Laporan Warga**. Laporan Anda muncul lengkap dengan
   tautan lokasi dan gambarnya.

## Titik sensor di admin

1. Buka `/admin` → tab **Titik Sensor**.
2. Tekan **Ubah** pada MTS-01, perbaiki koordinatnya, tekan **Simpan**.
3. Buka `/peta`, penandanya berpindah.

---

# Cara mendapatkan koordinat yang benar

Koordinat bawaan hanya perkiraan dari peta. Yang benar diambil di lokasi.

1. Berdirilah tepat di titik pemasangan.
2. Buka **Google Maps** di ponsel.
3. Tekan lama pada titik tempat Anda berdiri sampai muncul penanda merah.
4. Di bagian atas layar muncul dua angka, misalnya `-7.066215, 110.471803`.
5. Tekan angka itu untuk menyalinnya.
6. Buka `/admin` → **Titik Sensor** → **Ubah**, tempelkan angka pertama ke
   kolom **Lintang** dan angka kedua ke kolom **Bujur**.

Untuk wilayah Semarang, lintang selalu bernilai **negatif** sekitar -7, dan
bujur sekitar **110**. Bila angkanya jauh berbeda, Anda salah salin.

---

# Menambah titik sensor baru

1. `/admin` → tab **Titik Sensor** → **Tambah titik baru**.
2. Isi kode, misalnya `MTS-04`. Huruf besar, tanpa spasi.
3. Isi nama, alamat, dan koordinat.
4. Isi lima angka ukuran saluran, hasil pengukuran langsung:

| Kolom | Cara mengukur |
|---|---|
| Tinggi pasang | Dari muka sensor ke dasar saluran, saat saluran bersih |
| Kedalaman saluran | Dari dasar ke bibir atas saluran |
| Lebar dasar | Lebar dasar saluran |
| Panjang segmen | Panjang saluran yang diwakili satu sensor |
| Debit bersih | Aliran saat saluran bersih pada hujan sedang |

5. Centang **Tampilkan di peta**.
6. Biarkan **Alat sudah terpasang** kosong sampai alatnya benar-benar ada.
7. **Simpan**.
8. Isikan kode yang sama pada firmware ESP32 perangkat tersebut.

> **Kelima angka ukuran itu wajib hasil pengukuran, bukan tebakan.** Seluruh
> persentase yang ditampilkan sistem dihitung darinya. Bila angkanya salah,
> peringatannya ikut salah, dan warga akan kehilangan kepercayaan pada sistem
> yang sebenarnya berfungsi.

---

# Tentang obrolan bot

## Apa yang bisa ditanyakan warga

- Kondisi saluran sekarang, dengan bahasa bebas
- Cara memilah sampah rumah tangga
- Mengapa minyak jelantah tidak boleh dibuang ke saluran
- Mencegah jentik nyamuk demam berdarah setelah genangan surut
- Bahaya leptospirosis dari air genangan, dan perlunya sepatu bot
- Menjaga air minum tetap bersih setelah banjir
- Kerja bakti membersihkan saluran

## Pagar pengaman yang dipasang

Kondisi saluran diambil dulu dari basis data, lalu disisipkan ke arahan
model. Model tidak diminta menebak apa pun; ia hanya boleh menyampaikan ulang
angka yang sudah ada. Tanpa ini, model akan mengarang angka endapan ketika
ditanya, dan warga akan memercayainya.

Model juga dilarang:

- mengarang angka yang tidak ada di data
- membuat ramalan sendiri, harus mengarahkan ke `/prediksi`
- memutuskan apakah warga perlu mengungsi
- mendiagnosis penyakit atau menyebut nama obat
- menjanjikan kapan petugas datang

Untuk keluhan kesehatan, ia mengarahkan ke puskesmas. Untuk keadaan darurat,
ke nomor 112.

**Yang tetap tidak memakai model bahasa:** penilaian status saluran dan
kalimat peringatan otomatis. Keduanya memakai matriks aturan dan templat
tetap, supaya dapat diprediksi dan diaudit.

---

# Bila ada masalah

| Gejala | Penyebabnya |
|---|---|
| `/peta` kosong, tulisan "belum ada titik" | `migrasi_peta_media.sql` belum dijalankan |
| Peta tidak muncul sama sekali | Sambungan internet memblokir unpkg.com atau OpenStreetMap |
| `/lokasi` di bot menjawab "data belum diisi" | Sama, SQL belum dijalankan |
| Tombol bagikan lokasi tidak jalan | Peramban menolak izin, atau situs dibuka lewat http bukan https |
| Unggah foto gagal "Jenis berkas tidak didukung" | Pakai JPG, PNG, WEBP, MP4, MOV, atau WEBM |
| Unggah gagal "melebihi batas 15 MB" | Rekam video lebih pendek, atau kecilkan mutunya |
| Unggah gagal dengan pesan bucket | Bucket `laporan` belum ada, jalankan SQL-nya |
| Bot tidak bisa mengobrol | `GROQ_API_KEY` belum diisi, atau belum Redeploy |
| Titik sensor gagal disimpan | Koordinat di luar Indonesia, periksa tanda minusnya |

Untuk memeriksa keadaan bot secara menyeluruh, buka:

```
https://sigapindonesiaemas.vercel.app/api/telegram
```

Bacalah bagian **`saran`** di situ.

---

# Ringkasan untuk ditempel di meja

```
1.  console.groq.com → hapus kunci lama → buat kunci baru
2.  Ekstrak zip → Ctrl+A → Ctrl+C → tempel ke folder lama → Replace
3.  Supabase SQL Editor → jalankan migrasi_peta_media.sql
4.  git add . → git commit -m "..." → git push
5.  Vercel → tambah GROQ_API_KEY dan NEXT_PUBLIC_SITUS_URL
6.  Vercel → Deployments → Redeploy          ← jangan dilewati
7.  BotFather → /setcommands → tempel 10 perintah
8.  Coba /riwayat, /lokasi, /dashboard di bot
9.  Coba ngobrol bebas dengan bot
10. Buka /peta, harus ada 3 penanda
11. Buka /lapor dari ponsel, coba bagikan lokasi dan foto
12. /admin → Titik Sensor → perbaiki koordinat setelah survei
```
