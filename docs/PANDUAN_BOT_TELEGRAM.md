# Panduan Bot Telegram

Menjawab tiga pertanyaan sekaligus: apakah perlu Google Apps Script, bagaimana
bot ditulis, dan bagaimana menjalankannya agar hidup terus tanpa laptop menyala.

---

## Apakah perlu Google Apps Script?

**Tidak.** Apps Script tidak diperlukan sama sekali, dan memakainya justru
menambah satu tempat lagi yang harus Anda urus.

Botnya sudah ditulis dua kali, untuk dua keperluan berbeda:

| Berkas | Bahasa | Cara kerja | Untuk apa |
|---|---|---|---|
| `frontend/app/api/telegram/route.js` | JavaScript | webhook | **Dipakai sehari-hari.** Menumpang situs yang sudah berjalan di Vercel |
| `bot/bot_daftar.py` | Python | long polling | Pengujian di komputer sendiri, dan cadangan bila Vercel bermasalah |

Keduanya memakai basis data yang sama, sehingga pendaftaran lewat mana pun
tercatat di tempat yang sama.

---

## Mengapa webhook, bukan long polling

Long polling berarti program harus terus berjalan, menanyai Telegram berulang
kali: *ada pesan baru? ada pesan baru?* Itu cocok untuk mencoba-coba di
laptop, tetapi bot mati begitu laptop ditutup.

Webhook bekerja terbalik. Telegram yang menghubungi kita setiap ada pesan
masuk. Tidak ada yang perlu terus menyala, jawabannya seketika, dan karena
situs sudah berjalan di Vercel, bot menumpang di sana tanpa tambahan biaya.

```
Warga kirim /status
        │
        ▼
   Telegram  ──POST──►  https://situs-anda.vercel.app/api/telegram
                                      │
                                      ▼
                               baca Supabase
                                      │
                                      ▼
                        balas lewat Telegram Bot API
```

---

## Langkah pemasangan

### 1. Membuat bot

1. Buka Telegram, cari **@BotFather**.
2. Ketik `/newbot`, ikuti pertanyaannya. Nama pengguna bot harus berakhiran `bot`.
3. Simpan token yang diberikan. Bentuknya seperti `1234567890:AAG...`.
4. Cari **@userinfobot**, kirim pesan apa saja. Ia membalas dengan angka ID
   Anda. Simpan sebagai `TELEGRAM_ADMIN_CHAT_ID`.

### 2. Mengisi Environment Variables di Vercel

Buka **Settings → Environment Variables**, lalu isi:

```
TELEGRAM_BOT_TOKEN        = 1234567890:AAG...
TELEGRAM_ADMIN_CHAT_ID    = 123456789
TELEGRAM_WEBHOOK_SECRET   = (buat sendiri, acak)
NEXT_PUBLIC_TELEGRAM_BOT  = nama_bot_anda
```

Membuat kata sandi acak:

```bash
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

Setelah diisi, terbitkan ulang situs, karena Environment Variables hanya
terbaca pada penerbitan berikutnya.

### 3. Mendaftarkan webhook

Buka alamat berikut di peramban, ganti bagian dalam kurung siku:

```
https://api.telegram.org/bot[TOKEN]/setWebhook?url=https://[ALAMAT-SITUS]/api/telegram&secret_token=[WEBHOOK_SECRET]
```

Jawaban yang benar:

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 4. Memeriksa

Kirim `/start` ke bot Anda. Balasan harus muncul dalam satu dua detik.

Bila tidak ada balasan, periksa:

```
https://api.telegram.org/bot[TOKEN]/getWebhookInfo
```

| Isi `last_error_message` | Artinya |
|---|---|
| `Wrong response from the webhook: 401 Unauthorized` | `TELEGRAM_WEBHOOK_SECRET` di Vercel berbeda dengan yang dipakai saat `setWebhook` |
| `Wrong response from the webhook: 404` | Alamat situs salah, atau situs belum diterbitkan |
| kosong, tetapi bot diam | `TELEGRAM_BOT_TOKEN` atau `SUPABASE_SERVICE_ROLE_KEY` belum terisi |

---

## Perintah yang tersedia

| Perintah | Isi |
|---|---|
| `/start` | Mendaftar dan langsung aktif menerima peringatan |
| `/status` | Kondisi saluran terkini beserta artinya |
| `/prediksi` | Ramalan muka air dua belas jam ke depan |
| `/lapor` | Melaporkan sampah, genangan, atau sumbatan |
| `/mitigasi` | Langkah pencegahan sehari-hari dan saat darurat |
| `/berhenti` | Berhenti menerima peringatan |
| `/bantuan` | Daftar perintah |

Untuk memasang menu perintah agar muncul otomatis di Telegram, kirim ke
@BotFather: `/setcommands`, pilih bot Anda, lalu tempelkan isi berkas
`bot/botfather_commands.txt`.

---

## Dua tautan pendaftaran yang berbeda

```
https://t.me/NAMA_BOT?start=warga    → terdaftar sebagai warga
https://t.me/NAMA_BOT?start=bpbd     → terdaftar sebagai petugas
```

Perbedaannya menentukan jenis pesan yang diterima. Warga menerima kalimat
sehari-hari beserta langkah persiapan; petugas menerima laporan teknis berisi
titik lokasi, tingkat penyumbatan, perkiraan volume material, dan saran
penanganan. Warga tidak perlu memilih apa pun, cukup membuka tautan yang benar.

Bagikan tautan petugas hanya kepada petugas.

---

## Mengapa pendaftaran lewat bot langsung aktif

Pendaftaran melalui formulir di situs menunggu konfirmasi kader lebih dulu,
karena siapa pun dapat mengetikkan nomor orang lain di sana.

Lewat bot berbeda: wargalah yang memulai percakapan. Persetujuannya sudah
jelas dengan sendirinya, sehingga tidak perlu dikonfirmasi siapa-siapa.

---

## Menjalankan versi Python untuk pengujian

Berguna bila Anda ingin mencoba perubahan tanpa menerbitkan ulang situs.

```bash
pip install -r requirements.txt
python bot/bot_daftar.py
```

Selama versi Python berjalan, **matikan dulu webhook**, karena keduanya tidak
dapat berjalan bersamaan:

```
https://api.telegram.org/bot[TOKEN]/deleteWebhook
```

Setelah selesai menguji, pasang kembali webhook dengan perintah `setWebhook`
di atas.

---

## Bila ada masalah

| Gejala | Penyebab yang paling sering |
|---|---|
| Bot diam sama sekali | Webhook belum dipasang, atau token salah |
| `/status` menjawab "belum ada data" | Sensor belum terpasang, atau alur GitHub Actions belum pernah berjalan |
| `/prediksi` kosong | Model peramalan belum diunggah ke repositori |
| Pesan masuk dua kali | Webhook dan versi Python berjalan bersamaan. Matikan salah satu |
| Peringatan tidak sampai ke warga | Periksa kolom `aktif` dan `terkonfirmasi` pada tabel `kontak_stakeholder` |
| Pesan uji coba mengejutkan warga | Pakai sasaran "petugas saja" pada halaman simulasi, dan beri tahu pengurus RT lebih dulu |
