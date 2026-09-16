# Membuat Bot Telegram — Panduan untuk Pemula

Ditulis dengan anggapan Anda belum pernah membuat bot sama sekali. Setiap
langkah menyebutkan **tombol apa yang ditekan** dan **di layar mana**.

Seluruh proses memakan waktu sekitar dua puluh menit. Anda tidak perlu menulis
satu baris kode pun, karena kodenya sudah ada di dalam proyek ini.

> **Pertanyaan yang sering muncul: apakah perlu Google Apps Script?**
> Tidak. Apps Script tidak dipakai sama sekali. Kode botnya sudah tertulis di
> `frontend/app/api/telegram/route.js`, dan ikut terbit sendiri ketika situs
> Anda diterbitkan di Vercel.

---

## Ringkasan: apa yang sebenarnya terjadi

```
Warga ketik /status di Telegram
        │
        ▼
   Telegram mengirim pesan itu ke alamat situs Anda
        │
        ▼
   Kode di app/api/telegram/route.js membacanya
        │
        ▼
   Mengambil data dari Supabase, lalu membalas
```

Yang perlu Anda kerjakan hanyalah **memberi tahu Telegram alamat situs Anda**.
Itu dilakukan sekali saja, dengan membuka satu tautan di peramban.

---

## Langkah 1 — Membuat bot di Telegram

1. Buka aplikasi **Telegram** di ponsel atau komputer.
2. Pada kolom pencarian di atas, ketik **`@BotFather`**.
3. Pilih akun bernama **BotFather** yang bertanda centang biru.
4. Tekan tombol **START** di bawah layar.
5. Ketik dan kirim: **`/newbot`**
6. BotFather bertanya nama bot. Ketik bebas, misalnya:
   **`SIGAP Drainase Mangunharjo`**
7. BotFather bertanya nama pengguna bot. **Harus berakhiran `bot`**, misalnya:
   **`sigap_mangunharjo_bot`**
   Bila sudah dipakai orang lain, coba variasi lain sampai diterima.
8. BotFather membalas dengan tulisan **`Use this token to access the HTTP API`**
   diikuti deretan panjang seperti:

   ```
   7891234567:AAHk9dLpQ2vN8xYzR4mT6wB1cE3fG5hJ7kL
   ```

**Salin deretan itu dan simpan.** Itulah `TELEGRAM_BOT_TOKEN`.

> Deretan ini adalah kunci bot Anda. Siapa pun yang memilikinya dapat mengirim
> pesan atas nama bot Anda. Jangan pernah menempelkannya di grup WhatsApp,
> tangkapan layar, atau berkas yang diunggah ke GitHub.

---

## Langkah 2 — Mencari nomor pengenal Telegram Anda

Ini diperlukan agar sistem dapat mengirimi Anda kabar ketika ada laporan warga
baru masuk.

1. Di Telegram, cari **`@userinfobot`**.
2. Tekan **START**.
3. Bot membalas dengan beberapa baris. Cari baris **`Id:`** diikuti angka,
   misalnya `Id: 1234567890`.

**Salin angka itu.** Itulah `TELEGRAM_ADMIN_CHAT_ID`.

---

## Langkah 3 — Membuat kata sandi acak untuk webhook

Kata sandi ini memastikan hanya Telegram yang boleh mengirim pesan ke situs
Anda, bukan orang lain yang kebetulan tahu alamatnya.

Buka **Command Prompt** di Windows, lalu ketik:

```
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

Hasilnya seperti `xK9mP2vQ7nR4sT6wY1zB3cD5fG8hJ0kL`. Salin dan simpan.
Itulah `TELEGRAM_WEBHOOK_SECRET`.

Bila Python belum terpasang, boleh juga mengarang sendiri: campuran huruf
besar, huruf kecil, dan angka, panjang minimal dua puluh karakter, tanpa
spasi.

---

## Langkah 4 — Memasukkan ketiganya ke Vercel

1. Buka **[vercel.com](https://vercel.com)**, masuk ke akun Anda.
2. Pada daftar proyek, klik proyek **sigap-drainase**.
3. Di menu atas, klik tab **Settings**.
4. Di daftar sebelah kiri, klik **Environment Variables**.
5. Tambahkan satu per satu. Untuk setiap baris: isi kolom **Key**, isi kolom
   **Value**, pastikan ketiga kotak **Production**, **Preview**, dan
   **Development** tercentang, lalu tekan **Save**.

| Key | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token dari Langkah 1 |
| `TELEGRAM_ADMIN_CHAT_ID` | angka dari Langkah 2 |
| `TELEGRAM_WEBHOOK_SECRET` | kata sandi dari Langkah 3 |
| `NEXT_PUBLIC_TELEGRAM_BOT` | nama pengguna bot **tanpa tanda @**, contoh `sigap_mangunharjo_bot` |

6. Setelah keempatnya tersimpan, klik tab **Deployments** di menu atas.
7. Pada baris paling atas, klik tanda **titik tiga (⋯)** di sebelah kanan,
   lalu pilih **Redeploy**, lalu tekan **Redeploy** lagi pada kotak yang muncul.

> Langkah 6 dan 7 **tidak boleh dilewati**. Environment Variables baru terbaca
> pada penerbitan berikutnya. Ini penyebab paling sering bot tidak mau
> menjawab padahal semua terasa sudah benar.

Tunggu sampai muncul tulisan **Ready** berwarna hijau, sekitar satu sampai dua
menit.

---

## Langkah 5 — Memberi tahu Telegram alamat situs Anda

Ini satu-satunya langkah yang terlihat "seperti ngoding", padahal hanya
membuka tautan di peramban.

1. Catat alamat situs Anda dari Vercel, misalnya
   `https://sigap-drainase.vercel.app`
2. Susun tautan berikut. Ganti **tiga bagian** yang ditandai:

```
https://api.telegram.org/botTOKEN_ANDA/setWebhook?url=https://ALAMAT_SITUS_ANDA/api/telegram&secret_token=KATA_SANDI_ANDA
```

Contoh jadinya:

```
https://api.telegram.org/bot7891234567:AAHk9dLpQ2vN8xYzR4mT6wB1cE3fG5hJ7kL/setWebhook?url=https://sigap-drainase.vercel.app/api/telegram&secret_token=xK9mP2vQ7nR4sT6wY1zB3cD5fG8hJ0kL
```

Perhatikan: setelah `bot` **langsung** token, tanpa spasi dan tanpa garis
miring.

3. Tempel tautan itu di peramban, tekan Enter.
4. Yang muncul harus:

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

Bila tertulis `"ok":false`, bacalah keterangannya. Biasanya token salah salin,
atau ada spasi yang ikut tersalin.

---

## Langkah 6 — Mencoba

Kembali ke Telegram, cari nama bot Anda, tekan **START**.

Bot harus membalas dalam satu dua detik dengan ucapan selamat datang.

Coba juga:

```
/status
/prediksi
/mitigasi
/lapor ada sampah menumpuk di RT 3
/bantuan
```

---

## Langkah 7 — Memasang menu perintah (opsional, tapi disarankan)

Agar warga melihat daftar perintah saat mengetik garis miring.

1. Buka **@BotFather** lagi.
2. Kirim **`/setcommands`**.
3. Pilih nama bot Anda.
4. Buka berkas `bot/botfather_commands.txt` di proyek, salin seluruh isinya,
   tempel, lalu kirim.

---

## Langkah 8 — Membagikan tautan pendaftaran

Ada **dua tautan berbeda**, dan perbedaannya penting.

| Untuk siapa | Tautan | Yang diterima |
|---|---|---|
| Warga | `https://t.me/NAMA_BOT?start=warga` | Peringatan dengan kalimat sehari-hari dan langkah persiapan |
| Petugas BPBD | `https://t.me/NAMA_BOT?start=bpbd` | Laporan teknis: lokasi, tingkat penyumbatan, perkiraan volume, saran penanganan |

Ganti `NAMA_BOT` dengan nama pengguna bot Anda.

**Bagikan tautan petugas hanya kepada petugas.** Bila warga membukanya, ia
akan menerima laporan teknis yang tidak ia butuhkan.

---

## Bila bot tidak membalas

Buka tautan berikut di peramban, ganti bagian tokennya:

```
https://api.telegram.org/botTOKEN_ANDA/getWebhookInfo
```

Cari baris `last_error_message`, lalu cocokkan dengan tabel ini.

| Yang tertulis | Artinya | Yang harus dilakukan |
|---|---|---|
| `401 Unauthorized` | Kata sandi webhook berbeda | Pastikan `TELEGRAM_WEBHOOK_SECRET` di Vercel sama persis dengan yang dipakai pada Langkah 5 |
| `404 Not Found` | Alamat situs salah | Periksa ejaan alamat, dan pastikan diakhiri `/api/telegram` |
| `500` | Ada yang belum terisi di server | Periksa `SUPABASE_SERVICE_ROLE_KEY` di Vercel |
| kosong, tapi bot diam | Situs belum diterbitkan ulang | Ulangi Langkah 6 dan 7 pada bagian Vercel |

Bila `/status` menjawab "belum ada data", itu bukan kerusakan. Artinya belum
ada pembacaan sensor yang tersimpan. Jalankan `database/data_contoh.sql` bila
Anda ingin mengisinya dengan data peragaan.

---

## Di mana kodenya, kalau saya ingin mengubahnya

| Yang ingin diubah | Berkas |
|---|---|
| Kalimat balasan bot, menambah perintah baru | `frontend/app/api/telegram/route.js` |
| Kalimat peringatan otomatis yang dikirim sistem | `src/agent.py` |
| Daftar perintah yang tampil di menu Telegram | `bot/botfather_commands.txt` |

Setelah mengubah `route.js`, cukup `git push`. Vercel menerbitkan ulang
sendiri, dan bot langsung memakai versi baru. Webhook tidak perlu dipasang
ulang.

---

## Menguji perubahan tanpa menerbitkan ulang

Bila Anda sering mengubah kode bot, mengunggah setiap kali akan melelahkan.
Ada versi Python yang dapat dijalankan di komputer sendiri.

```
pip install -r requirements.txt
python bot/bot_daftar.py
```

Selama versi Python berjalan, **matikan dulu webhook**, karena keduanya tidak
bisa berjalan bersamaan:

```
https://api.telegram.org/botTOKEN_ANDA/deleteWebhook
```

Setelah selesai menguji, pasang kembali dengan tautan `setWebhook` pada
Langkah 5.
