# Model 3D Pemasangan SIGAP Drainase

Isi folder ini dan cara memakainya.

| Berkas | Isinya | Dibuka dengan |
|---|---|---|
| `situs_3d_sigap_drainase.html` | Situs 3D interaktif | Klik dua kali, terbuka di peramban |
| `sigap_drainase.obj` | Model 3D | Blender, Windows 3D Viewer, PowerPoint |
| `sigap_drainase.mtl` | Warna bahan untuk model OBJ | Otomatis terbaca bersama OBJ |
| `3D_1_Tampak_Umum.png` | Gambar keseluruhan pemasangan | Untuk proposal dan presentasi |
| `3D_2_Tampak_Potongan.png` | Potongan melintang bak kontrol | Untuk menjelaskan letak sensor |
| `3D_3_Tampak_Atas.png` | Tampak dari atas | Untuk menjelaskan tata letak |
| `3D_4_Sorot_Sensor.png` | Menyorot keempat perangkat saja | Untuk halaman spesifikasi |

---

## Membuka situs 3D

Klik dua kali `situs_3d_sigap_drainase.html`. Tidak perlu internet, tidak
perlu memasang apa pun.

| Yang dilakukan | Caranya |
|---|---|
| Memutar | Tekan dan geser dengan tetikus |
| Memperbesar | Gulir tetikus, atau cubit dua jari di layar sentuh |
| Menggeser | Klik kanan sambil geser, atau tahan Shift sambil geser |
| Mengubah keadaan | Geser tiga pengatur di panel kiri |
| Mencoba contoh | Tekan salah satu dari empat tombol contoh keadaan |

Ketika Anda menggeser pengatur, tinggi endapan dan muka air pada model ikut
berubah, dan status di panel kanan dihitung memakai matriks aturan yang sama
dengan yang berjalan di lapangan.

### Menaruh situs 3D di dalam situs utama

Salin berkas HTML ini ke folder `frontend/public/` pada proyek Anda, lalu
unggah ke GitHub seperti biasa. Setelah terbit, alamatnya menjadi:

```
https://sigapindonesiaemas.vercel.app/situs_3d_sigap_drainase.html
```

Tautkan dari halaman Tentang Sistem agar juri dapat membukanya.

---

## Membuka model OBJ

### Windows 3D Viewer
Klik kanan `sigap_drainase.obj` → Open with → 3D Viewer.

### PowerPoint
Insert → 3D Models → This Device → pilih `sigap_drainase.obj`.
Model dapat diputar langsung di dalam slide.

### Blender
File → Import → Wavefront (.obj).

> Berkas `.mtl` harus berada di folder yang sama dengan `.obj`, kalau tidak
> modelnya akan terbuka tanpa warna.

---

## Ukuran yang dipakai

Model mengikuti nilai bawaan titik MTS-01. Bila hasil pengukuran di lapangan
berbeda, ubahlah pada berkas `model3d.py` lalu jalankan ulang.

| Bagian | Ukuran |
|---|---|
| Kedalaman saluran | 80 cm |
| Lebar dasar saluran | 60 cm |
| Tebal dinding beton | 15 cm |
| Tinggi pasang sensor ke dasar | 120 cm |
| Panjang bak kontrol | 220 cm |

---

## Yang perlu disadari

**Model ini digambar sebagai potongan.** Tanah, jalan, dan dinding di sisi
depan sengaja dihilangkan agar isi saluran terlihat. Pada kenyataannya
seluruh bagian itu tertutup rapat dan tertimbun tanah.

**Bentuk perangkat digambar mendekati, bukan meniru persis.** Sensor radar,
sensor debit, dan modul pH digambar sebagai bentuk sederhana yang ukuran dan
letaknya benar. Untuk bentuk fisik yang sebenarnya, lihat lembar data dari
pabrikannya.

**Ketinggian endapan dan air pada gambar hanyalah contoh.** Nilai sebenarnya
berubah setiap lima belas menit mengikuti pembacaan sensor.
