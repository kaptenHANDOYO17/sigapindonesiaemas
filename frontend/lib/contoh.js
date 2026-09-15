/**
 * Data peragaan untuk dasbor.
 *
 * MENGAPA INI ADA
 * ---------------
 * Sensor belum terpasang di lapangan, sehingga basis data masih kosong.
 * Tanpa berkas ini, siapa pun yang membuka situs hanya melihat halaman kosong
 * dan menyimpulkan sistemnya tidak berjalan.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR
 * ---------------------------------
 * Data peragaan HANYA dipakai ketika basis data benar-benar kosong, dan
 * setiap kali dipakai, halaman WAJIB menampilkan spanduk peringatan bahwa
 * angka yang terlihat adalah contoh. Begitu satu baris data sungguhan masuk,
 * berkas ini tidak lagi tersentuh.
 *
 * Menampilkan angka buatan tanpa memberitahu pembaca adalah pemalsuan, dan
 * itu akan terbongkar pada survei lapangan.
 */

const JAM = 3600 * 1000;

function acakTerkendali(benih) {
  let x = benih;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

/** Riwayat 48 jam: endapan menumpuk perlahan, aliran turun saat menjelang puncak. */
export function riwayatContoh() {
  const acak = acakTerkendali(20260915);
  const sekarang = Date.now();
  const baris = [];
  for (let i = 47; i >= 0; i--) {
    const t = sekarang - i * JAM;
    const maju = (47 - i) / 47;
    const endapan = 31 + maju * 9 + (acak() - 0.5) * 1.6;
    const hujan = i > 30 && i < 38 ? 4 + acak() * 9 : acak() * 0.6;
    const aliran = 92 - maju * 34 + (acak() - 0.5) * 5;
    baris.push({
      timestamp: new Date(t).toISOString(),
      status: endapan > 38 ? "SIAGA" : "WASPADA",
      rasio_endapan: endapan / 100,
      rasio_debit: Math.max(0.2, aliran / 100),
      estimasi_volume_m3: +(endapan / 100 * 0.6 * 50).toFixed(1),
    });
  }
  return baris;
}

export function sensorContoh() {
  const acak = acakTerkendali(778899);
  const sekarang = Date.now();
  const baris = [];
  for (let i = 47; i >= 0; i--) {
    const t = sekarang - i * JAM;
    const hujan = i > 30 && i < 38 ? 3.5 + acak() * 8 : acak() * 0.5;
    baris.push({
      timestamp: new Date(t).toISOString(),
      jarak_mm: 820 + acak() * 40,
      debit_lpm: 420 - (47 - i) * 4.2 + acak() * 40,
      ph_air: 6.6 + acak() * 0.5,
      hujan_mm: +hujan.toFixed(2),
    });
  }
  return baris;
}

export function statusContoh() {
  const riwayat = riwayatContoh();
  const kini = riwayat[riwayat.length - 1];
  const mulai = Date.now();
  const ramalan = { waktu: [], permukaan_mm: [] };
  for (let i = 1; i <= 24; i++) {
    const naik = Math.sin((i / 24) * Math.PI) * 190;
    ramalan.waktu.push(new Date(mulai + i * 0.5 * JAM).toISOString());
    ramalan.permukaan_mm.push(+(420 + naik).toFixed(1));
  }
  const puncak = Math.max(...ramalan.permukaan_mm);

  return {
    peragaan: true,
    saluran_id: "MGH-01",
    timestamp: new Date().toISOString(),
    status: "SIAGA",
    alasan:
      "Endapan tinggi disertai penurunan debit. Indikasi saluran mulai tersumbat.",
    rasio_endapan: kini.rasio_endapan,
    rasio_debit: kini.rasio_debit,
    rasio_air: 0.52,
    tinggi_air_mm: 416,
    dasar_mm: +(kini.rasio_endapan * 800).toFixed(1),
    debit_lpm: 268,
    ph_air: 6.71,
    hujan_mm: 2.4,
    estimasi_volume_m3: kini.estimasi_volume_m3,
    estimasi_karung: Math.round(kini.estimasi_volume_m3 / 0.05),
    dugaan_jenis_sampah: "cenderung organik",
    ramalan: {
      ...ramalan,
      puncak_mm: +puncak.toFixed(1),
      rasio_puncak: +(puncak / 800).toFixed(3),
      waktu_puncak: ramalan.waktu[ramalan.permukaan_mm.indexOf(puncak)],
      berpotensi_meluap: false,
    },
  };
}
