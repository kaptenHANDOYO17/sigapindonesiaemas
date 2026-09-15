/**
 * Salinan mesin aturan penilaian status, dalam JavaScript.
 *
 * Berkas ini HARUS selalu sama dengan src/rules.py. Bila ambang batas di
 * berkas Python diubah, ubah juga di sini. Bila keduanya berbeda, halaman
 * simulasi akan memperagakan sistem yang tidak sama dengan yang sungguhan,
 * dan itu lebih menyesatkan daripada tidak ada simulasi sama sekali.
 *
 * Rujukan: src/rules.py fungsi nilai_status(), dan src/config.py kelas Ambang.
 */

export const AMBANG = {
  endapanTinggi: 0.30,
  endapanSangatTinggi: 0.55,
  debitMenurun: 0.60,
  debitSangatRendah: 0.30,
  airMeluap: 0.85,
  lajuNaikMendadak: 8.0,        // milimeter per menit
};

export function nilaiStatus({ rEndapan, rDebit, rAir, lajuNaik = 0, lonjakanDasar = 0 }) {
  const a = AMBANG;
  const endapanTinggi = rEndapan >= a.endapanTinggi;
  const endapanSangatTinggi = rEndapan >= a.endapanSangatTinggi;
  const debitMenurun = rDebit < a.debitMenurun;
  const debitSangatRendah = rDebit < a.debitSangatRendah;

  const pemicu = [];
  let status, alasan;

  /* --------------------------- matriks pokok --------------------------- */
  if (endapanSangatTinggi && debitSangatRendah) {
    status = "KRITIS";
    alasan = "Endapan sangat tinggi dan debit air nyaris berhenti. Indikasi sumbatan parah.";
  } else if (endapanTinggi && debitMenurun) {
    status = "SIAGA";
    alasan = "Endapan tinggi disertai penurunan debit. Indikasi saluran mulai tersumbat.";
  } else if (endapanTinggi) {
    status = "WASPADA";
    alasan = "Endapan tinggi namun aliran masih normal. Indikasi penyempitan saluran.";
  } else {
    status = "AMAN";
    alasan = "Endapan rendah dan aliran normal.";
  }
  pemicu.push({ nama: "Matriks pokok", hasil: status, aktif: true });

  /* ------------------------- pemicu tambahan --------------------------- */
  if (debitSangatRendah && rAir >= 0.45 && (status === "AMAN" || status === "WASPADA")) {
    status = "SIAGA";
    alasan = "Muka air cukup tinggi tetapi aliran nyaris berhenti. Indikasi ada benda yang " +
             "menyumbat di hilir, bukan sekadar endapan.";
    pemicu.push({ nama: "Divergensi air dan aliran", hasil: "SIAGA", aktif: true });
  }

  if (endapanSangatTinggi) {
    status = "KRITIS";
    alasan = "Endapan sudah melewati separuh kedalaman saluran. Kapasitas tersisa sangat tipis " +
             "dan saluran akan langsung meluap begitu hujan turun. Perlu pengerukan segera.";
    pemicu.push({ nama: "Endapan melewati separuh kedalaman", hasil: "KRITIS", aktif: true });
  }

  if (lonjakanDasar >= 1.5 && (status === "AMAN" || status === "WASPADA")) {
    status = "SIAGA";
    alasan = "Dasar saluran terbaca naik jauh lebih cepat daripada laju penumpukan endapan " +
             "yang wajar. Ini menandakan air tertahan di belakang sumbatan.";
    pemicu.push({ nama: "Dasar saluran naik mendadak", hasil: "SIAGA", aktif: true });
  }

  if (rAir >= a.airMeluap) {
    status = "KRITIS";
    alasan = "Muka air sudah mendekati bibir saluran. Risiko meluap ke jalan dan permukiman.";
    pemicu.push({ nama: "Muka air mendekati bibir saluran", hasil: "KRITIS", aktif: true });
  }

  if (lajuNaik >= a.lajuNaikMendadak && status !== "KRITIS") {
    status = "SIAGA";
    alasan = "Muka air naik mendadak. Indikasi limpasan besar atau sumbatan yang baru terbentuk.";
    pemicu.push({ nama: "Muka air naik mendadak", hasil: "SIAGA", aktif: true });
  }

  return { status, alasan, pemicu };
}

/** Perkiraan volume material, mengikuti rules.py fungsi estimasi_volume_sampah_m3(). */
export function estimasiVolume(rEndapan, { lebarMm = 600, panjangM = 50, kedalamanMm = 800 } = {}) {
  const tinggiM = (rEndapan * kedalamanMm) / 1000;
  const tengah = tinggiM * (lebarMm / 1000) * panjangM;
  return {
    tengah: +tengah.toFixed(1),
    bawah: +(tengah * 0.6).toFixed(1),
    atas: +(tengah * 1.5).toFixed(1),
    karung: Math.round(tengah / 0.05),
  };
}
