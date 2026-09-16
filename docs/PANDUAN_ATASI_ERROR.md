# Mengatasi Error dan Menyambungkan Bot

Panduan ini menjawab tiga pesan galat yang Anda temui, lalu menuntun sampai
bot Telegram benar-benar tersambung ke situs dan Supabase.

---

## Ringkasan: apa yang sebenarnya salah

Ketiga galat Anda berasal dari **dua sebab saja**.

| Pesan galat yang muncul | Sebab sebenarnya |
|---|---|
| "Server belum dikonfigurasi" di halaman `/daftar` | Satu Environment Variable belum ada di Vercel |
| "Token bot Telegram atau kunci Supabase belum diatur" di `/simulasi` | Sebab yang sama |
| "SIKLUS GAGAL: Tidak ada data sensor" di GitHub Actions | Tabel sensor masih kosong, karena alat belum terpasang |

Kabar baiknya: keduanya bukan kerusakan, hanya belum lengkap. Token bot Anda
sudah benar, itu bukan penyebabnya.

---

# Bagian 1 — Galat "Server belum dikonfigurasi"

## Mengapa terjadi

Situs Anda punya dua macam kunci Supabase yang berbeda.

| Kunci | Dipakai oleh | Boleh dilihat umum |
|---|---|---|
| `anon` | Halaman yang dibuka pengunjung | Ya |
| `service_role` | Bagian server, untuk menyimpan nomor warga | **Tidak** |

Pada tangkapan layar Vercel Anda, yang sudah ada adalah
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
dan `SUPABASE_KEY`.

Formulir pendaftaran mencari `SUPABASE_SERVICE_ROLE_KEY`, dan nama itu belum
ada. Karena tidak ketemu, ia menolak menyimpan apa pun. Sikap itu disengaja:
lebih baik menolak daripada diam-diam gagal menyimpan nomor warga.

> **Versi baru sudah dilonggarkan.** Sekarang `SUPABASE_KEY` juga diterima,
> asalkan isinya memang kunci `service_role`. Jadi Anda punya dua pilihan
> di bawah ini.

## Cara memperbaiki

### Langkah 1 — Pastikan dulu isi SUPABASE_KEY Anda

1. Buka **[supabase.com](https://supabase.com)**, masuk, pilih proyek Anda.
2. Menu kiri paling bawah, klik ikon roda gigi **Project Settings**.
3. Klik **API Keys** (pada tampilan lama namanya **API**).
4. Anda akan melihat dua kunci panjang:
   - **anon public** — yang pendek keterangannya, untuk peramban
   - **service_role secret** — bertanda peringatan merah, ada tombol **Reveal**

5. Klik **Reveal** pada **service_role**, lalu salin.

### Langkah 2 — Masukkan ke Vercel

1. Buka **[vercel.com](https://vercel.com)** → proyek **sigapindonesiaemas**.
2. Klik **Settings** di menu atas.
3. Klik **Environment Variables** di daftar kiri.
4. Klik tombol untuk menambah variabel baru, lalu isi:

   | Kolom | Isi |
   |---|---|
   | Key | `SUPABASE_SERVICE_ROLE_KEY` |
   | Value | kunci service_role yang tadi disalin |
   | Environments | centang **Production**, **Preview**, **Development** |

5. Tekan **Save**.

Sekalian tambahkan dua ini, karena akan dipakai pada Bagian 3:

| Key | Value |
|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | karang sendiri, minimal 20 huruf dan angka acak |
| `NEXT_PUBLIC_WA_PENGELOLA` | nomor WhatsApp Anda, format `62895378169126` |

> Perhatikan: `SUPABASE_SERVICE_ROLE_KEY` dan `TELEGRAM_WEBHOOK_SECRET`
> **tidak** memakai awalan `NEXT_PUBLIC_`. Kalau diberi awalan itu, Next.js
> akan menyisipkan nilainya ke berkas yang diunduh peramban, dan seluruh
> nomor warga terbuka bagi siapa saja.

### Langkah 3 — Terbitkan ulang

**Ini yang paling sering terlewat.** Environment Variables baru terbaca pada
penerbitan berikutnya, bukan seketika.

1. Klik tab **Deployments** di menu atas.
2. Baris paling atas, klik titik tiga **⋯** di sebelah kanan.
3. Pilih **Redeploy**, lalu tekan **Redeploy** lagi pada kotak yang muncul.
4. Tunggu sampai bertuliskan **Ready** berwarna hijau.

### Langkah 4 — Periksa

Buka `sigapindonesiaemas.vercel.app/daftar`, isi formulir, tekan **Daftar**.

Yang seharusnya muncul: halaman "Pendaftaran tersimpan" berisi **kode
konfirmasi enam huruf**, bukan tulisan merah lagi.

---

# Bagian 2 — Galat "SIKLUS GAGAL: Tidak ada data sensor"

## Mengapa terjadi

Baca lagi catatan alur Anda:

```
VEGA belum dikonfigurasi. Melewati penarikan radar.
Pembacaan radar baru tersimpan: 0
SIKLUS GAGAL: Tidak ada data sensor di Supabase.
```

Ini **bukan kerusakan**. Artinya sederhana: tabel `sensor_drainase` di
Supabase masih kosong, karena ESP32 memang belum dipasang di saluran. Sistem
tidak punya apa pun untuk dinilai.

Baris pertama juga bisa diabaikan. VEGA hanya berlaku bila sensornya VEGAPULS
Air 23, yang mengirim datanya sendiri lewat jaringan seluler. Anda sudah
mengganti ke Holykell HR2000, yang dibaca langsung oleh ESP32, sehingga
penarikan VEGA memang tidak diperlukan.

## Cara memperbaiki

Versi baru sudah mengubah sikapnya. Ketika tabel sensor kosong, alur kerja
tidak lagi berwarna merah, melainkan berhenti dengan keterangan yang jelas.
Alasannya: peringatan yang berbunyi setiap tiga puluh menit untuk keadaan yang
normal akan membuat orang berhenti membacanya, dan kerusakan sungguhan justru
terlewat.

Agar dasbor tidak kosong saat dinilai juri, isi tabelnya dengan data peragaan:

1. Buka Supabase → **SQL Editor** → **New query**.
2. Buka berkas `database/data_contoh.sql` dengan Notepad.
3. Salin seluruh isinya, tempel, tekan **Run**.

Setelah itu buka situs Anda. Dasbor akan terisi, dengan spanduk kuning yang
menyatakan terus terang bahwa angkanya adalah contoh.

Jalankan juga alur GitHub Actions secara manual untuk memastikan sudah hijau:

1. Buka repositori GitHub Anda → tab **Actions**.
2. Klik alur **SIGAP Drainase** di daftar kiri.
3. Klik **Run workflow** → **Run workflow**.

> Hapus data contoh sebelum sistem dipakai warga sungguhan. Perintah
> penghapusannya ada di bagian paling bawah berkas `data_contoh.sql`.

---

# Bagian 3 — Menyambungkan bot Telegram

Token dan nama bot Anda sudah ada:

```
Nama bot : aisigap_bot
```

Token tidak ditulis di sini dengan sengaja. Simpan sendiri, dan jangan
tempelkan di tempat yang bisa dibaca orang lain.

> **Penting.** Token bot Anda sudah pernah Anda kirimkan dalam percakapan ini.
> Sebaiknya **dicabut dan diganti** sebelum dipakai sungguhan. Caranya: buka
> @BotFather → kirim `/revoke` → pilih `aisigap_bot`. BotFather memberi token
> baru, dan token lama langsung mati. Pakai token baru itu di langkah-langkah
> berikut.

## Langkah 1 — Isi di Vercel

Buka Vercel → Settings → Environment Variables, pastikan keempat ini ada:

| Key | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token dari BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | angka ID Anda dari @userinfobot |
| `TELEGRAM_WEBHOOK_SECRET` | kata sandi acak buatan Anda |
| `NEXT_PUBLIC_TELEGRAM_BOT` | `aisigap_bot` (tanpa tanda @) |

Lalu **Redeploy**, seperti Bagian 1 Langkah 3.

## Langkah 2 — Beri tahu Telegram alamat situs Anda

Susun tautan ini, ganti dua bagian bertanda:

```
https://api.telegram.org/botTOKEN_ANDA/setWebhook?url=https://sigapindonesiaemas.vercel.app/api/telegram&secret_token=KATA_SANDI_ANDA
```

Setelah `bot` **langsung** token, tanpa spasi dan tanpa garis miring.

Tempel di peramban, tekan Enter. Jawaban yang benar:

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## Langkah 3 — Coba

Buka Telegram, cari **@aisigap_bot**, tekan **START**.

Bot harus membalas dalam satu dua detik. Coba juga `/status`, `/prediksi`,
dan `/lapor ada sampah di RT 3`.

## Langkah 4 — Bila bot diam

Buka tautan ini di peramban:

```
https://api.telegram.org/botTOKEN_ANDA/getWebhookInfo
```

Cari baris `last_error_message`, lalu cocokkan:

| Yang tertulis | Perbaikannya |
|---|---|
| `401 Unauthorized` | `TELEGRAM_WEBHOOK_SECRET` di Vercel berbeda dengan yang Anda pakai saat `setWebhook` |
| `404 Not Found` | Alamat situs salah, atau kurang `/api/telegram` di ujungnya |
| `500` | `SUPABASE_SERVICE_ROLE_KEY` belum terisi. Ulangi Bagian 1 |
| kosong tapi bot diam | Situs belum diterbitkan ulang setelah variabel diisi |

## Langkah 5 — Bagikan tautan pendaftaran

Ada dua tautan berbeda, dan perbedaannya menentukan jenis pesan yang diterima.

```
Untuk warga   : https://t.me/aisigap_bot?start=warga
Untuk petugas : https://t.me/aisigap_bot?start=bpbd
```

Bagikan tautan petugas hanya kepada petugas BPBD.

---

# Bagian 4 — Tiga cara warga mendaftar nomor

Anda bertanya bagaimana nomor warga bisa terdata tanpa harus lewat bot.
Sekarang ada tiga jalan, dan warga memilih sendiri.

| Cara | Langsung aktif? | Cocok untuk |
|---|---|---|
| Formulir situs lalu kirim kode lewat WhatsApp | Setelah Anda konfirmasi | Warga yang tidak punya Telegram |
| Bot Telegram | Ya, seketika | Warga yang sudah pakai Telegram |
| Didaftarkan kader saat kunjungan | Setelah kader konfirmasi | Warga yang tidak punya telepon pintar |

## Mengapa formulir situs tidak langsung aktif

Formulir itu terbuka untuk umum. Siapa pun bisa mengetikkan nomor
tetangganya, dan orang itu akan menerima peringatan darurat yang tidak pernah
ia minta. Karena itu nomor perlu dipastikan dulu.

## Cara kerja konfirmasi lewat WhatsApp

1. Warga mengisi formulir di `/daftar`.
2. Muncul **kode enam huruf**, misalnya `K7M2QP`.
3. Warga menekan tombol. WhatsApp terbuka dengan pesan sudah terisi ke nomor
   Anda, tinggal ditekan kirim.
4. Anda menerima pesan berisi kode itu di WhatsApp biasa.
5. Buka situs → `/admin` → tab **Pendaftaran Nomor**. Cocokkan kodenya dengan
   baris di tabel, tekan **Aktifkan**.

Karena pesan itu datang dari nomor warga sendiri, kepemilikannya terbukti,
tanpa perlu layanan pengirim OTP berbayar.

Agar tombol itu berfungsi, isi `NEXT_PUBLIC_WA_PENGELOLA` di Vercel dengan
nomor WhatsApp Anda, format `62895378169126` — tanpa tanda plus, tanpa spasi,
tanpa angka nol di depan.

---

# Bagian 5 — Menambahkan Grok (xAI)

## Jawabannya: bisa, dan sudah saya siapkan

Namun perlu saya sampaikan terus terang di mana batasnya, karena ini
menyangkut keselamatan orang.

### Di mana Grok dipakai

**Satu tempat saja: meringkas laporan warga untuk dibaca pengelola.**

Itu pekerjaan yang memang cocok baginya. Teksnya banyak, pembacanya manusia
yang paham konteks, dan bila ringkasannya meleset, pengelola masih bisa
membuka laporan aslinya.

### Di mana Grok TIDAK dipakai, dan mengapa

**Tidak untuk menentukan status saluran.** Status ditentukan matriks aturan
yang setiap kaidahnya dapat dibaca dan diperiksa manusia. Bila suatu saat
sistem keliru, Anda harus bisa menunjukkan aturan mana yang salah dan
memperbaikinya. Model bahasa tidak memberi Anda kemampuan itu.

**Tidak untuk menyusun kalimat peringatan yang dikirim ke warga.** Pesan
kebencanaan harus dapat diprediksi, diaudit, dan tidak boleh mengarang. Bila
model salah menulis satu kalimat pada peringatan Kritis, akibatnya bukan
ringkasan yang keliru di layar, melainkan warga yang mengungsi tanpa sebab
atau justru tidak mengungsi ketika seharusnya.

Kalau juri bertanya "di mana AI-nya", jawaban ini justru menguatkan: Anda
memakai AI di tempat yang tepat dan menahan diri di tempat yang berisiko.

### Cara mengaktifkannya

1. Buka **[console.x.ai](https://console.x.ai)**, masuk, buat **API Key**.
2. Buka Vercel → Settings → Environment Variables, tambahkan:

   | Key | Value |
   |---|---|
   | `XAI_API_KEY` | kunci dari console.x.ai |
   | `XAI_MODEL` | `grok-3` (ubah bila nama modelnya berganti) |

3. **Redeploy**.
4. Masuk ke `/admin` → tab **Laporan Warga** → tekan tombol
   **Ringkas laporan dengan AI**.

Bila muncul keterangan tentang nama model, buka **docs.x.ai** untuk melihat
nama model terbaru, lalu perbarui `XAI_MODEL`.

### Bila tidak diisi

Tidak apa-apa. Tombolnya akan menolak dengan sopan, dan seluruh bagian lain
sistem berjalan normal. Tidak ada yang bergantung pada Grok.

---

# Urutan pengerjaan

Kerjakan berurutan, karena yang belakangan bergantung pada yang di depannya.

```
1. Salin kunci service_role dari Supabase
2. Isi di Vercel: SUPABASE_SERVICE_ROLE_KEY
                  TELEGRAM_WEBHOOK_SECRET
                  NEXT_PUBLIC_WA_PENGELOLA
                  NEXT_PUBLIC_TELEGRAM_BOT = aisigap_bot
3. Vercel → Deployments → Redeploy          ← jangan dilewati
4. Cabut token lama di BotFather (/revoke), pakai token baru
5. Buka tautan setWebhook di peramban
6. Kirim /start ke @aisigap_bot             ← harus membalas
7. Supabase SQL Editor → jalankan data_contoh.sql
8. GitHub Actions → Run workflow            ← harus hijau
9. Buka /daftar, coba daftarkan nomor Anda  ← harus muncul kode
10. Buka /admin → Pendaftaran Nomor → Aktifkan
11. Opsional: isi XAI_API_KEY untuk ringkasan laporan
```

---

# Daftar lengkap Environment Variables di Vercel

Sebagai pembanding, agar Anda bisa mencocokkan.

| Key | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ya | Sudah ada di daftar Anda |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | Sudah ada |
| `SUPABASE_SERVICE_ROLE_KEY` | **ya** | **Belum ada. Inilah penyebab galatnya** |
| `NEXT_PUBLIC_TELEGRAM_BOT` | ya | `aisigap_bot` |
| `TELEGRAM_BOT_TOKEN` | ya | Sudah ada |
| `TELEGRAM_ADMIN_CHAT_ID` | ya | Sudah ada |
| `TELEGRAM_WEBHOOK_SECRET` | **ya** | **Belum ada** |
| `NEXT_PUBLIC_WA_PENGELOLA` | untuk konfirmasi WhatsApp | Belum ada |
| `XAI_API_KEY` | tidak | Hanya bila ingin ringkasan laporan |
| `XAI_MODEL` | tidak | Bawaan `grok-3` |

Yang berikut ini sudah tidak dipakai lagi dan boleh dihapus dari Vercel:
`VEGA_BASE_URL`, `VEGA_API_TOKEN`, `VEGA_DEVICE_ID` (karena sensor sudah
diganti Holykell), dan `ADMIN_TOKEN` bila masih ada (karena halaman pengelola
sekarang memakai akun sendiri-sendiri).

`WHATSAPP_TOKEN` boleh dibiarkan bila Anda berencana memakai WhatsApp Business
API nanti. Selama belum disetujui Meta, notifikasi berjalan lewat Telegram.
