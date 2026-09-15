# Daftar Periksa

Centang berurutan. Bagian bertanda **wajib** harus selesai sebelum sistem boleh
dipercaya menjaga keselamatan warga.

## Persiapan perangkat lunak

- [ ] Python 3.11 dan Node.js 20 terpasang
- [ ] `pip install -r requirements-train.txt` berhasil
- [ ] Proyek Supabase dibuat, `database/schema.sql` dijalankan, 5 tabel muncul
- [ ] Bot Telegram dibuat lewat @BotFather, token disimpan
- [ ] Berkas `.env` dibuat dan diisi
- [ ] `python -m training.cek_sistem` tidak ada tanda GAGAL

## Kalibrasi lapangan — **wajib**

- [ ] Tinggi pasang sensor ke dasar saluran diukur (mm)
- [ ] Lebar saluran diukur (mm)
- [ ] Kedalaman saluran diukur (mm)
- [ ] Panjang segmen yang diwakili sensor ditetapkan (m)
- [ ] Debit saat saluran bersih dan hujan sedang diukur (L/menit)
- [ ] Kelima angka di atas dimasukkan ke `.env` dan GitHub Variables
- [ ] Sensor debit dikalibrasi dengan wadah bervolume diketahui
- [ ] Modul pH dikalibrasi dengan larutan penyangga pH 4,00 dan 7,00

## Model

- [ ] Data sintetis dibangkitkan (`generate_dataset`)
- [ ] Model anomali dilatih (`train_anomaly`)
- [ ] Model ramalan dilatih (`train_forecast`)
- [ ] `python -m training.evaluate` dijalankan dan hasilnya dibaca
- [ ] Arah kesalahan condong ke berlebih waspada, bukan meremehkan

## Perangkat keras

- [ ] VEGAPULS Air 23 terpasang, tegak lurus, tanpa penghalang
- [ ] Perangkat terdaftar di VEGA Inventory System
- [ ] Token dan ID perangkat dimasukkan ke GitHub Secrets
- [ ] ESP32 dirakit sesuai `firmware/README.md`
- [ ] Firmware diunggah, Serial Monitor menunjukkan pengiriman berhasil
- [ ] Panel surya dan baterai terpasang, tahan hujan
- [ ] Data mulai masuk ke tabel `sensor_drainase`

## Otomasi

- [ ] Repositori GitHub dibuat, `.env` **tidak** ikut terunggah
- [ ] Seluruh Secrets dan Variables diisi
- [ ] Alur `pipeline.yml` berjalan hijau
- [ ] Alur dijalankan manual sekali dengan pilihan uji coba
- [ ] Dasbor Vercel terbit dan menampilkan data
- [ ] `SITUS_URL` diisi di GitHub Variables

## Warga dan petugas

- [ ] Menu perintah bot dipasang (`--pasang-menu`)
- [ ] Tautan warga dan tautan petugas diuji, peran tersimpan benar
- [ ] Minimal satu petugas BPBD terdaftar
- [ ] Peringatan uji coba dikirim dan diterima
- [ ] Warga percontohan didaftarkan
- [ ] Pengurus RW dan kelurahan diberi tahu keberadaan sistem

## Setelah berjalan

- [ ] Formulir verifikasi diisi setiap kali saluran diperiksa atau dibersihkan
- [ ] Minimal 5 verifikasi terkumpul sebelum ambang digeser
- [ ] Setelah 1 bulan: latih ulang dengan `--sumber supabase`
- [ ] Setelah 3 bulan: kalibrasi ulang seluruh ambang
- [ ] `LAPORAN_LATIH_ULANG.md` dibaca setiap bulan

## Sebelum mendaftar lomba

- [ ] Tim minimal 3 orang terbentuk
- [ ] Surat dukungan dari kelurahan atau BPBD diperoleh
- [ ] Dokumen struktur organisasi disiapkan
- [ ] RAB disiapkan
- [ ] Proposal disiapkan
- [ ] Seluruh anggota mengikuti @pln_id dan @kompascom, tangkapan layar disimpan
- [ ] Seluruh angka dalam proposal ditulis sebagai target, bukan capaian
- [ ] `YANG_MASIH_KURANG.md` dibaca seluruhnya
