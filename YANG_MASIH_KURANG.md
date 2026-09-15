# Yang Masih Kurang

Daftar ini ditulis sejujur mungkin. Bagian-bagian di bawah ini adalah hal yang
**belum bisa dilakukan sistem**, atau **sudah dilakukan tetapi hasilnya belum
layak dipercaya**. Anda perlu mengetahui semuanya sebelum menyerahkan proposal,
karena juri lomba dan petugas BPBD akan menanyakan hal-hal ini.

Menyembunyikan kekurangan hanya akan menunda masalah sampai tahap survei
lapangan, dan di titu keadaannya jauh lebih merugikan.

---

## A. Keterbatasan yang melekat pada sensor

### A1. Radar tidak bisa melihat menembus air

Ini keterbatasan paling mendasar, dan tidak bisa diperbaiki dengan kode.

VEGAPULS Air 23 memantulkan gelombang ke **permukaan pertama** yang ditemuinya.
Ketika saluran berair, yang terbaca adalah permukaan air, bukan endapan di
bawahnya. Artinya sistem **tidak pernah mengukur tinggi endapan secara
langsung**.

Yang dilakukan sistem adalah menyimpulkan: mengambil permukaan terendah yang
terbaca selama periode kering, lalu menganggapnya sebagai dasar saluran yang
sedang berlaku. Cara ini sah dan lazim, tetapi konsekuensinya nyata:

- Selama musim hujan panjang tanpa periode kering, taksiran endapan **berhenti
  diperbarui** dan memakai nilai lama.
- Pada pengujian, taksiran ini meleset rata-rata **28 mm** dari nilai
  sebenarnya (sekitar 3,5 persen kedalaman saluran 80 cm). Sesaat setelah
  pengerukan, kesalahannya jauh lebih besar karena taksiran butuh beberapa hari
  untuk turun mengikuti kenyataan.

**Perbaikan yang mungkin:** menambahkan sensor tekanan hidrostatik di dasar
saluran. Kombinasi radar (permukaan air) dan sensor tekanan (kedalaman kolom
air) memungkinkan tinggi endapan dihitung, bukan ditaksir. Biayanya bertambah,
tetapi inilah satu-satunya cara mengukur endapan dengan benar.

### A2. Sistem tidak bisa membedakan endapan dari genangan di belakang sumbatan

Keduanya sama-sama terlihat sebagai "dasar saluran yang naik" oleh radar saat
kondisi kering. Sistem akan melaporkan keduanya sebagai endapan tinggi.

Untungnya keduanya sama-sama perlu ditangani, jadi peringatan yang keluar tetap
berguna. Tetapi **perkiraan volume material menjadi salah** pada kasus genangan,
karena yang dihitung adalah air, bukan sampah. Petugas yang datang membawa
karung dan cangkul untuk 9 m³ material bisa mendapati saluran yang sebenarnya
hanya tergenang.

### A3. Satu sensor hanya mewakili satu titik

Endapan di saluran tidak pernah rata. Sumbatan bisa berada 20 meter dari sensor
dan tidak terdeteksi sama sekali, atau sebaliknya, sensor terpasang tepat di
titik terburuk sehingga sistem melebih-lebihkan kondisi keseluruhan.

Perkiraan volume memakai asumsi bahwa tinggi endapan di titik sensor mewakili
seluruh segmen 50 meter. Asumsi ini **hampir pasti keliru**. Itulah sebabnya
keluaran volume disertai rentang 0,6 sampai 1,5 kali, dan itulah sebabnya
laporan ke BPBD selalu menutup dengan kalimat bahwa kondisi sebenarnya dapat
berbeda.

---

## B. Bagian AI yang belum terbukti

### B1. Isolation Forest praktis tidak berguna untuk menilai bahaya

Ini temuan paling penting, dan diperoleh dari menjalankan kode sungguhan, bukan
dari dugaan.

Pada data uji, model anomali hanya menangkap **4 persen** kejadian sumbatan,
sementara membunyikan alarm palsu pada **5,8 persen** kondisi normal. Artinya
model ini **tidak lebih baik daripada menebak acak**.

Penyebabnya bukan bug, melainkan sesuatu yang mendasar: Isolation Forest
mendeteksi **kejarangan**, bukan **bahaya**. Di saluran yang memang sering
tersumbat, kondisi tersumbat bukanlah hal yang jarang, sehingga model
menganggapnya normal.

Justru karena inilah sistem dirancang dengan aturan bahwa **model hanya boleh
menaikkan status satu tingkat, dan tidak pernah boleh menyatakan aman**. Yang
benar-benar bekerja adalah matriks aturan, bukan modelnya.

**Yang sudah dilakukan untuk mengatasinya.** Isolation Forest tidak lagi dipakai
menilai bahaya. Perannya digantikan model terawasi yang dilatih pada pasangan
pembacaan sensor dan kondisi sebenarnya dari simulator. Pada seed uji yang belum
pernah dilihat, model itu menangkap 94 persen kondisi berbahaya dengan alarm
palsu 1,3 persen. Isolation Forest dipindahkan ke pekerjaan yang memang cocok
baginya, yaitu menandai pembacaan sensor yang menyimpang sebagai gejala
kerusakan alat.

Meski begitu, wewenang model tetap dibatasi hanya boleh menaikkan status.
Alasannya ada di bagian B2 di bawah: seluruh angka itu masih berasal dari
simulator buatan sendiri.

### B2. Angka evaluasi berasal dari simulator, bukan lapangan

Ini keterbatasan yang paling penting, dan tidak hilang meski angkanya membaik.

Angka yang bisa Anda sebutkan sekarang:

| Ukuran | Hasil |
|---|---|
| Penilaian tepat | 92,3 persen |
| Kondisi berbahaya tertangkap | 96,2 persen |
| Alarm palsu | 5,3 persen |
| Kondisi KRITIS yang terbaca AMAN | 0,00 persen |
| Kurang waspada | 1,1 persen |

Diukur dengan protokol latih / validasi / uji pada 18 saluran bergeometri
berbeda. Data uji dibuka satu kali di akhir, memuat 1.159 baris berbahaya.

**Semua angka ini dihitung terhadap data buatan dari simulator**, bukan terhadap
saluran sungguhan di Mangunharjo.

Dua kekeliruan metode pernah membuat angka terlihat lebih bagus daripada
kenyataannya, dan keduanya sudah diperbaiki. Pertama, ambang keputusan pernah
disetel sambil melihat data uji, sehingga data uji berhenti menjadi data uji.
Kedua, pembagian acak pernah menghasilkan saluran uji yang sama sekali tidak
punya kejadian berbahaya, dan angka "bahaya tertangkap 100 persen" yang muncul
saat itu kosong artinya. Sekarang pembagian dilakukan berstrata dan jumlah
kejadian selalu dilaporkan bersama persentasenya. Simulator itu dibangun dari persamaan aliran
saluran terbuka dan sudah berperilaku wajar, tetapi ia tetap buatan sendiri.
Menguji model pada simulator yang kita rancang sendiri punya risiko melingkar:
model bisa saja hanya pandai menebak kebiasaan simulator.

Sebutkan angka-angka itu **selalu disertai keterangan bahwa sumbernya data
sintetis**. Bila disebut sebagai capaian lapangan, klaim itu akan runtuh pada
tahap verifikasi.

### B3. Model ramalan LSTM galatnya masih besar di jam-jam akhir

Model sudah ada dan fitur prediksi 12 jam kini hidup. Galatnya:

| Rentang | Galat rerata |
|---|---|
| 3 jam pertama | 27,9 mm |
| Jam ke-12 | 65,1 mm |
| Keseluruhan | 53,7 mm |
| Pembanding: tebakan naif | 75,1 mm |

Model mengalahkan tebakan naif sebesar 28,5 persen, tetapi galat 65 mm pada
jam kedua belas setara 8 persen kedalaman saluran. Artinya ramalan jam-jam akhir hanya layak
dipakai sebagai isyarat kasar, bukan sebagai dasar keputusan evakuasi. Bagian
yang paling dapat dipercaya adalah tiga jam pertama.

### B4. Dugaan jenis sampah dari pH sangat lemah

Ini bagian paling rapuh di seluruh sistem, dan sebaiknya Anda sampaikan sendiri
sebelum juri menemukannya.

Penalarannya masuk akal secara kimia: sampah organik yang membusuk menghasilkan
asam sehingga pH turun. Tetapi pH air saluran permukiman juga dipengaruhi
limbah cucian, air sabun, deterjen, intrusi air laut (Mangunharjo berada di
pesisir), dan hujan asam. Semua faktor itu bisa menggeser pH lebih besar
daripada pengaruh sampah organik.

Karena itu keyakinan keluarannya sengaja dibatasi maksimal **0,45**, dan
kalimatnya selalu ditutup dengan "perlu diperiksa langsung oleh petugas". Bila
setelah beberapa bulan verifikasi menunjukkan dugaan ini sering meleset,
**matikan saja fiturnya**. Keterangan yang menyesatkan lebih buruk daripada
tidak ada keterangan.

### B5. Belum ada data verifikasi, sehingga ambang masih menebak

Seluruh ambang batas di `.env` (endapan 30 persen, 55 persen, debit 60 persen,
30 persen) adalah **angka tebakan yang masuk akal**, bukan hasil pengukuran di
Mangunharjo.

Ambang yang benar hanya bisa ditemukan dengan cara membandingkan penilaian
sistem terhadap temuan petugas di lapangan, berulang kali, selama beberapa
bulan. Mekanismenya sudah dibangun (halaman verifikasi, tabel
`verifikasi_lapangan`, skrip `retrain.py`), tetapi **datanya belum ada**.

Sampai terkumpul minimal lima verifikasi, pelatihan ulang bulanan hanya
memperbarui model, tidak memperbaiki ambang.

---

### B6. Curah hujan pendorong simulasi masih buatan sampai Anda mengunduhnya

Simulator sudah disiapkan memakai curah hujan sungguhan Mangunharjo, tetapi
berkasnya harus Anda unduh sendiri dengan `python datasets/unduh_data_asli.py`.
Lingkungan tempat proyek ini disusun tidak dapat menjangkau API cuaca, sehingga
angka yang dilaporkan sekarang masih memakai hujan buatan.

Mengunduh data asli mengubah pendorong simulasi menjadi cuaca Semarang yang
sebenarnya, termasuk pola musim dan hujan ekstrem yang pernah terjadi. Itu
perbaikan besar. Namun perlu ditegaskan: **labelnya tetap berasal dari model
fisika, bukan dari pengukuran lapangan.** Jangan menyebut model ini "dilatih
pada data asli" dalam proposal.

## C. Hal yang belum dibangun sama sekali

### C1. Tidak ada kamera

Arsitektur yang Anda tetapkan murni berbasis sensor. Akibatnya tidak ada cara
memverifikasi secara visual apa yang sebenarnya menyumbat saluran. Petugas
menerima laporan "diduga sampah organik, 9 m³" tanpa bisa melihat apa pun
sebelum berangkat.

Menambahkan satu kamera bertenaga surya akan mengubah ini secara besar, dan
membuka jalan untuk deteksi jenis sampah berbasis citra yang jauh lebih
terpercaya daripada dugaan berbasis pH.

### C2. Hanya satu titik pantau

Sistem sekarang memantau satu saluran. Mangunharjo punya 5 RW dan 30 RT, dengan
genangan Januari 2026 yang menerjang RT 1 sampai 6. Satu sensor tidak mewakili
kelurahan.

Kode sudah menyiapkan kolom `saluran_id` di semua tabel, sehingga penambahan
titik tidak memerlukan perombakan. Tetapi pipeline saat ini hanya memproses satu
saluran per jalan.

### C3. Belum ada penyaringan notifikasi per wilayah

Semua warga terdaftar menerima peringatan yang sama, meskipun saluran yang
bermasalah berada jauh dari rumah mereka. Kolom `wilayah` sudah ada di tabel
kontak tetapi belum dipakai. Ini akan menjadi masalah nyata begitu ada lebih
dari satu titik pantau.

### C4. WhatsApp belum bisa dipakai tanpa persetujuan Meta

Kode pengirimnya sudah lengkap, tetapi WhatsApp Business API hanya mengizinkan
pesan bertemplat yang **disetujui Meta lebih dulu** untuk pesan yang tidak
didahului percakapan. Peringatan bencana termasuk kategori itu.

Sampai templat `sigap_peringatan_warga` dan `sigap_laporan_bpbd` disetujui,
notifikasi berjalan lewat Telegram saja. Prosesnya ada di
`docs/PANDUAN_WHATSAPP.md`, dan bisa memakan waktu berhari-hari.

---

## D. Hambatan praktis di luar kode

### D1. VEGAPULS Air 23 mahal

Sensor ini kelas industri. Satu unit berada di kisaran belasan sampai puluhan
juta rupiah, tergantung distributor dan paket langganan VEGA Inventory System.
Ini komponen biaya terbesar dalam RAB, dan menjadi hambatan utama replikasi ke
banyak titik.

Alternatif yang lebih murah ada: sensor ultrasonik seperti JSN-SR04T harganya
jauh di bawah itu. Tetapi ketelitiannya jauh lebih rendah, mudah terganggu uap,
busa, dan sampah mengambang, serta tidak tahan lingkungan saluran dalam jangka
panjang. Pilihan ini perlu Anda pertimbangkan sadar-sadar, bukan diam-diam.

### D2. Struktur API VEGA berbeda antar akun

Fungsi `_normalkan()` di `src/vega_client.py` sudah dibuat toleran terhadap
beberapa bentuk balasan yang umum, tetapi **belum pernah diuji terhadap akun
VIS sungguhan** karena saya tidak punya aksesnya. Kemungkinan besar Anda perlu
menyesuaikan fungsi itu setelah melihat balasan API yang sebenarnya.

### D3. Geometri saluran belum diukur

Seluruh angka sistem bergantung pada empat ukuran: tinggi pasang sensor, lebar
saluran, kedalaman saluran, dan panjang segmen. Nilai yang ada sekarang adalah
**nilai contoh**, bukan ukuran saluran Mangunharjo.

Selama ini belum diukur, semua persentase yang ditampilkan dasbor adalah angka
yang salah. Ini pekerjaan setengah hari dengan meteran, dan tidak bisa
diwakilkan kepada kode.

---

## E. Urutan prioritas perbaikan

Bila waktu Anda terbatas menjelang 16 September 2026, kerjakan dalam urutan ini:

1. **Ukur geometri saluran** (setengah hari, tanpa biaya). Tanpa ini semua angka salah.
2. **Temui pengurus RW dan BPBD** (beberapa hari). Bobot penilaian pelibatan pemangku kepentingan 35 persen, dan ini tidak bisa dikerjakan dari meja.
3. **Pasang bot Telegram dan daftarkan warga percontohan** (satu hari). Angka nyata jauh lebih meyakinkan daripada angka target.
4. **Isi minimal lima verifikasi lapangan** (beberapa minggu). Ini yang mengubah sistem dari menebak menjadi belajar, dan yang mengubah angka di atas dari hasil simulasi menjadi hasil lapangan.
5. Sisanya menyusul setelah lomba.
