"""
Pelatihan model deteksi anomali (Isolation Forest).

Jalankan:
    python -m training.train_anomaly --sumber sintetis     # bulan pertama
    python -m training.train_anomaly --sumber supabase --hari 30

Isolation Forest dipilih karena tidak memerlukan label. Pada bulan-bulan
awal, tidak ada seorang pun yang tahu saluran mana yang "benar tersumbat",
sehingga model terawasi tidak mungkin dilatih. Yang bisa dilakukan model ini
hanyalah mengenali pola yang jarang muncul, lalu menandainya untuk diperiksa
manusia.

Model ini TIDAK berwenang menyatakan saluran aman. Wewenangnya hanya
menaikkan status satu tingkat. Lihat src/rules.py.
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
log = logging.getLogger("latih-anomali")

SINTETIS = ROOT / "datasets" / "sintetis_drainase.csv"


def muat(sumber: str, hari: int) -> tuple[pd.DataFrame, str]:
    if sumber == "supabase":
        from src import supabase_client as sb
        df = sb.ambil_sensor_rentang(hari)
        if df.empty or len(df) < 500:
            raise SystemExit(
                f"Data Supabase belum cukup ({len(df)} baris). Butuh minimal 500. "
                "Pakai --sumber sintetis dulu sampai sensor mengumpulkan data."
            )
        return df, "supabase"

    if not SINTETIS.exists():
        log.info("Data sintetis belum ada. Membangkitkan sekarang.")
        from training.generate_dataset import simulasikan
        SINTETIS.parent.mkdir(parents=True, exist_ok=True)
        simulasikan(hari=180).to_csv(SINTETIS, index=False)
    return pd.read_csv(SINTETIS, parse_dates=["timestamp"]), "sintetis"


def arsipkan(path: Path) -> None:
    if path.exists():
        arsip = MODELS_DIR / "arsip"
        arsip.mkdir(parents=True, exist_ok=True)
        cap = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        shutil.copy2(path, arsip / f"{path.stem}-{cap}{path.suffix}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--sumber", choices=["sintetis", "supabase"], default="sintetis")
    p.add_argument("--hari", type=int, default=30)
    p.add_argument("--kontaminasi", type=float, default=0.04,
                   help="perkiraan proporsi data yang memang janggal")
    p.add_argument("--pohon", type=int, default=300)
    a = p.parse_args()

    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    df, sumber = muat(a.sumber, a.hari)
    log.info("Sumber data: %s (%d baris)", sumber, len(df))

    s = settings.saluran
    df = buat_fitur(df, s.tinggi_pasang_mm, s.kedalaman_mm, s.debit_rancangan_lpm)

    X = df[FITUR].to_numpy(dtype="float32")
    # Pembagian berdasarkan waktu, bukan acak, supaya tidak ada kebocoran
    # informasi masa depan ke dalam data latih.
    batas = int(len(X) * 0.8)
    X_latih, X_uji = X[:batas], X[batas:]

    scaler = StandardScaler().fit(X_latih)
    model = IsolationForest(
        n_estimators=a.pohon,
        contamination=a.kontaminasi,
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    ).fit(scaler.transform(X_latih))

    skor_latih = model.score_samples(scaler.transform(X_latih))
    skor_uji = model.score_samples(scaler.transform(X_uji))

    # Ambang diambil dari persentil skor pada data latih, bukan angka tetap,
    # supaya ikut menyesuaikan karakter saluran masing-masing.
    ambang = float(np.percentile(skor_latih, a.kontaminasi * 100))
    proporsi_uji = float((skor_uji < ambang).mean())

    log.info("Ambang skor anomali: %.4f", ambang)
    log.info("Proporsi janggal pada data uji: %.2f persen", proporsi_uji * 100)
    if proporsi_uji > a.kontaminasi * 3:
        log.warning("Data uji jauh lebih janggal daripada data latih. "
                    "Kemungkinan kondisi saluran berubah, atau sensor bermasalah.")

    # Bila tersedia label sintetis, periksa apakah model benar-benar menangkap
    # kejadian sumbatan. Ini satu-satunya kesempatan mengukur sebelum data
    # verifikasi lapangan tersedia.
    if "asli_sumbatan" in df.columns:
        sumbat = df["asli_sumbatan"].to_numpy()[batas:] > 0.25
        janggal = skor_uji < ambang
        if sumbat.any():
            tertangkap = float(janggal[sumbat].mean())
            palsu = float(janggal[~sumbat].mean())
            log.info("Kejadian sumbatan tertangkap: %.0f persen", tertangkap * 100)
            log.info("Alarm palsu saat kondisi normal: %.1f persen", palsu * 100)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    arsipkan(settings.model.anomali)
    joblib.dump(model, settings.model.anomali)
    joblib.dump(scaler, settings.model.anomali_scaler)
    settings.model.anomali_meta.write_text(json.dumps({
        "dilatih_pada": datetime.now(timezone.utc).isoformat(),
        "sumber": sumber,
        "jumlah_baris": int(len(df)),
        "fitur": FITUR,
        "kontaminasi": a.kontaminasi,
        "ambang_skor": ambang,
        "proporsi_janggal_uji": proporsi_uji,
        "saluran": settings.saluran.id,
    }, indent=2), encoding="utf-8")

    log.info("Selesai. Model: %s", settings.model.anomali)
    if sumber == "sintetis":
        log.warning("Model ini dilatih dari data SINTETIS. Latih ulang dengan "
                    "--sumber supabase setelah sensor mengumpulkan data sebulan.")


if __name__ == "__main__":
    main()
