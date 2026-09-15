"""
Evaluasi mesin aturan dan model anomali terhadap kebenaran yang diketahui.

Jalankan:
    python -m training.evaluate

Berkas ini menjawab pertanyaan yang paling penting sebelum sistem dipercaya:
seberapa sering sistem benar, dan lebih penting lagi, seberapa sering sistem
MELEWATKAN kondisi berbahaya.

Pada data sintetis, kebenaran diketahui karena simulator mencatat tinggi
endapan dan tingkat sumbatan yang sebenarnya. Pada data asli nanti,
kebenaran datang dari tabel verifikasi_lapangan yang diisi petugas setelah
pengerukan.

Dua angka yang harus diperhatikan:
  - Tingkat tertangkap (recall): berapa persen kondisi berbahaya yang
    berhasil ditandai. Inilah angka yang menyangkut keselamatan.
  - Tingkat alarm palsu: berapa persen kondisi normal yang salah ditandai.
    Angka ini menyangkut kepercayaan warga.
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import anomaly, classifier  # noqa: E402
from src.config import ROOT, STATUS_URUT, settings  # noqa: E402
from src.features import buat_fitur  # noqa: E402
from src.rules import nilai_status  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("evaluasi")

SINTETIS = ROOT / "datasets" / "sintetis_drainase.csv"


def status_sebenarnya(endapan_mm: float, sumbatan: float, kedalaman: float) -> str:
    """Status yang seharusnya, dihitung dari kondisi fisik yang sebenarnya."""
    r = endapan_mm / kedalaman
    if r >= 0.55 or sumbatan >= 0.6:
        return "KRITIS"
    if r >= 0.30 and sumbatan >= 0.25:
        return "SIAGA"
    if r >= 0.30 or sumbatan >= 0.45:
        return "WASPADA"
    return "AMAN"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--berkas", default=str(SINTETIS))
    a = p.parse_args()

    jalur = Path(a.berkas)
    if not jalur.exists():
        raise SystemExit(f"Berkas {jalur} tidak ada. Jalankan dulu: "
                         "python -m training.generate_dataset")

    df = pd.read_csv(jalur, parse_dates=["timestamp"])
    if "asli_endapan_mm" not in df.columns:
        raise SystemExit("Berkas ini tidak punya kolom kebenaran. Evaluasi hanya "
                         "bisa dijalankan pada data sintetis atau data yang sudah "
                         "diverifikasi petugas.")

    s = settings.saluran
    df = buat_fitur(df, s.tinggi_pasang_mm, s.kedalaman_mm, s.debit_rancangan_lpm)

    hasil_klas = classifier.duga_banyak(df)
    duga_model, yakin_model = hasil_klas if hasil_klas else (None, None)
    if duga_model is None:
        log.warning("Model klasifikasi belum ada. Evaluasi berjalan tanpa pendapat kedua "
                    "yang terawasi. Latih dengan: python -m training.train_classifier")

    skor = anomaly.skor_banyak(df)
    if skor is not None:
        settings.ambang.anomali = anomaly.ambang_terlatih()
        log.info("Ambang anomali dari hasil pelatihan: %.4f", settings.ambang.anomali)
    else:
        log.warning("Model anomali belum ada. Evaluasi hanya menilai mesin aturan.")

    duga, benar = [], []
    for i in range(len(df)):
        b = df.iloc[i]
        p_ = nilai_status(
            r_endapan=float(b["rasio_endapan"]),
            r_debit=float(b["rasio_debit"]),
            r_air=float(b["rasio_air"]),
            laju_naik=float(b["laju_naik"]),
            ph=float(b["ph_air"]),
            skor_anomali=None if skor is None else float(skor[i]),
            lonjakan_dasar=float(b["lonjakan_dasar"]),
            duga_model=None if duga_model is None else str(duga_model[i]),
            keyakinan_model=None if yakin_model is None else float(yakin_model[i]),
        )
        duga.append(p_.status)
        benar.append(status_sebenarnya(float(b["asli_endapan_mm"]),
                                       float(b["asli_sumbatan"]), s.kedalaman_mm))

    duga = np.array(duga)
    benar = np.array(benar)
    urut = ["AMAN", "WASPADA", "SIAGA", "KRITIS"]

    # --- Matriks kebingungan ---
    log.info("")
    log.info("Matriks kebingungan (baris = sebenarnya, kolom = dugaan sistem)")
    log.info("%-10s %s", "", "  ".join(f"{u:>8}" for u in urut))
    for a_ in urut:
        baris = [int(((benar == a_) & (duga == d)).sum()) for d in urut]
        log.info("%-10s %s", a_, "  ".join(f"{v:>8}" for v in baris))

    # --- Angka yang menyangkut keselamatan ---
    log.info("")
    bahaya_asli = np.isin(benar, ["SIAGA", "KRITIS"])
    bahaya_duga = np.isin(duga, ["SIAGA", "KRITIS"])
    if bahaya_asli.any():
        tertangkap = float(bahaya_duga[bahaya_asli].mean())
        log.info("Kondisi berbahaya yang tertangkap : %.1f persen", tertangkap * 100)
    palsu = float(bahaya_duga[~bahaya_asli].mean())
    log.info("Alarm palsu saat kondisi tidak bahaya: %.1f persen", palsu * 100)

    # Kesalahan paling berbahaya: sistem bilang AMAN padahal sebenarnya KRITIS.
    lolos = int(((benar == "KRITIS") & (duga == "AMAN")).sum())
    total_kritis = int((benar == "KRITIS").sum())
    log.info("")
    if total_kritis:
        log.info("Kondisi KRITIS yang terbaca AMAN   : %d dari %d (%.2f persen)",
                 lolos, total_kritis, lolos / total_kritis * 100)
        if lolos:
            log.warning("Ada kondisi kritis yang lolos tanpa peringatan. "
                        "Turunkan AMBANG_ENDAPAN_TINGGI atau AMBANG_DEBIT_MENURUN.")

    # --- Kecenderungan arah kesalahan ---
    nilai_duga = np.array([STATUS_URUT[d] for d in duga])
    nilai_benar = np.array([STATUS_URUT[b] for b in benar])
    terlalu_waspada = float((nilai_duga > nilai_benar).mean())
    kurang_waspada = float((nilai_duga < nilai_benar).mean())
    tepat = float((nilai_duga == nilai_benar).mean())

    log.info("")
    log.info("Tepat            : %.1f persen", tepat * 100)
    log.info("Terlalu waspada  : %.1f persen  (merepotkan, tetapi aman)", terlalu_waspada * 100)
    log.info("Kurang waspada   : %.1f persen  (berbahaya)", kurang_waspada * 100)

    if kurang_waspada > terlalu_waspada:
        log.warning("Sistem lebih sering MEREMEHKAN keadaan daripada melebihkannya. "
                    "Untuk sistem peringatan dini, arah kesalahan ini keliru. "
                    "Perketat ambang di berkas .env.")
    else:
        log.info("Arah kesalahan sudah benar: sistem cenderung berlebih waspada, "
                 "bukan meremehkan.")


if __name__ == "__main__":
    main()
