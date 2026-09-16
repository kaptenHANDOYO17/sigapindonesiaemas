# Mengunggah Perubahan ke GitHub

Panduan langkah demi langkah untuk mengunggah versi baru ke GitHub, sehingga
Vercel menerbitkan ulang situs Anda dengan sendirinya.

Ditulis untuk Windows. Setiap langkah menyebutkan tombol apa yang ditekan.

---

## Apa yang sebenarnya terjadi

```
Folder di komputer Anda
        │  git add .        → pilih berkas mana yang ikut
        │  git commit       → beri nama pada perubahan
        │  git push         → kirim ke GitHub
        ▼
    GitHub
        │  (Vercel memantau sendiri)
        ▼
    Vercel menerbitkan ulang
```

Anda hanya mengetik tiga perintah. Sisanya berjalan sendiri.

---

## Langkah 1 — Ganti berkas lama dengan yang baru

1. Ekstrak `sigap-drainase.zip` yang baru ke mana saja, misalnya Desktop.
2. Buka folder hasil ekstrak, tekan **Ctrl + A** lalu **Ctrl + C**.
3. Buka folder proyek lama Anda, tekan **Ctrl + V**.
4. Windows bertanya karena ada berkas yang sama. Pilih
   **Replace the files in the destination**.

### Yang tidak boleh terhapus

Di dalam folder proyek ada folder tersembunyi **`.git`**. Folder itulah yang
mengingat bahwa proyek Anda terhubung ke GitHub.

Berkas baru tidak memuat `.git`, jadi ia aman dengan sendirinya. Yang penting
**jangan menghapus isi folder lama** sebelum menempel. Cukup timpa saja.

Untuk melihatnya: File Explorer → menu **View** → **Show** → centang
**Hidden items**.

---

## Langkah 2 — Buka Terminal di folder proyek

1. Buka folder proyek Anda di File Explorer.
2. Klik kanan di ruang kosong di dalam folder.
3. Pilih **Open in Terminal**.

Bila pilihan itu tidak ada:

1. Tekan tombol **Windows**, ketik `powershell`, tekan Enter.
2. Ketik `cd` lalu satu spasi.
3. Seret folder proyek dari File Explorer ke jendela PowerShell.
4. Tekan Enter.

Untuk memastikan Anda berada di tempat yang benar, ketik:

```
dir
```

Yang muncul harus memuat nama-nama seperti `src`, `frontend`, `database`,
dan `README.md`.

---

## Langkah 3 — Periksa dulu sebelum mengirim

Ketik:

```
git status
```

Yang muncul adalah daftar berkas yang berubah. Ini wajar dan tidak perlu
dibaca satu per satu.

### Pemeriksaan yang wajib dilakukan

Ketik:

```
git status --porcelain | Select-String ".env"
```

**Bila tidak muncul apa-apa, aman.** Lanjut ke Langkah 4.

**Bila muncul nama berkas `.env`**, hentikan dulu. Ketik:

```
git rm --cached .env
git rm --cached frontend/.env.local
```

Bila salah satunya menjawab "did not match any files", abaikan saja, artinya
memang tidak ada.

> Berkas `.env` memuat kunci Supabase dan token bot Anda. Kunci yang sudah
> pernah terunggah ke GitHub harus dianggap bocor selamanya, dan wajib
> diganti di Supabase serta BotFather. Pemeriksaan dua puluh detik ini jauh
> lebih murah daripada mengganti semua kunci.

---

## Langkah 4 — Kirim ke GitHub

Ketik tiga perintah berikut, satu per satu, tekan Enter setelah masing-masing.

```
git add .
```

Tidak ada tampilan apa pun. Itu normal.

```
git commit -m "Perbaiki pemuatan model dan pesan galat Telegram"
```

Muncul ringkasan berapa berkas yang berubah.

```
git push
```

Muncul beberapa baris, diakhiri sesuatu seperti `main -> main`.

### Bila diminta nama pengguna dan kata sandi

GitHub tidak lagi menerima kata sandi akun. Anda memerlukan **Personal Access
Token**. Cara membuatnya ada di bagian bawah panduan ini.

Isikan:
- Username: nama pengguna GitHub Anda
- Password: **tempelkan token**, bukan kata sandi akun

---

## Langkah 5 — Model ikut terunggah?

Folder `models/` berisi berkas model yang ukurannya beberapa megabita. Berkas
itu **harus ikut terunggah**, karena GitHub Actions membacanya saat menilai
kondisi saluran.

Untuk memastikan, ketik:

```
git log --stat -1 | Select-String "models/"
```

Bila muncul nama seperti `models/klasifikasi_status.joblib`, berarti sudah
ikut.

Bila tidak muncul sama sekali, kemungkinan `models/` tercantum di
`.gitignore`. Periksa dengan:

```
Select-String "models" .gitignore
```

Bila ada barisnya, hapus baris itu dengan Notepad, lalu ulangi Langkah 4.

---

## Langkah 6 — Tunggu Vercel

1. Buka **[vercel.com](https://vercel.com)**, klik proyek Anda.
2. Klik tab **Deployments**.
3. Baris paling atas akan bertuliskan **Building**.
4. Tunggu satu sampai tiga menit sampai menjadi **Ready** berwarna hijau.

---

## Langkah 7 — Periksa GitHub Actions

1. Buka repositori Anda di GitHub.
2. Klik tab **Actions**.
3. Klik alur **SIGAP Drainase** di daftar kiri.
4. Klik **Run workflow** → **Run workflow**.
5. Tunggu, lalu klik jalannya untuk membaca catatannya.

Yang seharusnya muncul sekarang:

```
Model klasifikasi dimuat (sumber sintetis, dilatih ...)
Model ramalan dimuat (dilatih ...)
>>> STATUS: ...
```

Yang **tidak** boleh muncul lagi:

```
SIKLUS GAGAL: ... is not a known BitGenerator module
```

---

## Membuat Personal Access Token GitHub

Diperlukan sekali saja, lalu bisa dipakai berulang kali.

1. Buka **github.com**, klik foto profil Anda di pojok kanan atas.
2. Klik **Settings**.
3. Gulir ke bawah di daftar kiri, klik **Developer settings**.
4. Klik **Personal access tokens** → **Tokens (classic)**.
5. Klik **Generate new token** → **Generate new token (classic)**.
6. Isi:
   - **Note**: `sigap-drainase`
   - **Expiration**: `90 days`
   - **Select scopes**: centang kotak **repo** yang paling atas
7. Gulir ke bawah, klik **Generate token**.
8. **Salin token yang muncul sekarang juga.** Token hanya ditampilkan sekali.
   Setelah halaman ditutup, tidak bisa dilihat lagi.

Simpan di tempat aman, misalnya Notepad yang Anda simpan di folder pribadi.
Jangan simpan di dalam folder proyek, karena bisa ikut terunggah.

Agar tidak diminta terus setiap kali `push`, ketik sekali:

```
git config --global credential.helper manager
```

Windows akan mengingatnya setelah Anda memasukkannya sekali.

---

## Bila ada masalah

### "fatal: not a git repository"

Anda berada di folder yang salah, atau folder `.git` hilang.

Periksa lokasi dengan `dir`. Bila memang benar di folder proyek tetapi tetap
begitu, berarti `.git` hilang. Ketik:

```
git init
git branch -M main
git remote add origin https://github.com/kaptenHANDOYO17/sigapindonesiaemas.git
git add .
git commit -m "Perbarui ke versi baru"
git push -u origin main --force
```

> `--force` menimpa isi repositori dengan isi folder Anda. Pastikan folder
> Anda memang sudah berisi versi terbaru yang lengkap.

### "Updates were rejected"

Ada perubahan di GitHub yang belum ada di komputer Anda. Ketik:

```
git pull --rebase
git push
```

### "nothing to commit, working tree clean"

Berkasnya belum benar-benar tertimpa. Ulangi Langkah 1, dan pastikan memilih
**Replace the files in the destination**.

### "File is too large" atau ditolak karena ukuran

Ada berkas melebihi 100 MB. Biasanya karena folder `node_modules` atau
`.next` ikut terbawa. Hapus keduanya dari folder `frontend`, lalu:

```
git rm -r --cached frontend/node_modules
git rm -r --cached frontend/.next
git add .
git commit -m "Hapus berkas yang tidak perlu"
git push
```

Keduanya memang tidak perlu diunggah; Vercel membuatnya sendiri.

### Push berhasil tetapi Vercel tidak berubah

Periksa Vercel → **Settings** → **Git**, pastikan repositori dan cabangnya
benar. Cabang yang dipantau biasanya `main`.

---

## Ringkasan untuk ditempel di meja

```
1. Ekstrak zip → Ctrl+A → Ctrl+C → tempel ke folder lama → Replace
2. Klik kanan di folder → Open in Terminal
3. git status --porcelain | Select-String ".env"     ← harus kosong
4. git add .
5. git commit -m "keterangan perubahan"
6. git push
7. Vercel → Deployments → tunggu Ready
8. GitHub → Actions → Run workflow → harus hijau
```
