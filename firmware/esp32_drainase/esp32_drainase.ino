/*
 * SIGAP DRAINASE — Firmware ESP32
 * Pengirim data sensor debit dan pH ke Supabase.
 *
 * MENGAPA HANYA DUA SENSOR DI SINI
 * --------------------------------
 * VEGAPULS Air 23 TIDAK dihubungkan ke papan ini. Sensor radar itu perangkat
 * mandiri berbaterai yang mengirim datanya sendiri lewat NB-IoT, LTE-M, atau
 * LoRaWAN menuju VEGA Inventory System. Data radar diambil oleh skrip Python
 * dari REST API sistem tersebut, bukan lewat kabel ke ESP32.
 *
 * Papan ini hanya menangani dua sensor yang memang butuh mikrokontroler:
 *   1. Sensor debit air  (keluaran pulsa, dibaca lewat interupsi)
 *   2. Modul pH RS485    (protokol Modbus RTU)
 *
 * PERANGKAT KERAS
 * ---------------
 *   ESP32 DevKit V1
 *   Sensor debit YF-B10 atau setara      -> GPIO 4  (butuh resistor pull-up 10k ke 3V3)
 *   Modul pH RS485 industri              -> lewat konverter MAX485
 *       DI  -> GPIO 17 (TX2)
 *       RO  -> GPIO 16 (RX2)
 *       DE dan RE disatukan -> GPIO 5
 *   Panel surya 20 Wp + baterai 18650 3S + modul TP4056 atau MPPT
 *
 * Rangkaian lengkap dan cara kalibrasi ada di firmware/README.md
 *
 * PUSTAKA YANG PERLU DIPASANG (Arduino IDE -> Library Manager)
 *   ArduinoJson  (Benoit Blanchon)  versi 7 ke atas
 *   ModbusMaster (Doc Walker)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ModbusMaster.h>
#include <time.h>

// ===========================================================================
//  BAGIAN YANG WAJIB ANDA UBAH
// ===========================================================================
const char* WIFI_SSID     = "GANTI_NAMA_WIFI";
const char* WIFI_PASS     = "GANTI_SANDI_WIFI";

// Ambil dari Supabase -> Project Settings -> API
const char* SUPABASE_URL  = "https://xxxxxxxx.supabase.co";
// PENTING: gunakan kunci service_role. Jangan pernah menaruh kunci ini di
// halaman web. Di sini aman karena papan ini terpasang fisik di lapangan.
const char* SUPABASE_KEY  = "GANTI_DENGAN_SERVICE_ROLE_KEY";

const char* SALURAN_ID    = "MGH-01";

// Hasil kalibrasi sensor debit. Nilai bawaan YF-B10 sekitar 6.6.
// Cara mengukurnya ada di firmware/README.md bagian Kalibrasi.
const float FAKTOR_KALIBRASI_DEBIT = 6.6f;

// Hasil kalibrasi pH dengan larutan penyangga pH 4.00 dan pH 7.00
const float PH_OFFSET = 0.00f;

// ===========================================================================
//  PENGATURAN TETAP
// ===========================================================================
#define PIN_DEBIT       4
#define PIN_RS485_DE    5
#define RS485_RX       16
#define RS485_TX       17

const uint16_t ALAMAT_MODBUS_PH   = 1;
const uint16_t REGISTER_PH        = 0x0000;
const unsigned long INTERVAL_KIRIM_MS = 15UL * 60UL * 1000UL;  // 15 menit
const unsigned long JENDELA_UKUR_MS   = 60UL * 1000UL;         // hitung pulsa 60 detik
const int MAKS_PERCOBAAN_KIRIM = 3;

ModbusMaster modbusPh;
volatile uint32_t pulsa = 0;
unsigned long kirimTerakhir = 0;

void IRAM_ATTR hitungPulsa() { pulsa++; }

void praKirim()  { digitalWrite(PIN_RS485_DE, HIGH); }
void pascaKirim(){ digitalWrite(PIN_RS485_DE, LOW);  }

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n=== SIGAP Drainase — ESP32 ==="));

  pinMode(PIN_DEBIT, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_DEBIT), hitungPulsa, FALLING);

  pinMode(PIN_RS485_DE, OUTPUT);
  digitalWrite(PIN_RS485_DE, LOW);
  Serial2.begin(9600, SERIAL_8N1, RS485_RX, RS485_TX);
  modbusPh.begin(ALAMAT_MODBUS_PH, Serial2);
  modbusPh.preTransmission(praKirim);
  modbusPh.postTransmission(pascaKirim);

  sambungWifi();

  // Waktu harus benar. Data dengan cap waktu keliru akan merusak perhitungan
  // laju kenaikan air dan membuat taksiran endapan kacau.
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.print(F("Menunggu waktu NTP"));
  int tunggu = 0;
  while (time(nullptr) < 100000 && tunggu < 30) {
    delay(500); Serial.print('.'); tunggu++;
  }
  Serial.println(time(nullptr) > 100000 ? F(" siap") : F(" GAGAL"));

  kirimTerakhir = millis() - INTERVAL_KIRIM_MS;
}

// ---------------------------------------------------------------------------
void loop() {
  if (millis() - kirimTerakhir < INTERVAL_KIRIM_MS) {
    delay(1000);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) sambungWifi();

  float debit = ukurDebit();
  float ph    = bacaPh();

  Serial.printf("Debit: %.1f L/menit | pH: %.2f\n", debit, ph);

  if (kirimKeSupabase(debit, ph)) {
    Serial.println(F("Terkirim."));
  } else {
    Serial.println(F("Gagal mengirim. Akan dicoba lagi siklus berikutnya."));
  }

  kirimTerakhir = millis();
}

// ---------------------------------------------------------------------------
void sambungWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Menyambung ke %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int coba = 0;
  while (WiFi.status() != WL_CONNECTED && coba < 40) {
    delay(500); Serial.print('.'); coba++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F(" tersambung, IP ")); Serial.println(WiFi.localIP());
  } else {
    Serial.println(F(" GAGAL. Papan akan dimulai ulang dalam 10 detik."));
    delay(10000);
    ESP.restart();
  }
}

// ---------------------------------------------------------------------------
float ukurDebit() {
  // Hitung pulsa selama satu menit penuh. Pengukuran singkat menghasilkan
  // angka yang meloncat-loncat, dan itu akan terbaca sistem sebagai anomali.
  noInterrupts(); pulsa = 0; interrupts();

  unsigned long mulai = millis();
  while (millis() - mulai < JENDELA_UKUR_MS) delay(100);

  noInterrupts(); uint32_t n = pulsa; interrupts();

  float detik = (millis() - mulai) / 1000.0f;
  float frekuensi = n / detik;
  return frekuensi / FAKTOR_KALIBRASI_DEBIT * 60.0f / 60.0f;  // liter per menit
}

// ---------------------------------------------------------------------------
float bacaPh() {
  uint8_t hasil = modbusPh.readHoldingRegisters(REGISTER_PH, 1);
  if (hasil != modbusPh.ku8MBSuccess) {
    Serial.printf("Modbus pH gagal, kode 0x%02X\n", hasil);
    return NAN;
  }
  // Sebagian besar modul mengirim pH dikali 100. Periksa lembar data modul
  // Anda; bila nilainya dikali 10, ganti pembagi di bawah ini menjadi 10.
  float ph = modbusPh.getResponseBuffer(0) / 100.0f + PH_OFFSET;
  if (ph < 0.0f || ph > 14.0f) {
    Serial.printf("Nilai pH tidak masuk akal: %.2f\n", ph);
    return NAN;
  }
  return ph;
}

// ---------------------------------------------------------------------------
bool kirimKeSupabase(float debit, float ph) {
  time_t sekarang = time(nullptr);
  if (sekarang < 100000) {
    Serial.println(F("Waktu belum sinkron. Pengiriman dibatalkan."));
    return false;
  }

  char waktu[32];
  strftime(waktu, sizeof(waktu), "%Y-%m-%dT%H:%M:%SZ", gmtime(&sekarang));

  JsonDocument doc;
  doc["saluran_id"] = SALURAN_ID;
  doc["timestamp"]  = waktu;
  doc["debit_lpm"]  = round(debit * 10) / 10.0;
  if (!isnan(ph)) doc["ph_air"] = round(ph * 100) / 100.0;
  doc["sumber"]     = "esp32";

  String muatan;
  serializeJson(doc, muatan);

  String url = String(SUPABASE_URL) + "/rest/v1/sensor_drainase";

  for (int coba = 1; coba <= MAKS_PERCOBAAN_KIRIM; coba++) {
    HTTPClient http;
    http.begin(url);
    http.setTimeout(15000);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    // merge-duplicates: bila baris dengan waktu yang sama sudah ada,
    // baris lama diperbarui alih-alih ditolak. Ini penting karena skrip
    // Python juga menulis ke baris yang sama untuk mengisi kolom radar.
    http.addHeader("Prefer", "resolution=merge-duplicates,return=minimal");

    int kode = http.POST(muatan);
    http.end();

    if (kode >= 200 && kode < 300) return true;
    Serial.printf("Percobaan %d gagal, kode HTTP %d\n", coba, kode);
    delay(3000);
  }
  return false;
}
