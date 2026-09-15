"""
Protokol pembagian data: latih, validasi, uji.

MENGAPA TIGA BAGIAN, BUKAN DUA
------------------------------
Pada percobaan awal data dibagi dua saja. Masalahnya, ambang keputusan model
disetel sambil melihat hasil pada data uji. Begitu data uji dipakai menyetel,
ia berhenti menjadi data uji, dan angkanya menjadi terlalu bagus.

Pembagian di sini:

    LATIH     dipakai melatih bobot model
    VALIDASI  dipakai memilih pengaturan model dan menyetel ambang keputusan
    UJI       tidak disentuh sampai seluruh keputusan selesai

PEMBAGIAN BERSTRATA
-------------------
Pembagian acak pernah menghasilkan dua saluran uji yang sama sekali tidak
punya kejadian berbahaya. Angka "bahaya tertangkap 100 persen" yang muncul
saat itu kosong artinya, karena memang tidak ada yang perlu ditangkap.

Karena itu saluran diurutkan menurut seberapa sering ia mengalami kondisi
berbahaya, lalu dibagikan bergiliran ke tiga kelompok. Dengan begitu ketiganya
memperoleh campuran yang sebanding.

Jalankan:
    python -m training.protokol
"""
from __future__ import annotations

import json
import logging
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
warnings.filterwarnings("ignore")

from src.config import MODELS_DIR, STATUS_URUT  # noqa: E402
from src.features import FITUR, buat_fitur  # noqa: E402
from src.rules import nilai_status  # noqa: E402
from training.generate_dataset import simulasikan  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("protokol")

# tinggi_pasang, kedalaman, lebar, debit_rancangan, seed
GEOMETRI = [
    (1200, 800, 600, 900, 11), (1000, 650, 450, 620, 22),
    (1500, 1000, 800, 1400, 33), (900, 550, 400, 500, 44),
    (1350, 900, 700, 1150, 55), (1100, 700, 550, 780, 66),
    (1250, 850, 650, 980, 77), (950, 600, 500, 700, 88),
    (1450, 950, 750, 1300, 99), (1180, 780, 610, 880, 411),
    (1020, 640, 480, 690, 522), (1420, 930, 730, 1270, 633),
    (1300, 870, 680, 1050, 144), (980, 620, 460, 650, 255),
    (1550, 1020, 820, 1450, 366), (880, 540, 390, 480, 477),
    (1220, 810, 620, 930, 588), (1080, 690, 530, 760, 699),
]

BOBOT = {"AMAN": 1.0, "WASPADA": 2.0, "SIAGA": 5.0, "KRITIS": 8.0}


def status_sebenarnya(endapan_mm, sumbatan, kedalaman):
    r = endapan_mm / kedalaman
    if r >= 0.55 or sumbatan >= 0.6:
        return "KRITIS"
    if r >= 0.30 and sumbatan >= 0.25:
        return "SIAGA"
    if r >= 0.30 or sumbatan >= 0.45:
        return "WASPADA"
    return "AMAN"


def bangkitkan(hari=180):
    """Bangkitkan seluruh saluran, lalu bagi berstrata menurut proporsi bahaya."""
    kumpulan, prevalensi = {}, {}
    for i, (pasang, dalam, lebar, debit, seed) in enumerate(GEOMETRI, start=1):
        nama = f"S{i:02d}"
        mentah = simulasikan(hari=hari, menit=15, tinggi_pasang_mm=pasang,
                             kedalaman_mm=dalam, lebar_mm=lebar,
                             debit_rancangan_lpm=debit, seed=seed)
        df = buat_fitur(mentah, pasang, dalam, debit)
        df["benar"] = [status_sebenarnya(e, s_, dalam)
                       for e, s_ in zip(df["asli_endapan_mm"], df["asli_sumbatan"])]
        kumpulan[nama] = df
        prevalensi[nama] = float(df["benar"].isin(["SIAGA", "KRITIS"]).mean())

    urut = sorted(prevalensi, key=prevalensi.get, reverse=True)
    latih, validasi, uji = [], [], []
    for i, nama in enumerate(urut):
        [latih, latih, latih, latih, validasi, uji][i % 6].append(nama)
    return kumpulan, sorted(latih), sorted(validasi), sorted(uji), prevalensi


def duga_aturan(df):
    return np.array([
        nilai_status(r_endapan=float(b.rasio_endapan), r_debit=float(b.rasio_debit),
                     r_air=float(b.rasio_air), laju_naik=float(b.laju_naik),
                     ph=float(b.ph_air), skor_anomali=None,
                     lonjakan_dasar=float(b.lonjakan_dasar)).status
        for b in df.itertuples()
    ])


def ukur(benar, duga):
    nb = np.array([STATUS_URUT[x] for x in benar])
    nd = np.array([STATUS_URUT[x] for x in duga])
    bahaya = nb >= 2
    kritis = benar == "KRITIS"
    return {
        "tepat": float((nb == nd).mean()),
        # None, bukan nol, bila tidak ada kejadian berbahaya. Melaporkan nol
        # untuk kumpulan kosong pernah membuat hasil tampak sempurna padahal
        # tidak ada yang diuji.
        "bahaya_tertangkap": float((nd >= 2)[bahaya].mean()) if bahaya.any() else None,
        "jumlah_bahaya": int(bahaya.sum()),
        "alarm_palsu": float((nd >= 2)[~bahaya].mean()) if (~bahaya).any() else None,
        "kritis_terbaca_aman": float((duga[kritis] == "AMAN").mean()) if kritis.any() else None,
        "jumlah_kritis": int(kritis.sum()),
        "terlalu_waspada": float((nd > nb).mean()),
        "kurang_waspada": float((nd < nb).mean()),
    }


def skor_gabungan(h):
    """Satu angka pembanding. Melewatkan kondisi kritis dihukum paling berat."""
    b = h["bahaya_tertangkap"] or 0.0
    p = h["alarm_palsu"] or 0.0
    k = h["kritis_terbaca_aman"] or 0.0
    return b - 0.5 * p - 5 * k


def status_dari_peluang(P, kelas, t_bahaya, t_kritis):
    i = {k: kelas.index(k) for k in ("AMAN", "WASPADA", "SIAGA", "KRITIS")}
    pk_ = P[:, i["KRITIS"]]
    pb = pk_ + P[:, i["SIAGA"]]
    pp = pb + P[:, i["WASPADA"]]
    return np.where(pk_ >= t_kritis, "KRITIS",
           np.where(pb >= t_bahaya, "SIAGA",
           np.where(pp >= 0.5, "WASPADA", "AMAN")))


def gabung(aturan, model):
    return np.array([a if STATUS_URUT[a] >= STATUS_URUT[m] else m
                     for a, m in zip(aturan, model)])


def persen(v):
    return "   \u2014   " if v is None else f"{v * 100:6.2f}%"


def main():
    from sklearn.ensemble import HistGradientBoostingClassifier

    log.info("=" * 88)
    log.info("PROTOKOL LATIH / VALIDASI / UJI \u2014 pembagian berstrata")
    log.info("=" * 88)

    kum, LATIH, VALIDASI, UJI, prev = bangkitkan()
    log.info("Latih    : %s", ", ".join(LATIH))
    log.info("Validasi : %s", ", ".join(VALIDASI))
    log.info("Uji      : %s", ", ".join(UJI))
    for nama, kel in (("latih", LATIH), ("validasi", VALIDASI), ("uji", UJI)):
        log.info("  proporsi kondisi berbahaya, kelompok %-9s: %5.2f persen",
                 nama, float(np.mean([prev[n] for n in kel])) * 100)

    latih = pd.concat([kum[n] for n in LATIH], ignore_index=True)
    valid = pd.concat([kum[n] for n in VALIDASI], ignore_index=True)
    uji = pd.concat([kum[n] for n in UJI], ignore_index=True)
    log.info("Baris \u2014 latih %d, validasi %d, uji %d", len(latih), len(valid), len(uji))

    X_l = latih[FITUR].to_numpy("float32"); y_l = latih["benar"].to_numpy()
    w_l = np.array([BOBOT[y] for y in y_l])
    X_v = valid[FITUR].to_numpy("float32")
    X_u = uji[FITUR].to_numpy("float32")

    # ---------- Tahap 1: pilih pengaturan, dinilai pada VALIDASI ----------
    log.info("")
    log.info("Tahap 1 \u2014 memilih pengaturan model, dinilai pada data VALIDASI saja.")
    kandidat = [
        {"max_iter": 200, "learning_rate": 0.10, "max_depth": 4, "l2_regularization": 1.0},
        {"max_iter": 300, "learning_rate": 0.08, "max_depth": 6, "l2_regularization": 1.0},
        {"max_iter": 500, "learning_rate": 0.05, "max_depth": 8, "l2_regularization": 2.0},
    ]
    aturan_v = duga_aturan(valid)
    terbaik = None
    for cfg in kandidat:
        m = HistGradientBoostingClassifier(random_state=42, early_stopping=True,
                                           validation_fraction=0.15, **cfg)
        m.fit(X_l, y_l, sample_weight=w_l)
        kelas = list(m.classes_)
        h = ukur(valid["benar"].to_numpy(),
                 gabung(aturan_v, status_dari_peluang(m.predict_proba(X_v), kelas, 0.10, 0.25)))
        nilai = skor_gabungan(h)
        log.info("  depth=%d iter=%d lr=%.2f \u2192 bahaya %s palsu %s kritis-lolos %s (nilai %.4f)",
                 cfg["max_depth"], cfg["max_iter"], cfg["learning_rate"],
                 persen(h["bahaya_tertangkap"]), persen(h["alarm_palsu"]),
                 persen(h["kritis_terbaca_aman"]), nilai)
        if terbaik is None or nilai > terbaik[0]:
            terbaik = (nilai, cfg, m, kelas)
    _, cfg_pilih, model, kelas = terbaik
    log.info("  Terpilih: %s", cfg_pilih)

    # ---------- Tahap 2: setel ambang pada VALIDASI ----------
    log.info("")
    log.info("Tahap 2 \u2014 menyetel ambang keputusan, tetap pada data VALIDASI saja.")
    P_v = model.predict_proba(X_v)
    ambang, nilai_terbaik = (0.10, 0.25), -9.0
    for tb in (0.05, 0.10, 0.20, 0.35, 0.50):
        for tk in (0.15, 0.25, 0.40):
            h = ukur(valid["benar"].to_numpy(),
                     gabung(aturan_v, status_dari_peluang(P_v, kelas, tb, tk)))
            nilai = skor_gabungan(h)
            if nilai > nilai_terbaik:
                nilai_terbaik, ambang = nilai, (tb, tk)
    tb, tk = ambang
    log.info("  Ambang terpilih: bahaya %.2f, kritis %.2f", tb, tk)

    # ---------- Tahap 3: buka UJI satu kali ----------
    log.info("")
    log.info("Tahap 3 \u2014 membuka data UJI. Setelah ini tidak ada penyetelan lagi.")
    aturan_u = duga_aturan(uji)
    model_u = status_dari_peluang(model.predict_proba(X_u), kelas, tb, tk)
    gab_u = gabung(aturan_u, model_u)
    benar_u = uji["benar"].to_numpy()

    hasil = {"aturan_saja": ukur(benar_u, aturan_u),
             "model_saja": ukur(benar_u, model_u),
             "gabungan": ukur(benar_u, gab_u)}

    log.info("")
    log.info("HASIL PADA DATA UJI (%s) \u2014 belum pernah disentuh", ", ".join(UJI))
    log.info("%-14s %8s %10s %9s %13s %9s", "Cara", "Tepat", "Bahaya", "Palsu",
             "KRITIS\u2192AMAN", "Kurang")
    log.info("-" * 78)
    for nama, h in hasil.items():
        log.info("%-14s %7.1f%% %10s %9s %13s %8.1f%%",
                 nama, h["tepat"] * 100, persen(h["bahaya_tertangkap"]),
                 persen(h["alarm_palsu"]), persen(h["kritis_terbaca_aman"]),
                 h["kurang_waspada"] * 100)
    log.info("Data uji memuat %d baris berbahaya, di antaranya %d KRITIS.",
             hasil["gabungan"]["jumlah_bahaya"], hasil["gabungan"]["jumlah_kritis"])

    log.info("")
    log.info("Per saluran uji (cara gabungan):")
    for n in UJI:
        d = kum[n]
        g = gabung(duga_aturan(d),
                   status_dari_peluang(model.predict_proba(d[FITUR].to_numpy("float32")),
                                       kelas, tb, tk))
        h = ukur(d["benar"].to_numpy(), g)
        log.info("  %s: tepat %5.1f%% | bahaya %s (%5d baris) | palsu %s | kritis-lolos %s (%5d baris)",
                 n, h["tepat"] * 100, persen(h["bahaya_tertangkap"]), h["jumlah_bahaya"],
                 persen(h["alarm_palsu"]), persen(h["kritis_terbaca_aman"]), h["jumlah_kritis"])

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    (MODELS_DIR / "hasil_protokol.json").write_text(json.dumps({
        "dijalankan": datetime.now(timezone.utc).isoformat(),
        "pembagian": {"latih": LATIH, "validasi": VALIDASI, "uji": UJI},
        "proporsi_bahaya_per_saluran": {k: round(v, 4) for k, v in prev.items()},
        "pengaturan_model": cfg_pilih,
        "ambang": {"bahaya": tb, "kritis": tk},
        "hasil_uji": hasil,
        "catatan": ("Pemilihan model dan penyetelan ambang seluruhnya memakai data "
                    "validasi. Data uji dibuka satu kali di akhir. Seluruh data tetap "
                    "berasal dari simulator, bukan dari saluran Mangunharjo."),
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("")
    log.info("Tersimpan: models/hasil_protokol.json")


if __name__ == "__main__":
    main()
