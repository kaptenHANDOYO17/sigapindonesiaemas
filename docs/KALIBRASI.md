# Kalibrasi

Sistem ini menerjemahkan jarak yang dibaca radar menjadi kesimpulan tentang
seberapa parah saluran tersumbat. Terjemahan itu bergantung sepenuhnya pada
lima angka yang harus Anda ukur sendiri. Tanpa angka yang benar, sistem tetap
berjalan dan tetap menampilkan persentase, tetapi persentase itu tidak berarti
apa-apa.

---

## 1. Mengukur geometri saluran

Lakukan ketika saluran **kering dan baru dikeruk**. Bawa meteran, penggaris
panjang, dan kertas.

### TINGGI_PASANG_MM
Jarak tegak lurus dari **muka bawah sensor** ke **dasar saluran yang bersih**.

Ukur setelah sensor terpasang permanen. Bila sensor dipindahkan sedikit pun,
angka ini harus diukur ulang.

### KEDALAMAN_SALURAN_MM
Jarak dari **dasar saluran** ke **bibir atas saluran**, yaitu titik di mana air
mulai meluap ke jalan.

Bila kedua sisi saluran berbeda tinggi, pakai yang **lebih rendah**. Air akan
meluap dari sisi itu lebih dulu.

### LEBAR_SALURAN_MM
Lebar dasar saluran. Bila dindingnya miring, ukur di dasar, bukan di bibir.

### PANJANG_SEGMEN_M
Panjang saluran yang Anda anggap diwakili oleh satu sensor. Untuk saluran
permukiman, 30 sampai 60 meter masuk akal.

Angka ini hanya memengaruhi perkiraan volume sampah. Bila setelah beberapa kali
pengerukan ternyata volume sebenarnya selalu lebih besar daripada perkiraan
sistem, naikkan angka ini. Bila selalu lebih kecil, turunkan.

### DEBIT_RANCANGAN_LPM
Debit saat saluran bersih pada hujan sedang, dalam liter per menit.

Cara mengukur paling sederhana: saat hujan sedang berlangsung dan saluran baru
dikeruk, bendung sesaat dengan papan, tampung airnya dengan ember bervolume
diketahui, catat waktunya dengan stopwatch. Ulangi tiga kali, ambil rata-rata.

Bila tidak memungkinkan, mulai dengan perkiraan, lalu perbaiki setelah beberapa
minggu memakai data sensor debit sungguhan: ambil nilai debit tertinggi yang
tercatat saat hujan sedang.

---

## 2. Kalibrasi sensor debit

Sensor debit menghasilkan pulsa. Jumlah pulsa per liter berbeda antar merek dan
berubah menurut ukuran pipa.

1. Siapkan wadah bervolume pasti, misalnya 10 liter.
2. Alirkan air melewati sensor sampai wadah penuh.
3. Catat jumlah pulsa yang terbaca di Serial Monitor.
4. `FAKTOR_KALIBRASI_DEBIT = jumlah_pulsa / (10 liter × 60)`
5. Ulangi tiga kali dengan laju berbeda, ambil rata-rata.

Ubah nilainya di bagian atas `firmware/esp32_drainase/esp32_drainase.ino`.

---

## 3. Kalibrasi pH

Beli larutan penyangga pH 4,00 dan pH 7,00. Harganya murah dan wajib ada.

1. Bilas probe dengan air suling.
2. Celupkan ke larutan pH 7,00, tunggu pembacaan stabil.
3. Selisih antara pembacaan dan 7,00 adalah nilai `PH_OFFSET`.
4. Periksa dengan larutan pH 4,00. Bila selisihnya jauh berbeda, probe perlu
   diganti atau modul perlu dikalibrasi dua titik sesuai petunjuk pabriknya.

Ulangi setiap tiga bulan. Probe pH menua, dan pembacaan yang melenceng akan
membuat dugaan jenis sampah semakin ngawur.

---

## 4. Menyetel ambang batas

Nilai bawaan di `.env` adalah tebakan yang masuk akal, bukan hasil pengukuran
di Mangunharjo.

### Cara yang benar

Kumpulkan data verifikasi lapangan. Setiap kali petugas memeriksa atau
membersihkan saluran, isi formulir di halaman `/verifikasi`, terutama kolom
**tinggi endapan terukur** dan **kondisi sebenarnya**.

Setelah terkumpul minimal lima catatan, jalankan:

```bash
python -m training.retrain
```

Berkas `LAPORAN_LATIH_ULANG.md` akan memuat usulan ambang baru beserta
alasannya. Bahas usulan itu bersama petugas BPBD sebelum mengubahnya.

### Penyetelan sementara sebelum data terkumpul

| Gejala | Tindakan |
|---|---|
| Peringatan terlalu sering, saluran ternyata baik-baik saja | naikkan `AMBANG_ENDAPAN_TINGGI` sebesar 0,05 |
| Genangan terjadi tanpa peringatan sebelumnya | turunkan `AMBANG_ENDAPAN_TINGGI` sebesar 0,05 |
| Status SIAGA muncul terus saat kemarau | turunkan `AMBANG_DEBIT_MENURUN` |
| Sistem baru memperingatkan setelah air masuk rumah | turunkan `AMBANG_AIR_MELUAP` ke 0,75 |

Ubah **satu ambang dalam satu waktu**, lalu amati selama minimal dua minggu.
Mengubah beberapa sekaligus membuat Anda tidak tahu mana yang berpengaruh.

Setiap kali mengubah, jalankan `python -m training.evaluate` dan pastikan sistem
masih cenderung berlebih waspada, bukan meremehkan.

---

## 5. Jadwal pemeriksaan ulang

| Berapa lama sekali | Yang diperiksa |
|---|---|
| Bulanan | Baca `LAPORAN_LATIH_ULANG.md`. Periksa kelengkapan data sensor. |
| Tiga bulan | Kalibrasi ulang probe pH. Periksa panel surya dan baterai. |
| Enam bulan | Ukur ulang geometri saluran. Dasar saluran bisa berubah oleh sedimentasi permanen atau perbaikan. |
| Setiap pengerukan | Isi formulir verifikasi. Ini yang membuat sistem belajar. |
| Setiap sensor dipindahkan | Ukur ulang `TINGGI_PASANG_MM`. Wajib. |
