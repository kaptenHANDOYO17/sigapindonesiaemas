# Memperbarui Proyek yang Sudah Terlanjur Di-deploy

Anda sudah pernah mengunggah proyek ini ke GitHub dan menerbitkannya di
Vercel. Sekarang ada versi baru. **Tidak perlu mengulang dari nol.** Cukup
ganti berkasnya, lalu dorong lagi ke GitHub. Vercel akan menerbitkan ulang
dengan sendirinya.

Seluruh proses sekitar dua puluh menit.

---

## Jawaban singkat

| Pertanyaan Anda | Jawaban |
|---|---|
| Boleh ganti berkas saja? | Boleh, asal satu folder tersembunyi tidak ikut terhapus |
| Perlu buat repositori GitHub baru? | Tidak |
| Perlu hubungkan ulang Vercel? | Tidak |
| Ada yang tidak cukup dengan ganti berkas? | Ada dua: perintah SQL di Supabase, dan Environment Variables di Vercel |

Dua hal terakhir itu yang paling sering terlewat. Keduanya dibahas pada
Langkah 4 dan Langkah 5.

---

## Yang TIDAK BOLEH terhapus

Di dalam folder proyek Anda ada folder bernama **`.git`**. Namanya diawali
titik, sehingga biasanya tersembunyi di Windows.

**Folder itulah yang mengingat bahwa proyek Anda terhubung ke GitHub.** Kalau
ikut terhapus, Anda memang harus mengulang dari awal.

Selain `.git`, jangan hapus juga:

| Berkas atau folder | Alasan |
|---|---|
| `.git` | Penghubung ke GitHub. **Paling penting.** |
| `.env` | Berisi kunci Supabase dan token bot Anda |
| `frontend/.env.local` | Berisi kunci untuk menjalankan situs di komputer sendiri |

Adapun `node_modules` dan `frontend/.next` boleh terhapus. Keduanya dibuat
ulang otomatis, dan memang tidak pernah ikut terunggah ke GitHub.

### Menampilkan folder tersembunyi di Windows

1. Buka folder proyek Anda di **File Explorer**.
2. Klik menu **View** di bagian atas.
3. Pilih **Show**, lalu centang **Hidden items**.

Sekarang folder `.git` akan terlihat, berwarna agak pudar.

---

## Langkah 1 — Cadangkan dulu

Sebelum mengubah apa pun. Ini murah dan menyelamatkan Anda bila ada yang
keliru.

1. Buka folder yang memuat proyek Anda.
2. Klik kanan folder proyek, pilih **Copy**.
3. Klik kanan di ruang kosong, pilih **Paste**.
4. Ganti nama salinannya menjadi misalnya `sigap-drainase-cadangan`.

---

## Langkah 2 — Pastikan masih terhubung ke GitHub

1. Buka folder proyek Anda.
2. Klik kanan di ruang kosong di dalam folder, pilih **Open in Terminal**.
   Bila tidak ada pilihan itu, buka **PowerShell**, lalu ketik `cd` diikuti
   spasi, lalu seret folder proyek ke jendela PowerShell, lalu Enter.
3. Ketik dan Enter:

```
git remote -v
```

Yang muncul harus seperti:

```
origin  https://github.com/namaanda/sigap-drainase.git (fetch)
origin  https://github.com/namaanda/sigap-drainase.git (push)
```

Bila yang muncul kosong atau tertulis `not a git repository`, berarti folder
`.git` sudah hilang. Dalam hal itu, lompat ke bagian **Bila folder .git
hilang** di bagian bawah panduan ini.

---

## Langkah 3 — Ganti berkasnya

1. Buka berkas **`sigap-drainase.zip`** yang baru, lalu ekstrak ke mana saja,
   misalnya ke Desktop. Akan muncul folder bernama `sigap-drainase`.
2. Buka folder hasil ekstrak itu. **Pilih semua isinya** dengan `Ctrl + A`,
   lalu salin dengan `Ctrl + C`.
3. Buka folder proyek lama Anda, tempel dengan `Ctrl + V`.
4. Windows bertanya karena ada berkas yang sama. Pilih
   **Replace the files in the destination**.

Folder `.git`, `.env`, dan `.env.local` milik Anda tetap aman, karena berkas
baru tidak memuat ketiganya.

### Memastikan berkas baru benar-benar masuk

Di dalam folder proyek, periksa apakah berkas-berkas berikut sudah ada:

```
database/migrasi_admin_laporan.sql
database/migrasi_profil_konfirmasi.sql
database/data_contoh.sql
docs/PANDUAN_BOT_PEMULA.md
frontend/app/profil/
frontend/app/simulasi/
frontend/app/api/telegram/
```

Bila salah satu tidak ada, berarti penempelan belum selesai. Ulangi Langkah 3.

---

## Langkah 4 — Jalankan perintah SQL di Supabase

**Bagian ini tidak bisa dilewati.** Versi baru memakai tabel dan kolom yang
belum ada di basis data Anda. Bila dilewati, situs akan terbit tetapi halaman
pengelola dan pendaftaran akan galat.

1. Buka **[supabase.com](https://supabase.com)**, masuk, pilih proyek Anda.
2. Di menu sebelah kiri, klik ikon **SQL Editor** (bentuknya seperti lembar
   dengan tulisan SQL).
3. Klik tombol **New query** di kanan atas.
4. Buka berkas SQL di komputer Anda dengan Notepad, salin **seluruh isinya**,
   tempel ke kotak SQL Editor, lalu klik **Run** di kanan bawah.
5. Ulangi untuk setiap berkas, **berurutan sesuai tabel di bawah**.

| Urutan | Berkas | Isinya |
|---|---|---|
| 1 | `database/migrasi_pendaftaran.sql` | Kolom untuk pendaftaran lewat situs |
| 2 | `database/migrasi_admin_laporan.sql` | Tabel pengelola dan laporan warga |
| 3 | `database/migrasi_profil_konfirmasi.sql` | Foto profil dan kode konfirmasi nomor |
| 4 | `database/akun_pengelola.sql` | Membuat akun pengelola pertama |
| 5 | `database/data_contoh.sql` | Mengisi semua tabel dengan data peragaan (opsional) |

Setelah setiap perintah, di bawah kotak harus muncul tulisan **Success**.
Bila muncul tulisan merah, bacalah pesannya; biasanya karena urutannya
tertukar.

> **Sebelum menjalankan berkas nomor 4**, buka berkasnya di Notepad dan ganti
> kata sandi pada baris yang bertanda `v_sandi`. Jangan pakai kata sandi
> bawaan.

> **Berkas nomor 5 hanya untuk peragaan.** Isinya data buatan agar tampilan
> tidak kosong saat dinilai juri. Hapus sebelum sistem dipakai warga
> sungguhan; perintah penghapusannya ada di bagian bawah berkas itu.

Anda tidak perlu menjalankan `schema.sql` lagi, karena sudah pernah dijalankan
saat pertama kali.

---

## Langkah 5 — Tambahkan Environment Variables baru di Vercel

Versi baru memerlukan beberapa nilai yang belum ada sebelumnya.

1. Buka **[vercel.com](https://vercel.com)**, masuk, klik proyek Anda.
2. Klik tab **Settings** di menu atas.
3. Klik **Environment Variables** di daftar sebelah kiri.
4. Untuk setiap baris di tabel bawah: isi kolom **Key**, isi kolom **Value**,
   centang **Production**, **Preview**, dan **Development**, lalu tekan
   **Save**.

| Key | Value | Dari mana |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | kunci `service_role` | Supabase → Project Settings → API |
| `TELEGRAM_BOT_TOKEN` | token bot | @BotFather di Telegram |
| `TELEGRAM_ADMIN_CHAT_ID` | angka ID Anda | @userinfobot di Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | kata sandi acak buatan sendiri | Anda karang, minimal 20 karakter |
| `NEXT_PUBLIC_WA_PENGELOLA` | nomor WhatsApp pengelola, format `62812...` | Nomor Anda sendiri |

Langkah rincinya, termasuk cara mendapatkan token bot, ada di
`docs/PANDUAN_BOT_PEMULA.md`.

### Yang perlu dihapus

Bila di daftar Anda masih ada **`ADMIN_TOKEN`**, hapus saja. Versi baru tidak
memakainya lagi; halaman pengelola sekarang memakai akun dan kata sandi
sendiri-sendiri.

Caranya: klik titik tiga di sebelah kanan barisnya, pilih **Remove**.

---

## Langkah 6 — Dorong ke GitHub

Kembali ke PowerShell yang tadi sudah berada di folder proyek. Ketik tiga
perintah berikut, satu per satu, tekan Enter setelah masing-masing.

```
git add .
```

```
git commit -m "Perbarui ke versi dengan halaman pengelola, simulasi, dan bot"
```

```
git push
```

Bila diminta nama pengguna dan kata sandi, isikan nama pengguna GitHub Anda,
dan untuk kata sandi gunakan **Personal Access Token**, bukan kata sandi akun.
Cara membuatnya ada di bagian bawah panduan ini.

### Memastikan berkas rahasia tidak ikut terunggah

Sebelum `git push`, jalankan pemeriksaan ini:

```
git status --porcelain | Select-String ".env"
```

Bila tidak muncul apa-apa, aman. Bila muncul nama berkas `.env`, **jangan
lanjutkan**. Ketik dulu:

```
git rm --cached .env frontend/.env.local
```

lalu ulangi `git add .`, `git commit`, dan `git push`.

> Kunci yang sudah pernah terunggah ke GitHub harus dianggap bocor selamanya,
> dan wajib diganti di Supabase. Lebih baik memeriksa dua puluh detik daripada
> mengganti semua kunci.

---

## Langkah 7 — Tunggu Vercel menerbitkan ulang

Vercel memantau GitHub Anda. Begitu `git push` selesai, ia mulai bekerja
sendiri.

1. Buka Vercel, klik proyek Anda, klik tab **Deployments**.
2. Baris paling atas akan bertuliskan **Building**.
3. Tunggu satu sampai tiga menit sampai berubah menjadi **Ready** berwarna
   hijau.

Bila berubah menjadi **Error** berwarna merah, klik barisnya untuk membaca
catatannya. Penyebab paling sering: **Root Directory** belum diatur ke
`frontend`. Perbaikannya ada di bagian bawah panduan ini.

### Penting setelah menambah Environment Variables

Bila Anda menambahkan Environment Variables **setelah** penerbitan terakhir,
nilainya belum terbaca. Terbitkan ulang secara manual:

1. Tab **Deployments**, baris paling atas.
2. Klik titik tiga di kanan, pilih **Redeploy**.
3. Tekan **Redeploy** lagi pada kotak yang muncul.

---

## Langkah 8 — Periksa hasilnya

Buka alamat situs Anda, lalu periksa berurutan.

| Yang diperiksa | Yang seharusnya terjadi |
|---|---|
| Halaman utama | Muncul dasbor. Bila belum ada data sensor, muncul spanduk kuning bertuliskan mode peragaan |
| Menu atas | Ada tautan Dasbor, Daftar Peringatan, Lapor, Tentang Sistem, dan Masuk Pengelola |
| `/tentang` | Terbuka, berisi cara kerja dan hasil pengujian |
| `/daftar` | Formulir pendaftaran nomor terbuka |
| `/lapor` | Formulir laporan warga terbuka |
| `/masuk` | Bisa masuk dengan akun dari `akun_pengelola.sql` |
| Setelah masuk | Di pojok kanan atas muncul ikon berisi huruf awal nama Anda |
| Ikon diklik | Muncul menu: Dasbor Pengelola, Simulasi, Isi Verifikasi, Ubah Profil, Keluar |
| `/simulasi` | Ada tiga pengatur geser yang mengubah status saat digeser |

Bila pada `/masuk` muncul tulisan "akun belum terdaftar sebagai pengelola",
berarti Langkah 4 nomor 4 belum dijalankan, atau UID-nya belum dimasukkan ke
tabel `profil_admin`.

---

## Langkah 9 — Pasang ulang webhook bot (bila bot baru pertama kali dipakai)

Lewati bila bot Anda sudah berjalan sebelumnya dan alamat situsnya tidak
berubah.

Buka tautan berikut di peramban, ganti tiga bagian bertanda:

```
https://api.telegram.org/botTOKEN_ANDA/setWebhook?url=https://ALAMAT_SITUS_ANDA/api/telegram&secret_token=KATA_SANDI_ANDA
```

Jawaban yang benar: `{"ok":true,...,"Webhook was set"}`.

Rincinya ada di `docs/PANDUAN_BOT_PEMULA.md` Langkah 5.

---

## Bila ada masalah

### Vercel gagal: "No Next.js version detected"

Root Directory belum diatur.

1. Vercel → proyek Anda → **Settings** → **General**.
2. Cari **Root Directory**, klik **Edit**.
3. Isi dengan `frontend`, tekan **Save**.
4. Terbitkan ulang lewat tab **Deployments**.

### `git push` ditolak: "Updates were rejected"

Ada perubahan di GitHub yang belum ada di komputer Anda. Ketik:

```
git pull --rebase
git push
```

### Diminta kata sandi terus saat `git push`

GitHub tidak lagi menerima kata sandi akun. Anda perlu Personal Access Token.

1. Buka **github.com**, klik foto profil Anda di pojok kanan atas.
2. **Settings** → gulir ke bawah → **Developer settings**.
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token
   (classic)**.
4. Isi **Note** bebas, pilih **Expiration** 90 hari, centang kotak **repo**.
5. Tekan **Generate token**, lalu **salin token yang muncul**. Token ini
   hanya ditampilkan sekali.
6. Saat `git push` meminta kata sandi, tempelkan token itu.

### Situs terbit tetapi halaman pengelola galat

Hampir selalu karena Langkah 4 belum lengkap. Buka Supabase → **Table
Editor**, dan pastikan tabel berikut ada:

```
profil_admin
laporan_warga
log_pendaftaran
```

Bila salah satu tidak ada, jalankan ulang berkas SQL yang bersangkutan.

### Folder `.git` hilang

Masih bisa diselamatkan, hanya butuh beberapa langkah tambahan.

1. Buka PowerShell di folder proyek.
2. Ketik berurutan:

```
git init
git branch -M main
git remote add origin https://github.com/NAMA_ANDA/NAMA_REPO.git
git add .
git commit -m "Perbarui ke versi baru"
git push -u origin main --force
```

Ganti `NAMA_ANDA` dan `NAMA_REPO` sesuai alamat repositori Anda. Alamatnya
bisa dilihat di halaman repositori GitHub, pada tombol hijau **Code**.

> Kata `--force` menimpa isi repositori dengan isi folder Anda. Pastikan dulu
> folder Anda memang sudah berisi versi terbaru yang lengkap, karena apa pun
> yang ada di GitHub akan digantikan.

---

## Ringkasan untuk ditempel di meja

```
1. Cadangkan folder lama
2. git remote -v            → pastikan masih terhubung
3. Ekstrak zip → salin semua → tempel → Replace
4. Supabase SQL Editor      → jalankan 4 berkas SQL berurutan
5. Vercel Settings          → tambah 5 Environment Variables, hapus ADMIN_TOKEN
6. git add . → git commit -m "..." → git push
7. Vercel Deployments       → tunggu Ready
8. Buka situs, periksa /masuk dan /simulasi
```
