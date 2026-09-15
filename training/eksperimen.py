"""
Eksperimen generalisasi lintas saluran.

MENGAPA BERKAS INI ADA
----------------------
Menyetel model terhadap satu simulasi lalu melaporkan angkanya sebagai
"akurasi" adalah cara paling mudah untuk menipu diri sendiri. Model bisa saja
hanya menghafal kebiasaan satu berkas data.

Berkas ini menutup celah itu. Simulator dijalankan berkali-kali dengan
GEOMETRI SALURAN DAN CUACA YANG BERBEDA, lalu:

    - saluran A sampai F dipakai untuk MELATIH,
    - saluran G, H, I disembunyikan dan hanya dipakai MENGUJI.

Model tidak pernah melihat saluran uji selama pelatihan. Angka yang keluar
karena itu mengukur kemampuan menghadapi saluran baru, bukan kemampuan
menghafal.

Yang dibandingkan ada tiga:
    1. Mesin aturan saja (kondisi sekarang)
    2. Model terawasi saja
    3. Aturan ditambah model, dengan model hanya boleh MENAIKKAN status

Jalankan:
    python -m training.eksperimen
"""
from __future__ import annotations

import json
import logging
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
warnings.filterwarnings("ignore")

from src.config import MODELS_DIR, STATUS_URUT, settings  # noqa: E402
from src.features import FITUR, buat_fitur  # noqa: E402
from src.rules import nilai_status  # noqa: E402
from training.generate_dataset import simulasikan  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("eksperimen")

URUT = ["AMAN", "WASPADA", "SIAGA", "KRITIS"]

# Sembilan saluran dengan ukuran dan watak berbeda. Enam untuk melatih,
# tiga terakhir disembunyikan untuk menguji.
SALURAN = [
    # nama, tinggi_pasang, kedalaman, lebar, debit_rancangan, seed
    ("A", 1200, 800, 600, 900, 11),
    ("B", 1000, 650, 450, 620, 22),
    ("C", 1500, 1000, 800, 1400, 33),
    ("D",  900, 550, 400, 500, 44),
    ("E", 1350, 900, 700, 1150, 55),
    ("F", 1100, 700, 550, 780, 66),
    ("G", 1250, 850, 650, 980, 77),   # uji
    ("H",  950, 600, 500, 700, 88),   # uji
    ("I", 1450, 950, 750, 1300, 99),  # uji
]
LATIH = ["A", "B", "C", "D", "E", "F"]
UJI = ["G", "H", "I"]


def status_sebenarnya(endapan_mm, sumbatan, kedalaman):
    r = endapan_mm / kedalaman
    if r >= 0.55 or sumbatan >= 0.6:
        return "KRITIS"
    if r >= 0.30 and sumbatan >= 0.25:
        return "SIAGA"
    if r >= 0.30 or sumbatan >= 0.45:
        return "WASPADA"
    return "AMAN"


def siapkan(hari=180):
    """Bangkitkan seluruh saluran lalu hitung fitur dengan geometri masing-masing."""
    kumpulan = {}
    for nama, pasang, dalam, lebar, debit, seed in SALURAN:
        mentah = simulasikan(hari=hari, menit=15, tinggi_pasang_mm=pasang,
                             kedalaman_mm=dalam, lebar_mm=lebar,
                             debit_rancangan_lpm=debit, seed=seed)
        df = buat_fitur(mentah, pasang, dalam, debit)
        df["benar"] = [
            status_sebenarnya(e, s, dalam)
            for e, s in zip(df["asli_endapan_mm"], df["asli_sumbatan"])
        ]
        df["saluran"] = nama
        kumpulan[nama] = df
        sebaran = df["benar"].value_counts(normalize=True)
        log.info("Saluran %s (dalam %d mm): %s",
                 nama, dalam,
                 "  ".join(f"{k} {sebaran.get(k, 0) * 100:.0f}%" for k in URUT))
    return kumpulan


def duga_aturan(df):
    return np.array([
        nilai_status(
            r_endapan=float(b.rasio_endapan), r_debit=float(b.rasio_debit),
            r_air=float(b.rasio_air), laju_naik=float(b.laju_naik),
            ph=float(b.ph_air), skor_anomali=None,
        ).status
        for b in df.itertuples()
    ])


def ukur(nama_cara, benar, duga):
    n_benar = np.array([STATUS_URUT[x] for x in benar])
    n_duga = np.array([STATUS_URUT[x] for x in duga])
    bahaya_asli = n_benar >= 2
    bahaya_duga = n_duga >= 2
    kritis = benar == "KRITIS"

    hasil = {
        "cara": nama_cara,
        "tepat": float((n_benar == n_duga).mean()),
        "bahaya_tertangkap": float(bahaya_duga[bahaya_asli].mean()) if bahaya_asli.any() else 0.0,
        "alarm_palsu": float(bahaya_duga[~bahaya_asli].mean()) if (~bahaya_asli).any() else 0.0,
        "kritis_terbaca_aman": float((duga[kritis] == "AMAN").mean()) if kritis.any() else 0.0,
        "terlalu_waspada": float((n_duga > n_benar).mean()),
        "kurang_waspada": float((n_duga < n_benar).mean()),
    }
    return hasil


def cetak(tabel):
    log.info("")
    log.info("%-34s %8s %10s %8s %10s %10s", "Cara", "Tepat", "Bahaya", "Palsu", "KRITIS→", "Kurang")
    log.info("%-34s %8s %10s %8s %10s %10s", "", "", "tertangkap", "", "AMAN", "waspada")
    log.info("-" * 88)
    for h in tabel:
        log.info("%-34s %7.1f%% %9.1f%% %7.1f%% %9.2f%% %9.1f%%",
                 h["cara"], h["tepat"] * 100, h["bahaya_tertangkap"] * 100,
                 h["alarm_palsu"] * 100, h["kritis_terbaca_aman"] * 100,
                 h["kurang_waspada"] * 100)


def main():
    log.info("=" * 88)
    log.info("EKSPERIMEN GENERALISASI — 6 saluran latih, 3 saluran uji yang belum pernah dilihat")
    log.info("=" * 88)

    kumpulan = siapkan()
    latih = pd.concat([kumpulan[n] for n in LATIH], ignore_index=True)
    uji = pd.concat([kumpulan[n] for n in UJI], ignore_index=True)
    log.info("Data latih %d baris, data uji %d baris.", len(latih), len(uji))

    hasil = []

    # ---------- 1. Mesin aturan saja ----------
    duga_a_uji = duga_aturan(uji)
    hasil.append(ukur("1. Mesin aturan saja", uji["benar"].to_numpy(), duga_a_uji))

    # ---------- 2. Model terawasi ----------
    from sklearn.ensemble import HistGradientBoostingClassifier

    X_latih = latih[FITUR].to_numpy(dtype="float32")
    y_latih = latih["benar"].to_numpy()
    X_uji = uji[FITUR].to_numpy(dtype="float32")

    # Bobot kelas dinaikkan untuk status berbahaya, karena melewatkan bahaya
    # jauh lebih merugikan daripada membunyikan alarm berlebih.
    bobot_kelas = {"AMAN": 1.0, "WASPADA": 2.0, "SIAGA": 5.0, "KRITIS": 8.0}
    bobot = np.array([bobot_kelas[y] for y in y_latih])

    model = HistGradientBoostingClassifier(
        max_iter=300, learning_rate=0.08, max_depth=6,
        l2_regularization=1.0, random_state=42, early_stopping=True,
        validation_fraction=0.15,
    )
    log.info("Melatih model terawasi pada 6 saluran...")
    model.fit(X_latih, y_latih, sample_weight=bobot)

    duga_m_uji = model.predict(X_uji)
    hasil.append(ukur("2. Model terawasi saja", uji["benar"].to_numpy(), duga_m_uji))

    # ---------- 3. Aturan + model, model hanya boleh menaikkan ----------
    gabung = np.array([
        a if STATUS_URUT[a] >= STATUS_URUT[m] else m
        for a, m in zip(duga_a_uji, duga_m_uji)
    ])
    hasil.append(ukur("3. Aturan + model (menaikkan saja)", uji["benar"].to_numpy(), gabung))

    cetak(hasil)

    # ---------- Rincian per saluran uji ----------
    log.info("")
    log.info("Rincian per saluran uji (cara 3):")
    for n in UJI:
        d = kumpulan[n]
        da = duga_aturan(d)
        dm = model.predict(d[FITUR].to_numpy(dtype="float32"))
        g = np.array([a if STATUS_URUT[a] >= STATUS_URUT[m] else m for a, m in zip(da, dm)])
        h = ukur(f"  saluran {n}", d["benar"].to_numpy(), g)
        log.info("  Saluran %s: tepat %.1f%% | bahaya tertangkap %.1f%% | "
                 "alarm palsu %.1f%% | KRITIS terbaca AMAN %.2f%%",
                 n, h["tepat"] * 100, h["bahaya_tertangkap"] * 100,
                 h["alarm_palsu"] * 100, h["kritis_terbaca_aman"] * 100)

    # ---------- Fitur yang paling menentukan ----------
    try:
        from sklearn.inspection import permutation_importance
        contoh = np.random.default_rng(0).choice(len(X_uji), size=min(4000, len(X_uji)), replace=False)
        imp = permutation_importance(model, X_uji[contoh], uji["benar"].to_numpy()[contoh],
                                     n_repeats=3, random_state=0, n_jobs=1)
        urutan = np.argsort(imp.importances_mean)[::-1][:6]
        log.info("")
        log.info("Fitur paling menentukan:")
        for i in urutan:
            log.info("  %-26s %.4f", FITUR[i], imp.importances_mean[i])
    except Exception as e:  # noqa: BLE001
        log.warning("Pengukuran kepentingan fitur dilewati: %s", e)

    # ---------- Simpan ----------
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    (MODELS_DIR / "hasil_eksperimen.json").write_text(
        json.dumps({"saluran_latih": LATIH, "saluran_uji": UJI, "hasil": hasil},
                   indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("")
    log.info("Hasil disimpan ke models/hasil_eksperimen.json")
    return model, latih, uji


if __name__ == "__main__":
    main()
