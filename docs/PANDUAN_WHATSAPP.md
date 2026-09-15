# Panduan WhatsApp Business Cloud API

Dirujuk dari `src/agent.py`. Bagian ini **opsional**. Bila dilewati, notifikasi
tetap berjalan lewat Telegram.

---

## Mengapa tidak bisa langsung kirim

WhatsApp membedakan dua jenis pesan:

1. **Balasan dalam 24 jam.** Bila pengguna mengirim pesan lebih dulu, Anda boleh
   membalas bebas selama 24 jam.
2. **Pesan yang Anda mulai sendiri.** Di luar jendela itu, Anda **hanya boleh**
   mengirim pesan yang mengikuti templat yang sudah disetujui Meta.

Peringatan bencana selalu masuk kategori kedua: sistem menghubungi warga tanpa
didahului percakapan. Karena itu templat wajib didaftarkan lebih dulu.

---

## Langkah pendaftaran

1. Buat akun di **developers.facebook.com**.
2. Buat aplikasi baru bertipe **Business**.
3. Tambahkan produk **WhatsApp**.
4. Di bagian **API Setup**, catat **Phone number ID** dan **Temporary access token**.
   Token sementara hanya berlaku 24 jam; untuk produksi buat **System User token**
   yang permanen lewat Business Manager.
5. Buka **WhatsApp Manager → Message Templates → Create Template**.

---

## Dua templat yang perlu dibuat

### Templat warga

- Nama: `sigap_peringatan_warga`
- Kategori: **UTILITY**
- Bahasa: Indonesian (id)
- Isi badan:

```
Peringatan {{1}} untuk saluran {{2}}.

{{3}}

Ikuti arahan BPBD dan aparat setempat. Balas BERHENTI untuk berhenti menerima pesan ini.
```

### Templat petugas

- Nama: `sigap_laporan_bpbd`
- Kategori: **UTILITY**
- Bahasa: Indonesian (id)
- Isi badan:

```
Laporan otomatis SIGAP Drainase.

Status: {{1}}
Lokasi: {{2}}

{{3}}

Rincian lengkap tersedia di dasbor.
```

Ketiga `{{n}}` itu diisi otomatis oleh `src/agent.py` dengan status, nama
saluran, dan alasan penilaian.

---

## Hal yang membuat templat ditolak

- Kategori **MARKETING** untuk pesan yang sifatnya layanan. Pilih **UTILITY**.
- Kalimat yang bernada promosi.
- Terlalu banyak variabel dibandingkan teks tetapnya.
- Variabel di awal atau akhir pesan tanpa teks pengapit.
- Tidak ada cara berhenti berlangganan.

Persetujuan biasanya keluar dalam beberapa menit sampai beberapa hari.

---

## Mengaktifkan di sistem

Setelah templat disetujui, isi di GitHub Secrets:

```
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
```

Lalu pada tabel `kontak_stakeholder`, ubah kolom `kanal` menjadi `whatsapp` atau
`keduanya`, dan pastikan kolom `nomor_kontak` terisi.

Sistem mengubah format `08xxx` menjadi `628xxx` secara otomatis.

---

## Biaya

Meta menagih per percakapan, bukan per pesan. Kategori UTILITY di Indonesia
tarifnya relatif murah, tetapi tetap berbayar setelah kuota gratis bulanan
habis. Untuk 1.000 warga dengan peringatan beberapa kali sebulan, biayanya perlu
dimasukkan ke RAB.

Telegram sepenuhnya gratis tanpa batas. Pertimbangkan memakai Telegram sebagai
saluran utama dan WhatsApp hanya untuk petugas BPBD yang jumlahnya sedikit.
