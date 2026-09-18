# Menggabungkan Model 3D ke Halaman Simulasi

Halaman simulasi di situs Anda sekarang menampilkan model tiga dimensi yang
dapat diputar, dan pengatur di sampingnya menggerakkan model itu secara
langsung.

---

## Jawaban singkat: bisa, dan sudah digabung

| Pertanyaan Anda | Jawaban |
|---|---|
| Bisakah HTML 3D dipakai di halaman simulasi? | Bisa. Sudah terpasang |
| Perlu bikin ulang halamannya? | Tidak |
| Perlu ubah pengaturan Vercel? | Tidak, tidak ada variabel baru |
| Perlu jalankan SQL baru? | Tidak |
| Cukup ganti berkas lalu push? | Ya |

---

## Bagaimana cara kerjanya

Berkas 3D diletakkan di `frontend/public/model3d.html`. Semua yang ada di
folder `public` dapat dibuka langsung lewat alamat situs, sehingga berkas itu
tersedia di `https://alamat-situs-anda/model3d.html`.

Halaman `/simulasi` menampilkannya di dalam bingkai, lalu mengirimkan nilai
ketiga pengatur ke bingkai tersebut setiap kali Anda menggesernya.

```
Anda geser pengatur di halaman /simulasi
        │
        ▼
Halaman menghitung status dengan matriks aturan
        │
        ├──► Panel kanan menampilkan status dan alasannya
        │
        └──► Nilai dikirim ke bingkai 3D
                    │
                    ▼
        Model 3D menaikkan lapisan endapan dan air
```

### Satu hal yang saya jaga

Penilaian status **tidak** dihitung di dalam bingkai 3D, melainkan hanya di
halaman induk. Bingkai hanya menggambar bentuknya.

Alasannya sederhana: bila keduanya sama-sama menghitung, suatu saat mereka
akan memberi jawaban berbeda untuk angka yang sama. Kekeliruan semacam itu
sangat sulit ditelusuri, dan pada sistem yang menyangkut keselamatan tidak
pantas dibiarkan mungkin terjadi.

### Berkas 3D tetap bisa dibuka sendiri

Membuka `model3d.html` tanpa tambahan apa pun akan menampilkan versi lengkap,
beserta panel pengatur dan panel status bawaannya. Versi tersemat hanya aktif
bila alamatnya diberi tambahan `?embed=1`, dan itu dilakukan otomatis oleh
halaman simulasi.

Berguna bila Anda ingin menunjukkan modelnya saja kepada juri, lewat tautan
langsung.

---

## Yang berubah pada situs

### Halaman simulasi

- Ada pilihan **Model 3D** dan **Penampang** di bagian atas hasil penilaian
- Model 3D dapat diputar, diperbesar, dan digeser
- Empat tombol kecil di pojok kanan model: Keterangan, Tanah, Putar, Sudut awal
- Pengiriman notifikasi uji tetap seperti sebelumnya

### Halaman utama

- **Empat kartu jalan pintas** di bawah kartu status: Daftar peringatan,
  Laporkan, Lihat peta, Pahami cara kerjanya. Pengunjung baru langsung tahu
  apa yang bisa dilakukan tanpa membaca seluruh halaman
- **Tangga empat keadaan** yang menjelaskan arti Aman, Waspada, Siaga, dan
  Kritis beserta tindakannya. Keadaan yang sedang berlaku diberi tanda

### Seluruh halaman

- **Menu ponsel**: di layar sempit, tautan disembunyikan di balik satu tombol.
  Sebelumnya enam tautan berjajar memenuhi layar
- Peralihan yang lebih halus saat menekan tombol dan kartu
- Kepala kolom tabel menempel saat digulir, sehingga tetap terbaca di ponsel
- Garis fokus yang jelas bagi yang menelusuri dengan papan tik
- Animasi dimatikan sendiri bagi pengguna yang mengaturnya demikian di
  perangkatnya
- Tampilan cetak yang rapi bila halaman dicetak

---

# Langkah mengunggah

## Langkah 1 — Ganti berkas

1. Ekstrak `sigap-drainase.zip` yang baru ke Desktop.
2. Buka folder hasil ekstrak, tekan **Ctrl + A** lalu **Ctrl + C**.
3. Buka folder proyek lama Anda, tekan **Ctrl + V**.
4. Pilih **Replace the files in the destination**.

Folder `.git` dan berkas `.env` Anda tidak ikut tertimpa.

### Pastikan berkas baru masuk

Periksa apakah berkas dan folder berikut ada di folder proyek Anda:

```
frontend/public/model3d.html
frontend/components/Navigasi.js
```

Bila salah satunya tidak ada, penempelan belum selesai. Ulangi langkah 3.

> Folder `frontend/public` mungkin belum pernah ada sebelumnya. Itu wajar;
> folder itu memang baru dibuat pada versi ini.

## Langkah 2 — Periksa sebelum mengirim

Klik kanan di folder proyek → **Open in Terminal**, lalu:

```
git status --porcelain | Select-String ".env"
```

Harus kosong. Bila muncul nama berkas `.env`, ketik dulu `git rm --cached .env`
sebelum melanjutkan.

## Langkah 3 — Kirim ke GitHub

```
git add .
git commit -m "Gabungkan model 3D ke halaman simulasi dan rapikan tampilan"
git push
```

## Langkah 4 — Tunggu Vercel

1. Buka [vercel.com](https://vercel.com) → proyek Anda → tab **Deployments**.
2. Baris teratas bertuliskan **Building**.
3. Tunggu sampai berubah menjadi **Ready** berwarna hijau, sekitar dua menit.

**Tidak perlu Redeploy manual kali ini**, karena tidak ada Environment
Variable yang ditambahkan.

---

# Memeriksa hasilnya

Periksa berurutan.

| Yang diperiksa | Yang seharusnya terjadi |
|---|---|
| Buka `/simulasi` sebagai pengelola | Muncul model 3D, bukan gambar penampang |
| Geser pengatur tinggi endapan | Lapisan cokelat pada model 3D ikut naik |
| Geser pengatur muka air | Lapisan biru ikut naik, berkas radar memendek |
| Tekan **Penampang** | Berganti ke gambar potongan seperti sebelumnya |
| Tarik model dengan tetikus | Model berputar |
| Gulir di atas model | Model membesar dan mengecil |
| Tekan tombol **Putar** | Model berputar sendiri |
| Buka `/model3d.html` langsung | Muncul versi lengkap dengan panel bawaannya |
| Buka halaman utama | Muncul empat kartu jalan pintas dan tangga empat keadaan |
| Perkecil jendela sampai sempit | Menu berubah menjadi satu tombol garis tiga |

---

# Bila ada masalah

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Bingkai 3D kosong, tulisan "Menyiapkan model" tidak hilang | Berkas `model3d.html` belum terunggah | Periksa apakah ada di `frontend/public/`, lalu push ulang |
| Model muncul tapi tidak ikut berubah saat pengatur digeser | Berkas lama masih tersimpan di peramban | Tekan **Ctrl + Shift + R** untuk memuat ulang tanpa singgahan |
| Model 3D sama sekali tidak muncul | Sambungan internet memblokir cdnjs.cloudflare.com | Coba jaringan lain; berkas Three.js diambil dari sana |
| Menu ponsel tidak terbuka | Berkas `Navigasi.js` belum terunggah | Periksa `frontend/components/`, lalu push ulang |
| Halaman `/simulasi` meminta masuk | Memang begitu. Halaman ini tertutup untuk umum | Masuk melalui `/masuk` |

---

# Menunjukkan model 3D kepada juri

Ada tiga cara, pilih yang paling sesuai keadaan.

| Cara | Tautannya | Cocok untuk |
|---|---|---|
| Di dalam halaman simulasi | `/simulasi`, perlu masuk sebagai pengelola | Memperagakan sistem secara utuh |
| Halaman 3D penuh | `/model3d.html` | Membagikan tautan langsung, tanpa perlu masuk |
| Berkas OBJ | `docs/model3d/sigap_drainase.obj` | Disisipkan ke PowerPoint lewat Insert → 3D Models |

Untuk paparan di hadapan juri, cara kedua biasanya paling aman: tautannya
terbuka, tidak perlu masuk, dan modelnya langsung muncul beserta panel
pengaturnya.

---

# Ringkasan untuk ditempel di meja

```
1. Ekstrak zip → Ctrl+A → Ctrl+C → tempel ke folder lama → Replace
2. Pastikan ada frontend/public/model3d.html
3. git status --porcelain | Select-String ".env"     ← harus kosong
4. git add .
5. git commit -m "Gabungkan model 3D ke halaman simulasi"
6. git push
7. Vercel → Deployments → tunggu Ready
8. Buka /simulasi, geser pengatur, model 3D ikut berubah
```
