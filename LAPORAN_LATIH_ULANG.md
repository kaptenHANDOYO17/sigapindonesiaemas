# Laporan Pelatihan Ulang Bulanan

Dijalankan: 01 October 2026, 22:30 WIB
Saluran: Drainase Meteseh RT 06 / RW 02 (MGH-01)
Rentang data: 30 hari terakhir, 288 baris

## Hasil pelatihan

| Model | Hasil |
|---|---|
| Klasifikasi status (terawasi) | berhasil (sintetis) |
| Deteksi anomali (Isolation Forest) | berhasil |
| Ramalan muka air (LSTM) | gagal |

## Usulan penyesuaian ambang

Berdasarkan 8 verifikasi lapangan dari petugas.

| Ambang | Nilai sekarang | Usulan | Selisih |
|---|---|---|---|
| `AMBANG_ENDAPAN_TINGGI` | 0.300 | 0.273 | -0.027 |

> Ambang **tidak** diubah otomatis. Bila Anda setuju dengan usulan di atas, ubah sendiri nilainya di GitHub Variables, lalu catat alasan perubahannya. Angka ini menyangkut keselamatan warga, sehingga harus ada manusia yang memutuskan dan bertanggung jawab.

Volume material yang benar-benar terangkut rata-rata **10.57 m³**. Bandingkan dengan perkiraan sistem pada periode yang sama. Bila perkiraan sistem selalu lebih kecil, naikkan `PANJANG_SEGMEN_M`; bila selalu lebih besar, turunkan.

Jenis material yang tercatat petugas:

- organik: 2 kali
- campuran: 2 kali
- plastik: 1 kali
- lumpur: 1 kali

Gunakan catatan ini untuk menilai apakah dugaan jenis sampah berbasis pH memang berguna atau justru menyesatkan. Bila dugaan sering meleset, sebaiknya fitur itu dinonaktifkan saja daripada menyesatkan petugas.

## Langkah berikutnya

1. Periksa tabel usulan di atas.
2. Jalankan `python -m training.evaluate` untuk melihat arah kesalahan sistem.
3. Bila ada usulan ambang, bahas bersama petugas BPBD sebelum diubah.
4. Pastikan formulir verifikasi terisi setelah setiap pengerukan.
