"""Peramalan tinggi muka air saluran beberapa jam ke depan (LSTM numerik)."""
from __future__ import annotations

import json
import logging
from datetime import timedelta

import joblib
import numpy as np
import pandas as pd

from .config import settings
from .features import FITUR

log = logging.getLogger("ramalan")

_model = None
_scaler = None


class _Penskala:
    """
    Penskala sederhana pengganti StandardScaler dari scikit-learn.

    Perhitungannya sama persis, yaitu (nilai - rerata) / sebaran, tetapi
    nilainya dibaca dari berkas JSON biasa, bukan dari pickle. Dengan begitu
    model ramalan tidak lagi gagal dibaca hanya karena versi scikit-learn di
    komputer pelatih berbeda dengan versi di tempat menjalankan.
    """

    def __init__(self, mean, scale):
        import numpy as np
        self.mean_ = np.asarray(mean, dtype="float64")
        self.scale_ = np.asarray(scale, dtype="float64")

    def transform(self, x):
        return (x - self.mean_) / self.scale_
_meta: dict = {}


def tersedia() -> bool:
    return settings.model.ramalan.exists() and (
        settings.model.ramalan_scaler.with_suffix(".json").exists()
        or settings.model.ramalan_scaler.exists())


_gagal_muat = False


def _muat() -> None:
    global _model, _scaler, _meta, _gagal_muat
    if _model is not None or _gagal_muat:
        return
    if not tersedia():
        raise FileNotFoundError(
            f"Model ramalan belum ada di {settings.model.ramalan}. "
            "Latih dulu: python -m training.train_forecast"
        )
    import tensorflow as tf

    try:
        _model = tf.keras.models.load_model(settings.model.ramalan, compile=False)
        # Utamakan berkas JSON, karena tidak bergantung pada versi pustaka.
        # Berkas .joblib lama tetap diterima agar pemasangan yang sudah ada
        # tidak langsung rusak setelah pembaruan ini.
        jalur_json = settings.model.ramalan_scaler.with_suffix(".json")
        if jalur_json.exists():
            isi = json.loads(jalur_json.read_text(encoding="utf-8"))
            _scaler = _Penskala(isi["mean"], isi["scale"])
        else:
            _scaler = joblib.load(settings.model.ramalan_scaler)
    except Exception as e:
        _gagal_muat = True
        log.error("Model ramalan gagal dimuat: %s", e)
        log.error("Model ada tetapi tidak dapat dibaca. Penyebab paling sering adalah "
                  "beda versi pustaka antara komputer tempat melatih dan tempat "
                  "menjalankan. Samakan versi pada requirements.txt dan "
                  "requirements-train.txt, lalu latih ulang.")
        log.warning("Ramalan muka air dilewati. Penilaian status tetap berjalan.")
        return
    if settings.model.ramalan_meta.exists():
        _meta = json.loads(settings.model.ramalan_meta.read_text(encoding="utf-8"))
    log.info("Model ramalan dimuat (dilatih %s).", _meta.get("dilatih_pada", "?"))


def ramal(df: pd.DataFrame) -> dict | None:
    """
    Ramalkan tinggi permukaan air untuk beberapa jam ke depan.

    Mengembalikan None bila model belum ada atau data belum cukup panjang.
    Kegagalan di sini tidak boleh menghentikan penilaian status, karena
    penilaian status bertumpu pada aturan, bukan pada ramalan.
    """
    try:
        _muat()
    except FileNotFoundError as e:
        log.warning("%s", e)
        return None

    langkah_in = _meta.get("langkah_input", 72)
    langkah_out = _meta.get("langkah_output", 24)
    menit_langkah = _meta.get("menit_per_langkah", 30)
    idx_target = _meta.get("idx_target", FITUR.index("permukaan_mm"))

    if len(df) < langkah_in:
        log.warning("Data kurang untuk meramal: butuh %d baris, ada %d.", langkah_in, len(df))
        return None

    try:
        x = df[FITUR].to_numpy(dtype="float32")[-langkah_in:]
        xs = _scaler.transform(x).reshape(1, langkah_in, len(FITUR))
        y = _model.predict(xs, verbose=0)[0]

        rerata = float(_scaler.mean_[idx_target])
        sebaran = float(_scaler.scale_[idx_target])
        permukaan = y * sebaran + rerata

        mulai = pd.to_datetime(df["timestamp"].iloc[-1], utc=True)
        # Bila pembacaan sensor terakhir sudah lama, seluruh ramalan menunjuk
        # ke masa lalu. Menampilkan jam puncak dalam keadaan itu menyesatkan,
        # karena pembaca akan mengira jam tersebut masih akan datang.
        from datetime import datetime as _dt, timezone as _tz
        umur_jam = (_dt.now(_tz.utc) - mulai.to_pydatetime()).total_seconds() / 3600
        waktu = [(mulai + timedelta(minutes=menit_langkah * (i + 1))).isoformat()
                 for i in range(len(permukaan))]

        kedalaman = max(settings.saluran.kedalaman_mm, 1.0)
        puncak = float(np.max(permukaan))
        return {
            "waktu": waktu,
            "permukaan_mm": [round(float(v), 1) for v in permukaan],
            "puncak_mm": round(puncak, 1),
            "rasio_puncak": round(puncak / kedalaman, 3),
            "waktu_puncak": waktu[int(np.argmax(permukaan))],
            "berpotensi_meluap": bool(puncak / kedalaman >= settings.ambang.air_meluap),
            "mae_model_mm": _meta.get("metrik", {}).get("mae_mm"),
            "umur_data_jam": round(float(umur_jam), 2),
            "data_basi": bool(umur_jam > 3.0),
        }
    except Exception as e:  # noqa: BLE001
        log.error("Gagal meramal: %s", e)
        return None
