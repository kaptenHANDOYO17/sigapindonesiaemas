# Memperbaiki Obrolan Bot, dan Menghapus Pilihan Bahasa

Dua hal pada versi ini: pilihan bahasa dilepas, dan obrolan bot diperbaiki
beserta cara mendiagnosisnya sendiri.

---

## 1. Pilihan bahasa sudah dilepas

Tombol ID, JW, dan EN sudah tidak ada. Seluruh situs kembali ke Bahasa
Indonesia dan warna biru bawaan.

**Tombol terang dan gelap tetap ada**, karena Anda hanya meminta bahasa yang
dilepas.

Berkas kamusnya, `frontend/lib/bahasa.js`, sengaja tidak dihapus. Ia hanya
tidak lagi dipanggil dari mana pun. Bila kelak ingin dipasang kembali, isinya
masih utuh.

---

## 2. Mengapa bot menjawab "tidak bisa mengobrol"

Kalimat itu adalah balasan cadangan yang muncul **setiap kali panggilan ke
Groq gagal**, apa pun sebabnya. Masalahnya, versi lama tidak pernah memberi
tahu sebab sesungguhnya, sehingga Anda tidak punya petunjuk apa pun.

Ada empat sebab yang paling sering:

| Sebab | Cirinya |
|---|---|
| `GROQ_API_KEY` belum diisi di Vercel | Bot langsung menjawab dengan daftar perintah |
| Sudah diisi tapi belum Redeploy | Nilai baru hanya terbaca pada penerbitan berikutnya |
| Nama model sudah dipensiunkan Groq | Groq menolak dengan pesan tentang model |
| Kunci salah salin atau sudah dicabut | Groq menolak dengan galat 401 |

---

## 3. Cara mengetahui persis apa yang salah

Versi ini menyediakan halaman pemeriksa. Setelah Anda unggah pembaruan ini,
buka di peramban:

```
https://sigapindonesiaemas.vercel.app/api/obrolan
```

Halaman ini **benar-benar memanggil Groq** dengan satu pertanyaan pendek, lalu
menampilkan hasilnya apa adanya.

### Bila semuanya baik

```json
{
  "siap": true,
  "model_terpakai": "llama-3.3-70b-versatile",
  "jawaban_uji": "Ya, saya bisa menjawab.",
  "saran": ["Obrolan berjalan normal memakai model llama-3.3-70b-versatile."]
}
```

### Bila ada yang salah

```json
{
  "siap": false,
  "sebab_gagal": "The model `llama-3.1-70b-versatile` has been decommissioned...",
  "model_tersedia": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", ...],
  "saran": ["...", "Model yang tersedia pada akun Anda: ..."]
}
```

Bacalah bagian **`saran`**. Di situ tertulis apa yang perlu Anda kerjakan.

Nilai kunci tidak pernah ditampilkan, hanya ada atau tidaknya, jadi halaman
ini aman dibuka siapa pun.

---

## 4. Yang diperbaiki agar tidak mudah rusak lagi

### Nama model dicoba berurutan

Groq cukup sering memensiunkan model. Dulu, ketika itu terjadi, seluruh
obrolan mati meski kunci Anda masih benar.

Sekarang sistem mencoba beberapa nama model secara berurutan. Bila yang
disetel ditolak, ia menanyakan daftar model yang benar-benar tersedia pada
akun Anda, lalu mencoba lagi. Obrolan tetap jalan tanpa Anda sentuh apa pun.

### Kegagalan dilaporkan ke pengelola

Bila obrolan gagal, **Anda menerima pesan Telegram** berisi sebabnya, beserta
tautan ke halaman pemeriksa. Warga hanya menerima kalimat yang wajar.

Pesan ini dikirim paling sering satu jam sekali untuk galat yang sama, supaya
tidak membanjiri ponsel Anda.

---

## 5. Bot sekarang bisa menjalankan perintah dari obrolan

Warga tidak perlu hafal perintah bergaris miring lagi.

```
Warga : eh coba liat kondisi salurannya dong
Bot   : Bentar ya, tak liatkan.
        [lalu bot otomatis mengirim laporan /status lengkap]

Warga : depan rumahku ada kasur nyumbat selokan, udah dua hari
Bot   : Waduh, dua hari ya. Tak catat sekarang biar petugas tahu.
        [lalu bot otomatis membuat laporan dan meneruskannya ke petugas]
```

Cara kerjanya: model menuliskan penanda tersembunyi di akhir balasan, misalnya
`[AKSI: status]`. Penanda itu dicopot sebelum pesan dikirim, lalu perintahnya
**dijalankan oleh kode, bukan oleh model**.

Pembedaan ini penting. Model hanya boleh menunjuk perintah mana yang cocok; ia
tidak pernah menyentuh basis data secara langsung. Dengan begitu, model yang
keliru paling jauh hanya memanggil perintah yang salah, bukan mengubah data.

Enam perintah yang dapat dipicu dari obrolan: status, prediksi, riwayat,
lokasi, mitigasi, dashboard, dan lapor.

---

## 6. Bot sekarang lebih enak diajak bercerita

Anda meminta bot diberi jiwa seorang pendengar. Yang saya masukkan ke
arahannya:

- Tangkap dulu perasaannya sebelum membahas isinya. Kalau orang cerita capek,
  jangan langsung memberi solusi; akui dulu capeknya
- Pakai kalimat orangnya sendiri saat menanggapi, biar dia merasa didengar
- Tanya terbuka, satu saja per balasan. Jangan menghujani pertanyaan
- Jangan menghakimi, jangan membandingkan dengan orang lain, jangan bilang
  "harusnya kamu..."
- Jangan memaksa ceria. Kalau memang berat, akui saja itu berat
- Baru tawarkan bantuan kalau dia terdengar sudah siap, atau memang minta

### Satu pagar yang tetap saya pasang

Bot **dilarang** mendiagnosis penyakit, menyebut nama obat atau dosis.

Dan bila warga menyinggung soal menyakiti diri sendiri atau terdengar sangat
tertekan, bot diminta tidak menganggapnya bercanda dan **tidak buru-buru
mengalihkan pembicaraan**. Ia tetap di situ, mendengarkan, menyampaikan bahwa
ia peduli, lalu menyarankan bicara dengan orang yang dipercaya, puskesmas,
atau layanan 119 ekstensi 8. Pada balasan semacam itu, bot juga dilarang
memicu perintah apa pun.

Saya menaruh pagar ini karena bot yang enak diajak bercerita justru membuat
kemungkinan percakapan seperti itu lebih besar, bukan lebih kecil.

---

# Langkah mengunggah

## Langkah 1 — Ganti berkas

1. Ekstrak `sigap-drainase.zip` yang baru ke Desktop.
2. **Ctrl + A** lalu **Ctrl + C** di folder hasil ekstrak.
3. Tempel ke folder proyek lama, pilih **Replace the files in the destination**.

Pastikan berkas berikut ada setelah menempel:

```
frontend/lib/groq.js
frontend/app/api/obrolan/route.js
```

## Langkah 2 — Kirim ke GitHub

```
git status --porcelain | Select-String ".env"
```

Harus kosong. Lalu:

```
git add .
git commit -m "Perbaiki obrolan bot, lepas pilihan bahasa"
git push
```

## Langkah 3 — Pastikan kunci Groq ada di Vercel

1. Buka [vercel.com](https://vercel.com) → proyek Anda → **Settings** →
   **Environment Variables**.
2. Periksa apakah `GROQ_API_KEY` ada di daftar.
3. Bila belum ada, buka [console.groq.com](https://console.groq.com) →
   **API Keys** → **Create API Key**, salin, lalu tambahkan di Vercel dengan
   ketiga kotak Production, Preview, dan Development tercentang.

**`GROQ_MODEL` boleh dikosongkan.** Bila kosong, sistem memilih sendiri model
yang tersedia.

## Langkah 4 — Terbitkan ulang

Tab **Deployments** → baris teratas → titik tiga **⋯** → **Redeploy** →
**Redeploy**.

Ini wajib bila Anda baru menambah atau mengubah `GROQ_API_KEY`.

## Langkah 5 — Periksa

1. Buka `https://sigapindonesiaemas.vercel.app/api/obrolan`
2. Lihat `"siap"`. Bila `true`, obrolan sudah jalan.
3. Bila `false`, baca bagian `saran` dan kerjakan yang tertulis di situ.
4. Kirim "halo" ke bot. Harus dijawab dengan kalimat biasa, bukan daftar
   perintah.
5. Coba "coba liat kondisi salurannya dong". Bot harus membalas lalu
   mengirimkan laporan status.

---

# Bila masih bermasalah

Kerjakan berurutan. Berhenti begitu ketemu.

| Langkah | Yang diperiksa | Bila salah |
|---|---|---|
| 1 | Buka `/api/obrolan`, lihat `GROQ_API_KEY` | Bila `false`, kuncinya belum ada di Vercel |
| 2 | Lihat `sebab_gagal` | Bacalah kalimatnya; biasanya sudah menyebutkan sebabnya |
| 3 | Lihat `model_tersedia` | Bila berisi daftar, salin salah satu ke `GROQ_MODEL` |
| 4 | Buka console.groq.com, periksa saldo dan batas pemakaian | Groq punya batas harian pada tingkat gratis |
| 5 | Pastikan sudah Redeploy setelah mengubah variabel | Ini sebab yang paling sering terlewat |
| 6 | Buka `/api/telegram`, lihat bagian `saran` | Bila webhook bermasalah, seluruh bot ikut diam |

### Bila `sebab_gagal` berbunyi tentang model

Salin satu nama dari `model_tersedia`, lalu isikan ke `GROQ_MODEL` di Vercel
dan Redeploy.

### Bila berbunyi 401 atau kunci ditolak

Kunci salah salin, atau sudah dicabut. Buat kunci baru di console.groq.com dan
perbarui di Vercel.

### Bila berbunyi 429

Anda melebihi batas pemakaian Groq untuk saat itu. Tunggu beberapa menit.
Tingkat gratis Groq punya batas per menit dan per hari.

---

# Ringkasan untuk ditempel di meja

```
1. Ekstrak zip → Ctrl+A → Ctrl+C → tempel ke folder lama → Replace
2. git add . → git commit -m "..." → git push
3. Vercel → pastikan GROQ_API_KEY ada (GROQ_MODEL boleh kosong)
4. Vercel → Deployments → Redeploy          ← wajib bila kunci baru diisi
5. Buka /api/obrolan → lihat "siap": true
6. Kirim "halo" ke bot → harus dijawab kalimat biasa
7. Coba "liat kondisi salurannya dong" → bot kirim status otomatis
```
