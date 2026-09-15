"""
Pelatihan model klasifikasi status (terawasi).

Jalankan:
    python -m training.train_classifier --sumber sintetis
    python -m training.train_classifier --sumber verifikasi   # setelah data lapangan ada

MENGAPA MODEL INI MENGGANTIKAN ISOLATION FOREST
-----------------------------------------------
Rancangan awal memakai Isolation Forest, yaitu model tak terawasi yang menandai
pola yang jarang muncul. Pada pengujian, model itu hanya menangkap sekitar 5
persen kejadian berbahaya sambil membunyikan alarm palsu pada 4 persen kondisi
normal, artinya praktis tidak lebih baik daripada tebakan acak.

Penyebabnya mendasar: model tak terawasi mendeteksi KEJARANGAN, bukan BAHAYA.
Di saluran yang memang sering tersumbat, kondisi tersumbat bukan hal yang jarang.

Model terawasi menjawab persoalan itu karena dilatih pada pasangan
"pembacaan sensor" dan "kondisi sebenarnya". Pada bulan-bulan awal, pasangan
tersebut berasal dari simulator. Setelah petugas mengisi formulir verifikasi
lapangan, pasangan itu berasal dari kenyataan, dan model dilatih ulang dengan
data tersebut. Di situlah letak perbaikan yang sesungguhnya.

BATASAN YANG HARUS DISADARI
---------------------------
Angka ketepatan yang dilaporkan skrip ini diukur terhadap simulasi dengan seed
yang TIDAK dipakai melatih. Itu menguji apakah model bisa menggeneralisasi ke
realisasi lain, tetapi tetap tidak menguji apakah simulatornya sendiri
menyerupai saluran Mangunharjo. Ketepatan lapangan baru diketahui setelah
terkumpul data verifikasi.
"""
from __future__ import annotations

import argparse
import json
import logging
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import MODELS_DIR, ROOT, settings  # noqa: E402
from src.features import FITUR, buat_fitur  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("latih-klasifikasi")

URUT = ["AMAN", "WASPADA", "SIAGA", "KRITIS"]
SEED_LATIH = [2, 6, 9, 13, 15, 1]
SEED_UJI = [4, 5, 8, 14, 19, 7]


def status_sebenarnya(endapan_mm: float, sumbatan: float, kedalaman: float) -> str:
    r = endapan_mm / kedalaman
    if r >= 0.55 or sumbatan >= 0.6:
        return "KRITIS"
    if r >= 0.30 and sumbatan >= 0.25:
        return "SIAGA"
    if r >= 0.30 or sumbatan >= 0.45:
        return "WASPADA"
    return "AMAN"


def data_sintetis(seeds: list[int]) -> pd.DataFrame:
    """Bangkitkan data berlabel dari beberapa seed simulator."""
    from training.generate_dataset import simulasikan

    s = settings.saluran
    bag = []
    for sd in seeds:
        d = simulasikan(hari=365, seed=sd)
        d = buat_fitur(d, s.tinggi_pasang_mm, s.kedalaman_mm, s.debit_rancangan_lpm)
        d["label"] = [status_sebenarnya(e, u, s.kedalaman_mm)
                      for e, u in zip(d["asli_endapan_mm"], d["asli_sumbatan"])]
        d["seed"] = sd
        bag.append(d)
    return pd.concat(bag, ignore_index=True)


def data_verifikasi() -> pd.DataFrame:
    """
    Susun data berlabel dari verifikasi lapangan.

    Setiap catatan verifikasi memberi satu label pada waktu tertentu. Pembacaan
    sensor pada waktu itu diambil dari tabel sensor, lalu dipasangkan.
    """
    from src import supabase_client as sb

    ver = sb.ambil_verifikasi(hari=730)
    if ver.empty or "kondisi_sebenarnya" not in ver.columns:
        raise SystemExit("Belum ada data verifikasi lapangan.")
    ver = ver.dropna(subset=["kondisi_sebenarnya"])
    if len(ver) < 30:
        raise SystemExit(
            f"Baru ada {len(ver)} verifikasi. Butuh sekurang-kurangnya 30 sebelum "
            "model terawasi layak dilatih dari data lapangan. Sampai saat itu, "
            "pakai --sumber sintetis."
        )

    sensor = sb.ambil_sensor(menit=730 * 24 * 60)
    s = settings.saluran
    sensor = buat_fitur(sensor, s.tinggi_pasang_mm, s.kedalaman_mm, s.debit_rancangan_lpm)
    sensor = sensor.sort_values("timestamp")
    ver = ver.sort_values("waktu_periksa")

    gabung = pd.merge_asof(
        ver[["waktu_periksa", "kondisi_sebenarnya"]],
        sensor, left_on="waktu_periksa", right_on="timestamp",
        direction="nearest", tolerance=pd.Timedelta("2h"),
    ).dropna(subset=FITUR)
    gabung = gabung.rename(columns={"kondisi_sebenarnya": "label"})
    gabung["seed"] = 0
    log.info("Terkumpul %d pasangan verifikasi dan pembacaan sensor.", len(gabung))
    return gabung


def laporkan(nama: str, y_asli: np.ndarray, y_duga: np.ndarray) -> dict:
    nilai = {s: i for i, s in enumerate(URUT)}
    bahaya = np.isin(y_asli, ["SIAGA", "KRITIS"])
    duga_bahaya = np.isin(y_duga, ["SIAGA", "KRITIS"])
    nd = np.array([nilai.get(x, 0) for x in y_duga])
    nb = np.array([nilai.get(x, 0) for x in y_asli])
    kritis = int((y_asli == "KRITIS").sum())
    lolos = int(((y_asli == "KRITIS") & (y_duga == "AMAN")).sum())

    m = {
        "tepat": float((y_duga == y_asli).mean()),
        "bahaya_tertangkap": float(duga_bahaya[bahaya].mean()) if bahaya.any() else None,
        "alarm_palsu": float(duga_bahaya[~bahaya].mean()) if (~bahaya).any() else None,
        "kritis_terbaca_aman": float(lolos / kritis) if kritis else None,
        "terlalu_waspada": float((nd > nb).mean()),
        "kurang_waspada": float((nd < nb).mean()),
    }
    log.info("--- %s ---", nama)
    log.info("  tepat              : %.1f persen", m["tepat"] * 100)
    if m["bahaya_tertangkap"] is not None:
        log.info("  bahaya tertangkap  : %.1f persen", m["bahaya_tertangkap"] * 100)
    if m["alarm_palsu"] is not None:
        log.info("  alarm palsu        : %.1f persen", m["alarm_palsu"] * 100)
    if m["kritis_terbaca_aman"] is not None:
        log.info("  KRITIS terbaca AMAN: %.2f persen (%d dari %d)",
                 m["kritis_terbaca_aman"] * 100, lolos, kritis)
    log.info("  terlalu waspada    : %.1f persen", m["terlalu_waspada"] * 100)
    log.info("  kurang waspada     : %.1f persen", m["kurang_waspada"] * 100)
    return m


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--sumber", choices=["sintetis", "verifikasi"], default="sintetis")
    p.add_argument("--iterasi", type=int, default=300)
    a = p.parse_args()

    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import confusion_matrix

    if a.sumber == "verifikasi":
        semua = data_verifikasi()
        batas = int(len(semua) * 0.75)     # pembagian berbasis waktu
        latih, uji = semua.iloc[:batas], semua.iloc[batas:]
    else:
        log.info("Membangkitkan data latih dari seed %s", SEED_LATIH)
        latih = data_sintetis(SEED_LATIH)
        log.info("Membangkitkan data uji dari seed %s (tidak dipakai melatih)", SEED_UJI)
        uji = data_sintetis(SEED_UJI)

    Xtr, ytr = latih[FITUR].to_numpy("float32"), latih["label"].to_numpy()
    Xte, yte = uji[FITUR].to_numpy("float32"), uji["label"].to_numpy()
    log.info("Latih %d baris, uji %d baris.", len(Xtr), len(Xte))

    model = HistGradientBoostingClassifier(
        max_iter=a.iterasi, learning_rate=0.08, max_depth=6,
        l2_regularization=1.0, random_state=42,
        # Kondisi berbahaya jauh lebih jarang daripada kondisi aman. Tanpa
        # penyeimbangan, model akan mengambil jalan pintas dengan selalu
        # menebak AMAN dan tetap terlihat "akurat".
        class_weight="balanced",
    ).fit(Xtr, ytr)

    metrik = laporkan("Hasil pada data uji (seed yang belum pernah dilihat)",
                      yte, model.predict(Xte))

    cm = confusion_matrix(yte, model.predict(Xte), labels=URUT)
    log.info("Matriks kebingungan (baris sebenarnya, kolom dugaan)")
    log.info("%-11s%s", "", "".join(f"{u:>9}" for u in URUT))
    for i, u in enumerate(URUT):
        log.info("%-11s%s", u, "".join(f"{v:>9}" for v in cm[i]))

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    jalur = MODELS_DIR / "klasifikasi_status.joblib"
    if jalur.exists():
        arsip = MODELS_DIR / "arsip"
        arsip.mkdir(exist_ok=True)
        cap = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        shutil.copy2(jalur, arsip / f"klasifikasi_status-{cap}.joblib")
    joblib.dump(model, jalur)

    (MODELS_DIR / "klasifikasi_meta.json").write_text(json.dumps({
        "dilatih_pada": datetime.now(timezone.utc).isoformat(),
        "sumber": a.sumber,
        "seed_latih": SEED_LATIH if a.sumber == "sintetis" else None,
        "seed_uji": SEED_UJI if a.sumber == "sintetis" else None,
        "jumlah_baris_latih": int(len(Xtr)),
        "jumlah_baris_uji": int(len(Xte)),
        "fitur": FITUR, "kelas": URUT,
        "metrik_uji": metrik,
    }, indent=2), encoding="utf-8")

    log.info("Model tersimpan di %s", jalur)
    if a.sumber == "sintetis":
        log.warning("Model ini dilatih dari SIMULATOR. Angka di atas menguji kemampuan "
                    "menggeneralisasi antar realisasi simulasi, bukan ketepatan di "
                    "saluran Mangunharjo. Latih ulang dengan --sumber verifikasi "
                    "setelah terkumpul minimal 30 catatan verifikasi lapangan.")


if __name__ == "__main__":
    main()
