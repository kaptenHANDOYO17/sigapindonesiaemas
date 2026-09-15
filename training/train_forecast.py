"""
Pelatihan LSTM numerik untuk meramalkan muka air saluran.

Jalankan:
    python -m training.train_forecast --sumber sintetis --epoch 60
    python -m training.train_forecast --sumber supabase --hari 90 --epoch 60

Model meramalkan permukaan air 12 jam ke depan sekaligus dalam satu tebakan
(peramalan langsung), bukan satu langkah lalu diulang. Peramalan berulang
menumpuk galat sehingga jam-jam terakhir menjadi tidak berguna, padahal
justru jam-jam itulah yang memberi waktu bersiap.

GPU dideteksi sendiri. Panduan pemasangan CUDA ada di docs/PANDUAN_GPU.md
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
from src.features import FITUR, buat_fitur, buat_jendela  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("latih-ramalan")

SINTETIS = ROOT / "datasets" / "sintetis_drainase.csv"
TARGET = "permukaan_mm"


def siapkan_gpu(mixed: bool = True) -> str:
    import tensorflow as tf

    gpus = tf.config.list_physical_devices("GPU")
    if not gpus:
        # Pelatihan di CPU sengaja tidak disediakan. Pada percobaan, melatih di
        # CPU memakan waktu berjam-jam dan hasilnya lebih buruk karena jumlah
        # epoch terpaksa dipangkas. Lebih jujur berhenti di sini daripada
        # membiarkan proses berjalan lama lalu menghasilkan model yang lemah.
        raise SystemExit(
            "GPU tidak terdeteksi, sedangkan pelatihan model peramalan "
            "membutuhkannya.\n\n"
            "Langkah yang perlu Anda tempuh:\n"
            "  1. Pastikan driver NVIDIA di Windows sudah versi terbaru.\n"
            "  2. Jalankan pelatihan dari dalam WSL2, bukan dari PowerShell, "
            "karena TensorFlow di atas versi 2.10 tidak lagi mendukung GPU "
            "pada Windows secara langsung.\n"
            "  3. Pasang TensorFlow beserta CUDA:\n"
            "       pip install \"tensorflow[and-cuda]==2.17.1\"\n"
            "  4. Periksa dengan: nvidia-smi\n\n"
            "Panduan lengkap ada di docs/PANDUAN_GPU.md"
        )
    for g in gpus:
        try:
            tf.config.experimental.set_memory_growth(g, True)
        except RuntimeError:
            pass
    if mixed:
        from tensorflow.keras import mixed_precision
        mixed_precision.set_global_policy("mixed_float16")
        log.info("Mixed precision aktif.")
    log.info("GPU siap: %s", [g.name for g in gpus])
    return "GPU"


def muat(sumber: str, hari: int) -> tuple[pd.DataFrame, str]:
    if sumber == "supabase":
        from src import supabase_client as sb
        df = sb.ambil_sensor_rentang(hari)
        if len(df) < 3000:
            raise SystemExit(
                f"Data Supabase belum cukup untuk melatih LSTM ({len(df)} baris). "
                "Butuh sekitar 3.000 baris, yaitu kira-kira satu bulan pada "
                "interval 15 menit. Pakai --sumber sintetis dulu."
            )
        return df, "supabase"

    if not SINTETIS.exists():
        from training.generate_dataset import simulasikan
        SINTETIS.parent.mkdir(parents=True, exist_ok=True)
        simulasikan(hari=180).to_csv(SINTETIS, index=False)
    return pd.read_csv(SINTETIS, parse_dates=["timestamp"]), "sintetis"


def bangun_model(langkah_in: int, n_fitur: int, langkah_out: int):
    import tensorflow as tf
    from tensorflow.keras import layers, models

    inp = layers.Input(shape=(langkah_in, n_fitur), name="deret_sensor")
    x = layers.LSTM(80, return_sequences=True)(inp)
    x = layers.Dropout(0.15)(x)
    x = layers.LSTM(40)(x)
    x = layers.Dropout(0.15)(x)
    x = layers.Dense(80, activation="relu")(x)
    out = layers.Dense(langkah_out, dtype="float32", name="ramalan")(x)

    m = models.Model(inp, out, name="lstm_level_drainase")
    m.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        # Huber dipakai karena lonjakan muka air saat hujan deras adalah
        # kejadian nyata, bukan pencilan yang harus diabaikan. MSE akan
        # membuat model terlalu terpaku pada lonjakan itu.
        loss=tf.keras.losses.Huber(delta=25.0),
        metrics=["mae"],
    )
    return m


def arsipkan(path: Path) -> None:
    if path.exists():
        arsip = MODELS_DIR / "arsip"
        arsip.mkdir(parents=True, exist_ok=True)
        cap = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        shutil.copy2(path, arsip / f"{path.stem}-{cap}{path.suffix}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--sumber", choices=["sintetis", "supabase"], default="sintetis")
    p.add_argument("--hari", type=int, default=90)
    p.add_argument("--epoch", type=int, default=60)
    p.add_argument("--batch", type=int, default=128)
    p.add_argument("--menit-langkah", type=int, default=15)
    p.add_argument("--jam-input", type=int, default=18)
    p.add_argument("--jam-output", type=int, default=12)
    p.add_argument("--no-mixed", action="store_true")
    a = p.parse_args()

    perangkat = siapkan_gpu(not a.no_mixed)
    import tensorflow as tf
    from sklearn.preprocessing import StandardScaler

    df, sumber = muat(a.sumber, a.hari)
    s = settings.saluran
    df = buat_fitur(df, s.tinggi_pasang_mm, s.kedalaman_mm, s.debit_rancangan_lpm)

    langkah_in = int(a.jam_input * 60 / a.menit_langkah)
    langkah_out = int(a.jam_output * 60 / a.menit_langkah)
    idx_target = FITUR.index(TARGET)

    X_penuh = df[FITUR].to_numpy(dtype="float32")
    n = len(X_penuh)
    batas_latih, batas_val = int(n * 0.75), int(n * 0.88)

    scaler = StandardScaler().fit(X_penuh[:batas_latih])
    skala = scaler.transform(X_penuh).astype("float32")

    X_tr, y_tr = buat_jendela(skala[:batas_val], idx_target, langkah_in, langkah_out)
    pisah = int(len(X_tr) * (batas_latih / batas_val))
    X_val, y_val = X_tr[pisah:], y_tr[pisah:]
    X_tr, y_tr = X_tr[:pisah], y_tr[:pisah]
    X_te, y_te = buat_jendela(skala[batas_val:], idx_target, langkah_in, langkah_out)

    log.info("Latih=%s Validasi=%s Uji=%s", X_tr.shape, X_val.shape, X_te.shape)

    model = bangun_model(langkah_in, len(FITUR), langkah_out)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    arsipkan(settings.model.ramalan)

    model.fit(
        X_tr, y_tr, validation_data=(X_val, y_val),
        epochs=a.epoch, batch_size=a.batch, shuffle=True, verbose=2,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=10,
                                             restore_best_weights=True, verbose=1),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5,
                                                 patience=4, min_lr=1e-5, verbose=1),
            tf.keras.callbacks.ModelCheckpoint(str(settings.model.ramalan),
                                               monitor="val_loss", save_best_only=True),
            tf.keras.callbacks.CSVLogger(str(MODELS_DIR / "riwayat_ramalan.csv"), append=True),
        ],
    )

    # --- Evaluasi dalam satuan milimeter yang bisa dibaca manusia ---
    pred = model.predict(X_te, batch_size=a.batch, verbose=0)
    rerata = float(scaler.mean_[idx_target])
    sebaran = float(scaler.scale_[idx_target])
    pred_mm = pred * sebaran + rerata
    asli_mm = y_te * sebaran + rerata

    mae = float(np.mean(np.abs(pred_mm - asli_mm)))
    rmse = float(np.sqrt(np.mean((pred_mm - asli_mm) ** 2)))
    langkah_3jam = int(3 * 60 / a.menit_langkah)
    mae_3jam = float(np.mean(np.abs(pred_mm[:, :langkah_3jam] - asli_mm[:, :langkah_3jam])))

    log.info("MAE keseluruhan %.1f mm | RMSE %.1f mm | MAE 3 jam pertama %.1f mm",
             mae, rmse, mae_3jam)
    if mae_3jam > s.kedalaman_mm * 0.15:
        log.warning("Galat 3 jam pertama melebihi 15 persen kedalaman saluran. "
                    "Ramalan belum layak dijadikan dasar peringatan.")

    joblib.dump(scaler, settings.model.ramalan_scaler)
    settings.model.ramalan_meta.write_text(json.dumps({
        "dilatih_pada": datetime.now(timezone.utc).isoformat(),
        "perangkat": perangkat,
        "sumber": sumber,
        "fitur": FITUR,
        "target": TARGET,
        "idx_target": idx_target,
        "langkah_input": langkah_in,
        "langkah_output": langkah_out,
        "menit_per_langkah": a.menit_langkah,
        "jumlah_baris": int(n),
        "metrik": {"mae_mm": mae, "rmse_mm": rmse, "mae_3jam_mm": mae_3jam},
    }, indent=2), encoding="utf-8")

    log.info("Selesai. Model: %s", settings.model.ramalan)


if __name__ == "__main__":
    main()
