# Firmware ESP32

Papan ini menangani **sensor debit** dan **modul pH**. Sensor radar VEGAPULS
Air 23 tidak terhubung ke papan ini; ia mengirim datanya sendiri lewat jaringan
seluler ke VEGA Inventory System.

---

## Daftar komponen

| Komponen | Keterangan |
|---|---|
| ESP32 DevKit V1 | papan utama |
| Sensor debit YF-B10 atau setara | badan kuningan, tahan luar ruang |
| Modul pH industri RS485 | keluaran Modbus RTU |
| Modul MAX485 | penerjemah RS485 ke serial |
| Panel surya 20 Wp | catu daya |
| Baterai 18650 3 buah + BMS | penyimpan daya |
| Modul pengisi daya surya | MPPT atau TP4056 |
| Kotak kedap air IP65 | pelindung |
| Kabel, konektor, pengikat | pemasangan |

---

## Rangkaian

### Sensor debit

| Kabel sensor | Ke |
|---|---|
| Merah | 5V |
| Hitam | GND |
| Kuning (sinyal) | GPIO 4 |

Pasang resistor **10 kΩ** dari GPIO 4 ke 3V3 sebagai penarik naik. Tanpa itu,
pembacaan pulsa akan kacau.

### Modul pH lewat MAX485

| MAX485 | ESP32 |
|---|---|
| VCC | 3V3 |
| GND | GND |
| DI | GPIO 17 |
| RO | GPIO 16 |
| DE dan RE (disatukan) | GPIO 5 |
| A dan B | ke terminal A dan B modul pH |

Modul pH biasanya butuh catu 12V atau 24V terpisah. Periksa lembar datanya.

---

## Pustaka Arduino

Pasang lewat Library Manager:

- **ArduinoJson** oleh Benoit Blanchon, versi 7 ke atas
- **ModbusMaster** oleh Doc Walker

Papan: pilih **ESP32 Dev Module**.

---

## Sebelum mengunggah

Ubah bagian atas `esp32_drainase.ino`:

```cpp
const char* WIFI_SSID  = "...";
const char* WIFI_PASS  = "...";
const char* SUPABASE_URL = "https://xxxx.supabase.co";
const char* SUPABASE_KEY = "...";   // service_role
const char* SALURAN_ID   = "MGH-01";
const float FAKTOR_KALIBRASI_DEBIT = 6.6f;
const float PH_OFFSET = 0.00f;
```

Kunci `service_role` aman di sini karena papan terpasang fisik di lapangan dan
tidak dapat diakses publik. Jangan pernah menaruh kunci ini di halaman web.

---

## Kalibrasi

Cara mengukur `FAKTOR_KALIBRASI_DEBIT` dan `PH_OFFSET` ada di
[`../docs/KALIBRASI.md`](../docs/KALIBRASI.md) bagian 2 dan 3.

---

## Memeriksa hasil

Buka Serial Monitor pada 115200 baud. Keluaran yang benar:

```
=== SIGAP Drainase — ESP32 ===
Menyambung ke NamaWifi... tersambung, IP 192.168.1.42
Menunggu waktu NTP..... siap
Debit: 412.5 L/menit | pH: 7.12
Terkirim.
```

Lalu periksa di Supabase, tabel `sensor_drainase`, harus muncul baris baru
dengan kolom `sumber` bernilai `esp32`.

---

## Bila bermasalah

| Gejala | Penyebab yang mungkin |
|---|---|
| Debit selalu 0 | Resistor penarik naik belum dipasang, atau kabel sinyal tertukar. |
| pH bernilai NAN | Alamat Modbus salah, A dan B tertukar, atau catu daya modul kurang. |
| `Waktu belum sinkron` | Tidak ada internet saat papan menyala. Papan akan mencoba lagi. |
| Kode HTTP 401 | Kunci Supabase salah. |
| Kode HTTP 409 | Baris dengan waktu sama sudah ada. Tidak berbahaya. |
| Papan sering mulai ulang | Daya kurang. Periksa panel surya dan baterai. |

---

## Pemasangan di lapangan

- Kotak dipasang **di atas garis genangan tertinggi** yang pernah tercatat.
  Di Mangunharjo, genangan pernah mencapai 60 cm.
- Semua celah kabel ditutup dengan sil kedap air.
- Panel surya menghadap ke atas, bebas bayangan pohon dan bangunan.
- Sensor debit dipasang pada bagian saluran yang alirannya lurus, minimal
  10 kali diameter pipa dari belokan terdekat.
- Beri label berisi nomor kontak pengelola, supaya warga tahu ini bukan
  perangkat mencurigakan.
