# Pembaruan: Meteseh, Mode Gelap, Tiga Bahasa, dan Bot Beringatan

Empat perubahan pada versi ini. Semuanya cukup dengan ganti berkas lalu push,
kecuali satu berkas SQL yang harus dijalankan di Supabase.

---

## Ringkasan perubahan

| Perubahan | Perlu SQL? | Perlu variabel baru? |
|---|---|---|
| Seluruh teks pindah ke Meteseh | tidak | tidak |
| Mode terang dan gelap | tidak | tidak |
| Tiga bahasa dengan tema berbeda | tidak | tidak |
| Bot mengingat percakapan | **ya** | tidak |

---

# 1. Teks sudah pindah ke Meteseh

Seluruh penyebutan Mangunharjo dan Kecamatan Tugu sudah diganti. Yang juga
diperbarui, bukan sekadar namanya:

- **Jumlah penduduk**: dari 2.406 KK / 7.177 jiwa menjadi **24.195 jiwa di 31
  RW dan 195 RT**, sesuai data Kelurahan Meteseh
- **Anggaran**: dari Rp 13.269.000 menjadi **Rp 18.018.000**
- **Riwayat banjir**: tabel baru di halaman Tentang Sistem berisi empat
  kejadian nyata di Meteseh, bukan kejadian Mangunharjo
- **Penyebab**: semula menyebut Sungai Plumbon dan Kali Babon, kini menyebut
  **tanggul Kali Tunggu** yang jebol pada 11 Desember 2024

Ditambahkan juga kotak sorotan yang mengutip pernyataan BPBD Kota Semarang
pada kejadian 16 Februari 2026, bahwa sistem drainase tidak mampu menampung
debit air. Pernyataan itu memperkuat alasan program ini ada.

---

# 2. Mode terang dan gelap

Di kanan atas, sebelah pilihan bahasa, ada tombol bulan dan matahari. Tekan
untuk berganti.

Pilihan Anda tersimpan di peramban masing-masing pengunjung, jadi tidak saling
memengaruhi. Bila pengunjung belum pernah memilih, sistem mengikuti pengaturan
perangkatnya: ponsel yang disetel mode gelap akan langsung membuka halaman
dalam mode gelap.

---

# 3. Tiga bahasa, tiga tema

Tiga tombol kecil di kanan atas: **ID**, **JW**, **EN**. Memilih bahasa
sekaligus mengganti suasana warna halaman.

| Bahasa | Tema | Warna pokok |
|---|---|---|
| Indonesia | Merah putih | Merah bendera |
| Jawa | Batik sogan | Cokelat, dengan motif tenun halus di latar |
| English | Bawaan | Biru seperti versi awal |

Tema Jawa memakai motif tenun yang dibuat dari gradasi, bukan berkas gambar,
sehingga tidak memperlambat halaman sama sekali.

Bahasa Jawa yang dipakai adalah ragam **ngoko** yang lazim di Semarang, bukan
krama inggil, karena pembacanya adalah tetangga sendiri.

## Yang perlu Anda ketahui soal cakupan terjemahan

**Yang sudah diterjemahkan penuh:** menu, tombol, nama keempat status beserta
arti dan tindakannya, empat kartu jalan pintas di beranda, dan keterangan
keadaan data.

**Yang masih Bahasa Indonesia:** uraian panjang di halaman Tentang Sistem dan
sebagian keterangan teknis.

Ini disengaja. Menerjemahkan uraian panjang setengah-setengah, apalagi ke
Bahasa Jawa, lebih membingungkan daripada membiarkannya utuh dalam satu
bahasa. Bila Anda ingin melengkapinya, seluruh teks terkumpul di satu berkas:
`frontend/lib/bahasa.js`. Tinggal tambahkan barisnya dengan pola yang sama.

---

# 4. Bot sekarang mengingat percakapan

## Yang berubah

Sebelumnya setiap pesan diperlakukan sebagai percakapan baru. Warga yang
bertanya "terus gimana?" dijawab seolah pertanyaan itu muncul entah dari mana.

Sekarang bot mengingat **sepuluh giliran terakhir**, sehingga obrolan
nyambung.

```
Warga : saluran depan rumahku gimana?
Bot   : Sekarang Waspada. Endapannya sekitar 38 persen, tapi airnya
        masih mili lancar.
Warga : terus aku kudu piye?
Bot   : Belum perlu apa-apa kok. Cuma jangan buang sampah ke kalen
        dulu ya, sama bersihin daun di mulut saluran depan rumah.
```

Warga bisa menghapus ingatannya sendiri dengan mengetik **`/lupakan`**.

Percakapan lebih lama dari tiga puluh hari dihapus otomatis. Menyimpan obrolan
warga selamanya tidak berguna bagi sistem, dan hanya menambah risiko bila
suatu saat basis data bocor.

## Bot sekarang bisa diajak ngobrol soal apa saja

| Topik | Contoh pertanyaan |
|---|---|
| Sistem ini sendiri | "sensornya cara kerjanya gimana sih?" |
| Kondisi saluran | "sekarang aman nggak?" |
| Semarang | "besok Tembalang hujan nggak ya?" |
| Kesehatan lingkungan | "abis banjir, gimana cegah jentik nyamuk?" |
| Keselamatan | "listrik harus dimatiin nggak kalau banjir?" |
| Curhat | "capek banget hari ini" |
| Pengingat | "ingetin aku besok bersihin selokan" |

Gayanya santai, kadang menyelipkan kata Jawa yang lazim di Semarang.

## Pagar pengaman yang tetap dipasang

Bot dilarang mengarang angka kondisi saluran, membuat ramalan sendiri,
memutuskan apakah warga harus mengungsi, mendiagnosis penyakit, menyebut nama
obat, atau menjanjikan kapan petugas datang.

Untuk keluhan sakit, ia mengarahkan ke puskesmas. Untuk keadaan darurat, ke
nomor 112.

Satu hal yang saya tambahkan khusus: **bila warga bicara soal menyakiti diri
sendiri atau terdengar sangat tertekan, bot tidak boleh menganggapnya
bercanda.** Ia diminta mendengarkan dengan serius dan menyarankan bicara
dengan orang yang dipercaya, puskesmas, atau layanan 119 ekstensi 8. Obrolan
santai membuat kemungkinan itu lebih besar, bukan lebih kecil, jadi pagar ini
perlu ada sejak awal.

Yang tetap **tidak** memakai model bahasa: penilaian status saluran dan
kalimat peringatan otomatis. Keduanya memakai matriks aturan dan templat
tetap.

---

# Langkah mengunggah

## Langkah 1 — Ganti berkas

1. Ekstrak `sigap-drainase.zip` yang baru ke Desktop.
2. Buka folder hasil ekstrak, **Ctrl + A** lalu **Ctrl + C**.
3. Buka folder proyek lama Anda, **Ctrl + V**.
4. Pilih **Replace the files in the destination**.

Pastikan berkas berikut ada setelah menempel:

```
frontend/lib/bahasa.js
frontend/components/Setelan.js
database/migrasi_obrolan.sql
```

## Langkah 2 — Jalankan SQL di Supabase

**Ini satu-satunya bagian yang tidak bisa dilewati.** Tanpa ini, bot tetap
menjawab tetapi tidak akan mengingat apa pun.

1. Buka [supabase.com](https://supabase.com) → proyek Anda.
2. Menu kiri → **SQL Editor** → **New query**.
3. Buka `database/migrasi_obrolan.sql` dengan Notepad, salin seluruhnya.
4. Tempel, tekan **Run**. Harus muncul **Success**.

Untuk memeriksa, jalankan:

```sql
select count(*) from riwayat_obrolan;
```

Harus menjawab `0`, bukan pesan galat.

## Langkah 3 — Kirim ke GitHub

```
git status --porcelain | Select-String ".env"
```

Harus kosong. Lalu:

```
git add .
git commit -m "Pindah ke Meteseh, mode gelap, tiga bahasa, bot beringatan"
git push
```

## Langkah 4 — Pasang menu perintah baru di BotFather

Ada satu perintah baru, `/lupakan`.

1. Buka Telegram, cari **@BotFather**.
2. Kirim **`/setcommands`**, pilih bot Anda.
3. Salin seluruh isi `bot/botfather_commands.txt`, tempel, kirim.

## Langkah 5 — Tunggu Vercel

Tab **Deployments**, tunggu sampai **Ready** berwarna hijau. Tidak perlu
Redeploy manual, karena tidak ada Environment Variable baru.

---

# Memeriksa hasilnya

| Yang diperiksa | Yang seharusnya terjadi |
|---|---|
| Tekan tombol **JW** di kanan atas | Menu berubah Bahasa Jawa, warna jadi cokelat batik |
| Tekan tombol **EN** | Menu Bahasa Inggris, warna kembali biru |
| Tekan tombol **ID** | Bahasa Indonesia, warna merah putih |
| Tekan tombol bulan | Halaman berubah gelap |
| Muat ulang halaman | Pilihan bahasa dan mode tetap tersimpan |
| Buka `/tentang` | Muncul tabel riwayat banjir Meteseh, bukan Mangunharjo |
| Kirim pesan ke bot, lalu kirim lagi "terus gimana?" | Bot menyambung, bukan mengulang perkenalan |
| Ketik `/lupakan` | Bot menjawab ingatannya sudah dihapus |

---

# Bila ada masalah

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Bot menjawab tapi tidak nyambung | `migrasi_obrolan.sql` belum dijalankan | Jalankan di SQL Editor |
| Tombol bahasa tidak muncul | `Setelan.js` belum terunggah | Periksa `frontend/components/`, push ulang |
| Warna tidak berubah saat ganti bahasa | Berkas lama tersimpan di peramban | Tekan **Ctrl + Shift + R** |
| Mode gelap kembali terang saat muat ulang | Peramban menolak penyimpanan lokal | Matikan mode penyamaran, atau izinkan penyimpanan situs |
| Masih ada tulisan Mangunharjo | Penempelan berkas belum lengkap | Ulangi Langkah 1 |

---

# Ringkasan untuk ditempel di meja

```
1. Ekstrak zip → Ctrl+A → Ctrl+C → tempel ke folder lama → Replace
2. Supabase SQL Editor → jalankan migrasi_obrolan.sql      ← wajib
3. git add . → git commit -m "..." → git push
4. BotFather → /setcommands → tempel isi botfather_commands.txt
5. Vercel → Deployments → tunggu Ready
6. Coba tombol ID / JW / EN dan tombol bulan di kanan atas
7. Ngobrol dua kali dengan bot, pastikan nyambung
```
