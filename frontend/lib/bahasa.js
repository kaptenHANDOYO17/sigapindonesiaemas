/**
 * Kamus tiga bahasa: Indonesia, Jawa, dan Inggris.
 *
 * Yang diterjemahkan adalah bagian yang dibaca dan disentuh pengunjung:
 * menu, tombol, nama status, dan judul bagian. Uraian panjang pada halaman
 * Tentang Sistem sengaja dibiarkan dalam Bahasa Indonesia, karena
 * menerjemahkannya setengah-setengah lebih membingungkan daripada tidak
 * menerjemahkannya sama sekali. Hal itu disebutkan terus terang pada halaman
 * tersebut ketika bahasa lain dipilih.
 *
 * Bahasa Jawa memakai ragam ngoko yang lazim dipakai sehari-hari di Semarang,
 * bukan krama inggil, karena pembacanya adalah tetangga sendiri.
 */

export const BAHASA = {
  id: { nama: "Indonesia", kode: "id-ID", bendera: "ID" },
  jw: { nama: "Jawa", kode: "jv-ID", bendera: "JW" },
  en: { nama: "English", kode: "en-US", bendera: "EN" },
};

const KAMUS = {
  /* ------------------------------------------------------------- menu */
  "nav.dasbor":    { id: "Dasbor", jw: "Papan Pantau", en: "Dashboard" },
  "nav.peta":      { id: "Peta Sensor", jw: "Peta Sensor", en: "Sensor Map" },
  "nav.daftar":    { id: "Daftar Peringatan", jw: "Ndaftar Pènget", en: "Get Alerts" },
  "nav.lapor":     { id: "Lapor", jw: "Lapor", en: "Report" },
  "nav.simulasi":  { id: "Simulasi", jw: "Simulasi", en: "Simulation" },
  "nav.tentang":   { id: "Tentang Sistem", jw: "Bab Sistem Iki", en: "About" },
  "nav.masuk":     { id: "Masuk Pengelola", jw: "Mlebu Pengelola", en: "Manager Login" },

  /* ----------------------------------------------------------- status */
  "status.AMAN":    { id: "AMAN", jw: "AMAN", en: "SAFE" },
  "status.WASPADA": { id: "WASPADA", jw: "WASPADA", en: "CAUTION" },
  "status.SIAGA":   { id: "SIAGA", jw: "SIAGA", en: "ALERT" },
  "status.KRITIS":  { id: "KRITIS", jw: "KRITIS", en: "CRITICAL" },

  "arti.AMAN":    { id: "Saluran bersih, air mengalir lancar.",
                    jw: "Kalèné resik, banyuné mili lancar.",
                    en: "Channel is clear, water flows freely." },
  "arti.WASPADA": { id: "Ada endapan, aliran masih lancar.",
                    jw: "Ana endhepan, nanging banyuné isih mili.",
                    en: "Sediment present, flow still normal." },
  "arti.SIAGA":   { id: "Endapan banyak, aliran melambat.",
                    jw: "Endhepané akèh, banyuné wiwit alon.",
                    en: "Heavy sediment, flow slowing down." },
  "arti.KRITIS":  { id: "Tersumbat parah, air hampir tidak mengalir.",
                    jw: "Buntu banget, banyuné meh ora mili.",
                    en: "Severely blocked, water barely moving." },

  "tindak.AMAN":    { id: "Tidak perlu tindakan apa pun.",
                      jw: "Ora perlu tumindak apa-apa.",
                      en: "No action needed." },
  "tindak.WASPADA": { id: "Jangan buang sampah ke saluran.",
                      jw: "Aja mbuwang uwuh menyang kalèn.",
                      en: "Do not throw waste into the channel." },
  "tindak.SIAGA":   { id: "Naikkan barang, siapkan tas darurat.",
                      jw: "Unggahna barang, cepakna tas darurat.",
                      en: "Raise belongings, prepare an emergency bag." },
  "tindak.KRITIS":  { id: "Utamakan keselamatan, matikan MCB.",
                      jw: "Utamakna keslametan, patènana MCB.",
                      en: "Prioritise safety, switch off the MCB." },

  /* ---------------------------------------------------------- beranda */
  "beranda.keadaan":   { id: "Empat keadaan yang perlu Anda kenali",
                         jw: "Papat kahanan sing kudu panjenengan ngerti",
                         en: "Four conditions you should know" },
  "beranda.keadaanKet": { id: "Sistem hanya menghubungi Anda ketika keadaan naik ke Waspada, Siaga, atau Kritis. Saat aman, tidak ada pesan yang dikirim sama sekali.",
                          jw: "Sistem mung ngubungi panjenengan yèn kahanané munggah dadi Waspada, Siaga, utawa Kritis. Yèn aman, ora ana pesen sing dikirim.",
                          en: "The system only contacts you when the condition rises to Caution, Alert, or Critical. When it is safe, no message is sent at all." },
  "beranda.sekarang":  { id: "keadaan sekarang", jw: "kahanan saiki", en: "current condition" },

  "pintas.daftar":     { id: "Daftar peringatan", jw: "Ndaftar pènget", en: "Get alerts" },
  "pintas.daftarKet":  { id: "Dapatkan pesan di ponsel sebelum genangan terjadi. Gratis.",
                         jw: "Éntuk pesen ing HP sadurungé banjir teka. Gratis.",
                         en: "Get a message on your phone before flooding starts. Free." },
  "pintas.lapor":      { id: "Laporkan yang Anda lihat", jw: "Laporna sing panjenengan deleng", en: "Report what you see" },
  "pintas.laporKet":   { id: "Sampah atau genangan yang tidak terlihat alat. Boleh anonim.",
                         jw: "Uwuh utawa banyu ngendhek sing ora kedeleng alat. Kena tanpa jeneng.",
                         en: "Waste or flooding the sensor cannot see. You may stay anonymous." },
  "pintas.peta":       { id: "Lihat peta titik pantau", jw: "Deleng peta titik pantau", en: "See the sensor map" },
  "pintas.petaKet":    { id: "Letak setiap alat dan kondisi salurannya.",
                         jw: "Panggonan saben alat lan kahanan kalèné.",
                         en: "Where each device sits and how its channel is doing." },
  "pintas.tentang":    { id: "Pahami cara kerjanya", jw: "Ngerteni cara kerjané", en: "Understand how it works" },
  "pintas.tentangKet": { id: "Cara kerja, hasil pengujian, dan keterbatasannya.",
                         jw: "Cara kerja, asil pengujian, lan watesané.",
                         en: "How it works, test results, and its limitations." },

  /* --------------------------------------------------------- tombol */
  "tombol.daftar":    { id: "Daftarkan nomor saya", jw: "Daftarna nomerku", en: "Register my number" },
  "tombol.muatUlang": { id: "Muat ulang", jw: "Muat manèh", en: "Reload" },
  "tombol.kirim":     { id: "Kirim", jw: "Kirim", en: "Send" },
  "tombol.batal":     { id: "Batal", jw: "Batal", en: "Cancel" },

  /* ------------------------------------------------------- keterangan */
  "ket.langsung":  { id: "data langsung", jw: "data langsung", en: "live data" },
  "ket.memuat":    { id: "memuat", jw: "lagi mbukak", en: "loading" },
  "ket.contoh":    { id: "data contoh", jw: "data conto", en: "sample data" },
  "ket.terputus":  { id: "terputus", jw: "pedhot", en: "disconnected" },

  "peragaan.judul": { id: "MODE PERAGAAN — angka di halaman ini adalah contoh",
                      jw: "MODE PERAGAAN — angka ing kaca iki mung conto",
                      en: "DEMO MODE — the numbers on this page are samples" },

  /* ------------------------------------------------------------ kaki */
  "kaki.sensor": { id: "Sensor: radar level Holykell HR2000, sensor debit YF-B10, dan modul pH analog DFRobot, dibaca mikrokontroler ESP32.",
                   jw: "Sensor: radar level Holykell HR2000, sensor debit YF-B10, lan modul pH analog DFRobot, diwaca mikrokontroler ESP32.",
                   en: "Sensors: Holykell HR2000 radar level, YF-B10 flow sensor, and DFRobot analogue pH module, read by an ESP32 microcontroller." },

  /* ---------------------------------------------------------- setelan */
  "setelan.bahasa": { id: "Bahasa", jw: "Basa", en: "Language" },
  "setelan.mode":   { id: "Tampilan", jw: "Tampilan", en: "Appearance" },
  "setelan.siang":  { id: "Terang", jw: "Padhang", en: "Light" },
  "setelan.malam":  { id: "Gelap", jw: "Peteng", en: "Dark" },

  "catatan.terjemahan": {
    id: "",
    jw: "Uraian dawa ing kaca iki isih nganggo Basa Indonesia. Sing wis dijawakaké lagi menu, tombol, lan jeneng kahanan.",
    en: "Long explanations on this page are still in Indonesian. Only menus, buttons, and condition names have been translated so far.",
  },
};

/** Ambil teks sesuai bahasa. Bila belum ada terjemahannya, jatuh ke Indonesia. */
export function teks(kunci, bahasa = "id") {
  const baris = KAMUS[kunci];
  if (!baris) return kunci;
  return baris[bahasa] ?? baris.id ?? kunci;
}
