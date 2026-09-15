# Keterbatasan Sensor Radar

Berkas ini dirujuk dari `src/rules.py`. Isinya menjelaskan mengapa tinggi
endapan tidak diukur langsung, dan apa akibatnya.

---

## Apa yang sebenarnya diukur radar

VEGAPULS Air 23 memancarkan gelombang 80 GHz lurus ke bawah dan mengukur waktu
pantulnya. Yang dilaporkan adalah **jarak ke permukaan pertama yang
memantulkan**.

Di dalam saluran drainase, permukaan itu bisa berupa:

- permukaan **air**, bila saluran sedang berair;
- permukaan **endapan**, bila saluran sedang kering;
- permukaan **sampah mengambang**, bila ada tumpukan plastik di atas air.

Radar tidak membedakan ketiganya. Ia hanya melaporkan satu angka jarak.

---

## Bagaimana endapan disimpulkan

Karena radar tidak bisa melihat menembus air, sistem memakai penalaran berikut:

> Saat tidak hujan selama beberapa jam, saluran yang sehat akan hampir kering.
> Permukaan yang terbaca pada saat itu adalah dasar saluran yang sedang berlaku,
> yaitu dasar asli ditambah endapan yang menumpuk di atasnya.

Pelaksanaannya ada di fungsi `dasar_terbaca()` pada `src/features.py`:

1. Tandai waktu-waktu ketika curah hujan enam jam terakhir di bawah 0,5 mm.
2. Ambil pembacaan permukaan pada waktu-waktu itu saja.
3. Ambil persentil kesepuluh dari kumpulan itu dalam jendela lima hari terakhir.

Persentil dipakai, bukan nilai minimum, supaya satu pembacaan salah tidak
langsung menggeser taksiran. Jendela lima hari dipilih lewat pengujian: jendela
lebih panjang membuat taksiran tertinggal di belakang endapan yang sedang
menumpuk, jendela lebih pendek membuatnya goyah.

---

## Akibat yang harus disadari

### 1. Taksiran meleset rata-rata 28 mm

Pada pengujian terhadap data sintetis, selisih antara taksiran dan nilai
sebenarnya rata-rata 28 mm, atau sekitar 3,5 persen dari kedalaman saluran
80 cm. Untuk keperluan peringatan, ketelitian ini memadai.

### 2. Sesaat setelah pengerukan, taksiran masih tinggi

Karena jendela lima hari, taksiran butuh beberapa hari untuk turun setelah
saluran dibersihkan. Selama masa itu sistem melaporkan endapan yang sebenarnya
sudah tidak ada.

Arah kesalahannya aman: sistem terlalu waspada, bukan meremehkan. Tetapi
petugas perlu tahu supaya tidak kehilangan kepercayaan.

**Cara menghindarinya:** isi formulir verifikasi segera setelah pengerukan,
dan centang "sudah dibersihkan".

### 3. Musim hujan panjang membuat taksiran mandek

Bila tidak ada periode kering selama berhari-hari, tidak ada pembacaan baru yang
memenuhi syarat, sehingga taksiran memakai nilai lama. Padahal justru di musim
hujan endapan menumpuk paling cepat.

Ini keterbatasan yang belum ada jalan keluarnya dalam rancangan sekarang.

### 4. Genangan diam terbaca sebagai endapan

Bila ada sumbatan di hilir, air akan menggenang di belakangnya dan tidak surut
meski tidak hujan. Radar membaca genangan itu sebagai "dasar yang naik", dan
sistem menyimpulkannya sebagai endapan.

Untuk keperluan peringatan hal ini justru menguntungkan: keduanya sama-sama
perlu ditangani. Tetapi **perkiraan volume material menjadi salah**, karena yang
dihitung sebenarnya air.

---

## Jalan keluar yang tersedia

### Menambah sensor tekanan hidrostatik

Sensor tekanan yang dipasang di dasar saluran mengukur **kedalaman kolom air di
atasnya**. Digabungkan dengan radar yang mengukur permukaan, tinggi endapan bisa
**dihitung**, bukan ditaksir:

```
tinggi endapan = (tinggi pasang − jarak radar) − kedalaman kolom air
```

Ini jalan keluar yang paling tepat, dan sebaiknya masuk rencana pengembangan
tahun kedua.

### Menambah kamera

Kamera tidak menyelesaikan persoalan pengukuran, tetapi memungkinkan
verifikasi visual: petugas bisa melihat apa yang sebenarnya menyumbat sebelum
berangkat, dan jenis sampah bisa dikenali jauh lebih baik daripada lewat dugaan
berbasis pH.

### Menambah titik pantau

Satu sensor tidak bisa mewakili saluran sepanjang puluhan meter. Menambah titik
mengurangi risiko sumbatan yang lolos karena berada jauh dari sensor.
