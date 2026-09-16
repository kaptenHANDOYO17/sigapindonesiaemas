# Situs SIGAP Drainase

Antarmuka publik sistem pemantauan drainase Kelurahan Mangunharjo. Dibangun
dengan Next.js 14 dan Supabase, dirancang untuk diterbitkan di Vercel pada
paket gratis.

---

## Halaman yang tersedia

| Alamat | Untuk siapa | Isi |
|---|---|---|
| `/` | umum | Dasbor kondisi saluran, penampang, grafik 48 jam, ramalan 12 jam |
| `/tentang` | umum | Cara kerja, hasil pengujian, dan keterbatasan sistem |
| `/daftar` | warga | Pendaftaran nomor penerima peringatan |
| `/lapor` | warga | Melaporkan sampah atau genangan, dengan lokasi dan foto |
| `/peta` | umum | Peta titik sensor beserta statusnya |
| `/berhenti` | warga | Berhenti menerima peringatan |
| `/masuk` | pengelola | Masuk dengan surel dan kata sandi |
| `/admin` | pengelola | Ringkasan, laporan warga, pendaftaran, verifikasi |
| `/simulasi` | pengelola | Menguji penilaian status dan jalur notifikasi |
| `/profil` | pengelola | Ubah nama, jabatan, foto profil, dan kata sandi |
| `/verifikasi` | pengelola | Pengisian hasil pemeriksaan lapangan |

Lima alamat di bawah `/api` bekerja di sisi server dan tidak dibuka langsung
oleh pengguna: `daftar`, `berhenti`, `lapor`, `simulasi`, dan `telegram`.

Halaman `/admin`, `/simulasi`, dan `/verifikasi` memeriksa sesi pengguna
terhadap tabel `profil_admin`. Menyembunyikan tombol di peramban bukan
pengamanan, sehingga pemeriksaan yang sesungguhnya dilakukan oleh policy di
basis data dan oleh Route Handler di server.

---

## Cara kerja pendaftaran nomor

Ini bagian yang paling perlu dipahami sebelum dipasang.

**Formulir di situs terbuka untuk umum.** Siapa pun dapat mengetikkan nomor
orang lain, dan orang itu akan menerima peringatan yang tidak pernah ia minta.
Karena itu pendaftaran lewat situs **tidak langsung aktif**. Nomor disimpan
dengan `aktif = false`, dan baru diaktifkan setelah kader atau pengelola
memastikannya melalui halaman `/admin`.

**Pendaftaran lewat Telegram langsung aktif**, karena di sana wargalah yang
memulai percakapan, sehingga persetujuannya sudah jelas dengan sendirinya.

Agen notifikasi hanya mengirim ke kontak dengan `aktif = true`. Dengan begitu,
nomor yang belum dikonfirmasi tidak akan menerima apa pun.

```
Warga isi formulir  →  tersimpan, aktif = false
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   Kader konfirmasi di /admin      Warga buka bot Telegram
              │                               │
              └───────────────┬───────────────┘
                              ▼
                        aktif = true
                              ▼
            menerima peringatan saat status Waspada ke atas
```

---

## Menyiapkan basis data

Jalankan empat berkas ini di Supabase, menu **SQL Editor**, berurutan:

1. `database/schema.sql` — lima tabel pokok
2. `database/migrasi_pendaftaran.sql` — kolom untuk pendaftaran lewat situs
3. `database/migrasi_admin_laporan.sql` — tabel pengelola dan laporan warga
4. `database/migrasi_profil_konfirmasi.sql` — foto profil dan kode konfirmasi nomor
5. `database/migrasi_peta_media.sql` — titik sensor, peta, dan media laporan
6. `database/akun_pengelola.sql` — membuat akun pengelola pertama
7. `database/data_contoh.sql` — mengisi seluruh tabel dengan data peragaan (opsional)

Ketiga yang pertama aman dijalankan berulang kali. Berkas keempat memuat kata
sandi awal; **ganti kata sandinya lebih dulu**, dan ganti lagi melalui menu
Authentication setelah berhasil masuk.

---

## Kunci yang dibutuhkan

Ambil dari Supabase, menu **Project Settings → API**.

| Nama | Jenis | Boleh dilihat umum |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | alamat proyek | ya |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | kunci `anon` | ya |
| `NEXT_PUBLIC_TELEGRAM_BOT` | nama bot tanpa `@` | ya |
| `SUPABASE_SERVICE_ROLE_KEY` | kunci `service_role` | **tidak** |
| `TELEGRAM_BOT_TOKEN` | token bot dari @BotFather | **tidak** |
| `TELEGRAM_ADMIN_CHAT_ID` | chat pengelola, untuk kabar laporan baru | **tidak** |
| `TELEGRAM_WEBHOOK_SECRET` | kata sandi acak untuk webhook | **tidak** |

Perhatikan bahwa dua nama terakhir **tidak** memakai awalan `NEXT_PUBLIC_`.
Awalan itu membuat Next.js menyisipkan nilainya ke dalam berkas yang diunduh
peramban. Bila `service_role` diberi awalan tersebut, seluruh nomor warga akan
terbuka bagi siapa pun yang membuka situs.

Buat `TELEGRAM_WEBHOOK_SECRET` sendiri:

```bash
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

`ADMIN_TOKEN` yang dipakai versi sebelumnya sudah tidak digunakan lagi.
Halaman pengelola kini memakai Supabase Auth, sehingga setiap orang punya
akun sendiri dan jejak tindakannya dapat ditelusuri.

---

## Menjalankan di komputer sendiri

```bash
cd frontend
cp .env.local.example .env.local     # lalu isi nilainya
npm install
npm run dev
```

Buka `http://localhost:3000`.

---

## Mengunggah ke GitHub

Dari folder induk proyek, bukan dari dalam `frontend`:

```bash
git init
git add .
git commit -m "SIGAP Drainase"
git branch -M main
git remote add origin https://github.com/NAMA_ANDA/sigap-drainase.git
git push -u origin main
```

Sebelum `git push`, pastikan tidak ada berkas rahasia yang ikut:

```bash
git status --porcelain | grep -E "\.env" || echo "aman, tidak ada berkas .env"
```

Berkas `.gitignore` sudah mencegah `.env` dan `.env.local` terunggah. Namun
periksa sendiri, karena kunci yang sudah pernah terunggah ke GitHub harus
dianggap bocor selamanya dan wajib diganti di Supabase.

---

## Menerbitkan di Vercel

1. Buka [vercel.com](https://vercel.com), pilih **Add New → Project**, lalu
   sambungkan ke repositori GitHub Anda.
2. Pada **Root Directory**, pilih `frontend`. Ini penting; bila dibiarkan di
   akar proyek, Vercel tidak akan menemukan `package.json`.
3. Framework Preset akan terdeteksi sendiri sebagai **Next.js**. Biarkan
   perintah build apa adanya.
4. Buka **Environment Variables**, masukkan kelima nilai pada tabel di atas.
   Centang ketiganya: Production, Preview, dan Development.
5. Tekan **Deploy**.

Setelah selesai, salin alamat yang diberikan Vercel, lalu masukkan ke GitHub
Variables sebagai `SITUS_URL`, agar tautan dasbor pada pesan peringatan
mengarah ke alamat yang benar.

Setiap kali Anda `git push` ke cabang `main`, Vercel menerbitkan ulang secara
otomatis.

---

## Memeriksa setelah terbit

Periksa berurutan, karena bila yang pertama gagal, sisanya pasti ikut gagal.

1. Buka halaman utama. Bila muncul pesan bahwa `.env.local` belum diisi,
   berarti Environment Variables di Vercel belum tersimpan atau situs belum
   diterbitkan ulang setelah diisi.
2. Buka `/daftar`, coba daftarkan nomor Anda sendiri. Harus muncul keterangan
   bahwa pendaftaran menunggu konfirmasi.
3. Buka `/admin`, masukkan `ADMIN_TOKEN`. Nomor tadi harus muncul di daftar.
4. Tekan **Aktifkan**. Periksa di Supabase, tabel `kontak_stakeholder`, kolom
   `aktif` harus berubah menjadi `true`.
5. Buka `/berhenti`, masukkan nomor yang sama. Kolom `aktif` harus kembali
   menjadi `false`.

Bila langkah 2 gagal dengan pesan "Server belum dikonfigurasi", berarti
`SUPABASE_SERVICE_ROLE_KEY` belum terisi di Vercel.

---

## Yang perlu disadari

**Halaman simulasi dapat mengirim pesan sungguhan.** Karena itu ia tertutup
bagi umum, dan setiap pesan yang dikirimnya diawali penanda besar bahwa itu
uji coba. Penanda tersebut ditambahkan di sisi server dan tidak dapat
dimatikan dari antarmuka. Sebelum mengirim ke seluruh warga, beri tahu
pengurus RT lebih dulu, dan jangan lakukan pada malam hari.

**Dasbor menampilkan data contoh bila basis data masih kosong.** Setiap kali
itu terjadi, halaman menampilkan spanduk kuning yang menyatakannya dengan
jelas. Begitu satu baris data sungguhan masuk, spanduk hilang dan angka
contoh berhenti dipakai.

**Pembatasan laju pendaftaran bersifat sementara.** Ia hanya berlaku selama
satu proses server berjalan. Di Vercel, proses dapat berganti kapan saja,
sehingga pembatasan ini menahan penyalahgunaan ringan, bukan serangan yang
sungguh-sungguh. Bila situs mulai ramai, tambahkan layanan pembatas laju yang
berdiri sendiri.

**Model tidak berjalan di situs ini.** Penilaian status dikerjakan GitHub
Actions setiap 30 menit, lalu hasilnya ditulis ke Supabase. Situs hanya
membaca angka yang sudah jadi. Alasannya dibahas pada
`docs/PANDUAN_MODEL_DI_VERCEL.md`.

**Nomor warga tidak pernah menyentuh peramban.** Tabel `kontak_stakeholder`
tidak memiliki policy apa pun untuk kunci `anon`, sehingga tidak dapat dibaca
dari sisi pengguna. Seluruh pendaftaran berjalan lewat Route Handler di
server. Pada halaman `/admin` pun nomor ditampilkan sebagian saja.
