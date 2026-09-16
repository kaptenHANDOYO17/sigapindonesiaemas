# Memperbaiki Bot dan Menjalankan Fitur Baru

Panduan ini menjawab empat hal yang Anda tanyakan, berurutan dari yang paling
mendesak.

1. Bot Telegram tidak membalas
2. Pendaftaran warga tanpa verifikasi WhatsApp
3. Tabel warga dengan pencarian dan pengubahan di halaman pengelola
4. Ringkasan AI dan obrolan santai di bot

---

# Bagian 1 — Bot tidak membalas

## Pertama, cabut token Anda

Token bot Anda sudah dua kali tertulis dalam percakapan ini. Anggap ia bocor.

1. Buka Telegram, cari **@BotFather**.
2. Kirim **`/revoke`**.
3. Pilih **aisigap_bot**.
4. BotFather memberi token baru. Token lama langsung mati.

Pakai token baru itu untuk seluruh langkah berikutnya. Lima detik, dan
mencegah orang lain mengirim pesan atas nama bot Anda.

## Cara mengetahui persis apa yang salah

Versi baru menyediakan halaman pemeriksa. Setelah Anda mengunggah pembaruan
ini, buka di peramban:

```
https://sigapindonesiaemas.vercel.app/api/telegram
```

Yang muncul berupa laporan seperti ini:

```json
{
  "siap": true,
  "variabel": {
    "TELEGRAM_BOT_TOKEN": true,
    "TELEGRAM_WEBHOOK_SECRET": true,
    "SUPABASE_SERVICE_KEY": true,
    "XAI_API_KEY": false
  },
  "webhook": {
    "terpasang_di": "https://sigapindonesiaemas.vercel.app/api/telegram",
    "galat_terakhir": "(tidak ada)"
  },
  "saran": ["Semua sudah terisi..."]
}
```

Bacalah bagian **`saran`**. Di situ tertulis apa yang perlu Anda kerjakan.
Nilai kunci tidak pernah ditampilkan, hanya ada atau tidaknya, sehingga aman
dibuka siapa pun.

## Penyebab yang paling mungkin pada kasus Anda

Anda menyebut kata sandi webhook Anda `aaaaabbbbbcccccdddd`. Pertanyaannya:
**apakah nilai itu juga sudah ada di Vercel?**

Kata sandi itu harus ada di **dua tempat**, dan isinya harus sama persis:

| Tempat | Cara mengisinya |
|---|---|
| Vercel | Settings → Environment Variables → `TELEGRAM_WEBHOOK_SECRET` |
| Telegram | ikut serta di dalam tautan `setWebhook` |

Bila hanya ada di tautan `setWebhook` tetapi belum ada di Vercel, setiap pesan
yang dikirim Telegram akan ditolak dengan galat **401**, dan bot tampak diam
meski webhook terlihat terpasang.

## Perbaikannya, berurutan

### Langkah 1 — Isi di Vercel

1. Buka **[vercel.com](https://vercel.com)** → proyek **sigapindonesiaemas**.
2. **Settings** → **Environment Variables**.
3. Pastikan keempat ini ada:

| Key | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token **baru** dari BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | `aaaaabbbbbcccccdddd` |
| `TELEGRAM_ADMIN_CHAT_ID` | angka ID Anda dari @userinfobot |
| `NEXT_PUBLIC_TELEGRAM_BOT` | `aisigap_bot` |

Untuk setiap baris, centang **Production**, **Preview**, dan **Development**.

### Langkah 2 — Terbitkan ulang

**Jangan dilewati.** Environment Variables hanya terbaca pada penerbitan
berikutnya.

Vercel → tab **Deployments** → baris teratas → titik tiga **⋯** →
**Redeploy** → **Redeploy**.

Tunggu sampai **Ready** berwarna hijau.

### Langkah 3 — Pasang ulang webhook

Ganti `TOKEN_BARU` dengan token dari BotFather:

```
https://api.telegram.org/botTOKEN_BARU/setWebhook?url=https://sigapindonesiaemas.vercel.app/api/telegram&secret_token=aaaaabbbbbcccccdddd
```

Jawaban yang benar: `{"ok":true,...,"Webhook was set"}`

### Langkah 4 — Periksa

1. Buka `https://sigapindonesiaemas.vercel.app/api/telegram`
2. Lihat bagian `saran`. Bila tertulis semua sudah terisi, lanjut.
3. Kirim **/start** ke @aisigap_bot. Harus membalas dalam satu dua detik.
4. Bila masih diam, muat ulang halaman pemeriksa tadi dan baca
   `galat_terakhir`.

## Jalan pintas bila masih bandel

Webhook bisa dipasang **tanpa** kata sandi. Lebih longgar, tetapi berguna
untuk memastikan bahwa memang kata sandinya yang bermasalah.

1. Kosongkan `TELEGRAM_WEBHOOK_SECRET` di Vercel, atau hapus variabelnya.
2. Redeploy.
3. Pasang webhook tanpa bagian `secret_token`:

```
https://api.telegram.org/botTOKEN_BARU/setWebhook?url=https://sigapindonesiaemas.vercel.app/api/telegram
```

Bila dengan cara ini bot membalas, berarti masalahnya memang pada kata sandi
yang berbeda di dua tempat. Setelah yakin, pasang kembali dengan kata sandi
agar lebih aman.

## Satu hal lagi yang perlu diperiksa

Bila proyek Vercel Anda menyalakan **Deployment Protection**, Telegram akan
diminta masuk dan tidak akan pernah berhasil.

Periksa di **Settings** → **Deployment Protection**. Untuk **Production**,
pastikan pilihannya **Disabled**.

---

# Bagian 2 — Pendaftaran warga tanpa verifikasi WhatsApp

Sudah diubah sesuai permintaan Anda. Verifikasi WhatsApp dihapus. Warga cukup
mengisi **nama lengkap** dan **nomor HP**, lalu langsung tercatat aktif.

## Namun ada satu kenyataan teknis yang perlu Anda pahami

**Bot Telegram tidak dapat mengirim pesan hanya berbekal nomor telepon.**

Ini bukan batasan sistem kita, melainkan aturan Telegram sendiri. Bot baru
diizinkan mengirim pesan setelah orang yang bersangkutan membuka percakapan
lebih dulu. Yang dipakai untuk mengirim adalah `chat_id`, dan `chat_id` itu
baru ada setelah orangnya menekan **START**.

Artinya: nomor yang hanya diketik di formulir **tidak akan menerima apa pun**,
sampai orangnya membuka bot sekali.

## Cara sistem menyiasatinya sekarang

```
Warga isi nama + nomor
        │
        ▼
Tersimpan, langsung aktif        ← sudah tercatat di daftar warga
        │
        ▼
Muncul tombol "Buka bot Telegram sekarang"
        │
        ▼
Warga tekan START satu kali
        │
        ▼
Bot mengenali kodenya, menempelkan chat_id ke baris yang tadi
        │
        ▼
Peringatan mulai sampai ke ponselnya
```

Tombol itu membawa kode pendaftaran di dalamnya, sehingga bot langsung tahu
baris mana yang harus disambungkan. Warga tidak perlu mengetik apa pun.

Di halaman pengelola, kolom **Telegram** menunjukkan siapa yang sudah menekan
tombol itu dan siapa yang belum. Yang bertanda **belum** perlu diingatkan
lewat kunjungan kader atau telepon biasa.

## Yang perlu Anda sadari dari perubahan ini

Formulir kini terbuka tanpa pemeriksaan. Seseorang dapat mendaftarkan nomor
orang lain. Penyeimbangnya ada dua, dan keduanya sudah terpasang:

- Pesan baru benar-benar sampai setelah orangnya sendiri membuka bot.
- Halaman `/berhenti` tersedia tanpa syarat apa pun.

Bila kelak ada warga yang mengeluh menerima pesan tanpa pernah mendaftar,
itulah sebabnya, dan halaman `/berhenti` adalah jawabannya.

---

# Bagian 3 — Tabel warga di halaman pengelola

Buka `/admin` → tab **Pendaftaran Nomor**. Sekarang isinya seluruh warga
terdaftar, bukan hanya yang menunggu.

## Yang bisa Anda lakukan

| Tindakan | Caranya |
|---|---|
| Mencari | Ketik di kotak pencarian. Mencakup nama, nomor, RT/RW, dan kode |
| Menyaring | Tekan tombol Semua, Aktif, Nonaktif, Belum ke Telegram, atau Petugas |
| Mengubah | Tekan **Ubah**, perbaiki, lalu **Simpan** |
| Menonaktifkan | Tekan **Nonaktifkan**. Datanya tetap ada, hanya berhenti dikirimi |
| Menghapus | Tekan **Hapus**. Ada konfirmasi lebih dulu |

Kolom yang dapat diubah: nama, nomor, RT/RW, peran, dan status aktif.

## Arti kolom Telegram

| Tanda | Artinya |
|---|---|
| **ya** | Sudah membuka bot. Peringatan akan sampai |
| **belum** | Baru mengisi formulir. Peringatan **belum** akan sampai |

Saringan **Belum ke Telegram** memudahkan Anda melihat siapa saja yang masih
perlu diingatkan.

## Mengapa nomor ditampilkan sebagian

Nomor sengaja disamarkan menjadi seperti `62895••••126`. Bila Anda benar-benar
perlu nomor lengkap, bukalah melalui Supabase, agar akses itu meninggalkan
jejak yang dapat ditelusuri. Ini kebiasaan kecil yang menyelamatkan Anda bila
suatu saat ada pertanyaan tentang penyalahgunaan data.

---

# Bagian 4 — Ringkasan AI dan obrolan bot

## Mengapa ringkasan AI gagal

Pesan galat Anda sudah menyebutkan sebabnya dengan jelas:

> Your newly created team doesn't have any credits or licenses yet.

Ini **bukan kesalahan kode**. Akun xAI Anda belum punya saldo. Pada tangkapan
layar console.x.ai Anda tertulis **Credit balance: $0.00**.

### Cara mengisinya

1. Buka **[console.x.ai](https://console.x.ai)**.
2. Klik **Add credits** di kotak paling atas.
3. Isi saldo sesuai kemampuan. Untuk meringkas beberapa puluh laporan, biaya
   per pemakaian sangat kecil.

### Sekalian perbaiki nama modelnya

Pada contoh di console Anda, model yang dipakai bernama **`grok-4.6`**,
sedangkan bawaan sistem sebelumnya `grok-3`. Versi baru sudah memakai
`grok-4.6` sebagai bawaan.

Bila kelak namanya berganti lagi, ubah saja di Vercel:

| Key | Value |
|---|---|
| `XAI_MODEL` | nama model terbaru dari docs.x.ai |

### Cara mengaktifkannya

Vercel → Settings → Environment Variables:

| Key | Value |
|---|---|
| `XAI_API_KEY` | kunci dari console.x.ai |
| `XAI_MODEL` | `grok-4.6` |

Lalu **Redeploy**.

> Kunci xAI Anda juga sudah tertulis dalam percakapan ini. Sebaiknya dihapus
> dan dibuat baru: console.x.ai → **API Keys** → hapus yang lama → **Create
> API key**.

## Fitur obrolan santai di bot

Sudah ditambahkan. Warga tinggal mengetik pertanyaan dengan bahasa biasa,
tanpa perintah apa pun.

```
Warga : saluran depan rumah gimana ya sekarang?
Bot   : Sekarang statusnya Waspada. Endapannya sudah sekitar 38 persen
        kedalaman saluran, tapi airnya masih mengalir lancar. Belum bahaya,
        cuma jangan buang sampah ke saluran dulu ya.
```

### Pagar pengaman yang saya pasang

Ini bagian yang perlu Anda ketahui, karena menyangkut keselamatan orang.

**Kondisi saluran diambil dulu dari basis data, lalu disisipkan ke arahan
model.** Model tidak diminta menebak apa pun; ia hanya boleh menyampaikan
ulang angka yang sudah diberikan. Tanpa ini, model akan mengarang angka
endapan ketika ditanya, dan warga akan memercayainya.

Model juga dilarang:

- mengarang angka yang tidak ada di data
- membuat ramalan sendiri, harus mengarahkan ke `/prediksi`
- memutuskan apakah warga perlu mengungsi
- menjanjikan kapan petugas datang

Untuk keadaan darurat, ia diarahkan menyebut nomor 112 dan mengikuti aparat
setempat.

**Yang tetap tidak memakai model bahasa:** penilaian status saluran dan
kalimat peringatan otomatis yang dikirim sistem. Keduanya tetap memakai
matriks aturan dan templat tetap. Alasannya sama seperti sebelumnya: pesan
kebencanaan harus dapat diprediksi dan diaudit, dan bila suatu saat keliru,
Anda harus bisa menunjuk aturan mana yang salah.

### Bila XAI_API_KEY belum diisi

Bot tetap berjalan normal. Ia hanya menjawab dengan daftar perintah biasa
ketika menerima pesan bebas. Tidak ada bagian lain yang bergantung padanya.

---

# Urutan pengerjaan

```
1.  BotFather → /revoke → salin token baru
2.  console.x.ai → hapus kunci lama → buat kunci baru → Add credits
3.  Ganti berkas lama dengan isi zip yang baru
4.  git add . → git commit -m "..." → git push
5.  Vercel → Environment Variables:
       TELEGRAM_BOT_TOKEN       = token baru
       TELEGRAM_WEBHOOK_SECRET  = aaaaabbbbbcccccdddd
       NEXT_PUBLIC_TELEGRAM_BOT = aisigap_bot
       XAI_API_KEY              = kunci baru
       XAI_MODEL                = grok-4.6
6.  Vercel → Deployments → Redeploy          ← jangan dilewati
7.  Pasang ulang webhook dengan token baru
8.  Buka /api/telegram, baca bagian "saran"
9.  Kirim /start ke bot                      ← harus membalas
10. Coba ketik pertanyaan bebas ke bot       ← obrolan santai
11. Buka /daftar, coba daftar, tekan tombol Telegram
12. Buka /admin → Pendaftaran Nomor          ← nama Anda muncul, Telegram "ya"
```

---

# Bila masih bermasalah

| Gejala | Yang harus diperiksa |
|---|---|
| Bot diam total | Buka `/api/telegram`, baca `saran` dan `galat_terakhir` |
| `galat_terakhir` berisi 401 | `TELEGRAM_WEBHOOK_SECRET` beda antara Vercel dan tautan setWebhook |
| `galat_terakhir` berisi 404 | Alamat webhook salah, pastikan berakhiran `/api/telegram` |
| Bot balas perintah, tapi tidak bisa mengobrol | `XAI_API_KEY` belum diisi, atau saldo xAI habis |
| Ringkasan AI menolak | Saldo xAI kosong. Isi di console.x.ai |
| Warga terdaftar tapi tidak dapat pesan | Kolom Telegram bertanda **belum**. Ia harus membuka bot sekali |
| `pesan_menunggu` besar di `/api/telegram` | Webhook baru saja diperbaiki. Pesan lama akan diproses sendiri |
