"""Inferensi deteksi anomali dengan Isolation Forest."""
from __future__ import annotations

import json
import logging

import joblib
# Pesan yang dipakai ketika berkas model ada tetapi tidak dapat dibaca.
# Penyebab paling sering adalah beda versi pustaka: model dilatih memakai
# scikit-learn atau numpy versi tertentu, lalu dijalankan memakai versi lain.
# Ciri khasnya adalah kalimat "is not a known BitGenerator module".
_SARAN_VERSI = (
    "Model ada tetapi tidak dapat dibaca. Penyebab paling sering adalah beda "
    "versi pustaka antara komputer tempat melatih dan tempat menjalankan. "
    "Pastikan versi pada requirements.txt dan requirements-train.txt sama "
    "persis, lalu latih ulang modelnya dan unggah hasilnya ke repositori."
)

import numpy as np
import pandas as pd

from .config import settings
from .features import FITUR

log = logging.getLogger("anomali")

_model = None
_scaler = None
_meta: dict = {}


def tersedia() -> bool:
    return settings.model.anomali.exists() and settings.model.anomali_scaler.exists()


_gagal_muat = False


def _gagal_muat_anomali(e: Exception) -> None:
    global _gagal_muat
    _gagal_muat = True
    log.error("Model anomali gagal dimuat: %s", e)
    log.error(_SARAN_VERSI)
    log.warning("Pendeteksi sensor bermasalah dilewati. Penilaian tetap berjalan.")


def _muat() -> None:
    global _model, _scaler, _meta
    if _model is not None or _gagal_muat:
        return
    if not tersedia():
        raise FileNotFoundError(
            f"Model anomali belum ada di {settings.model.anomali}. "
            "Latih dulu: python -m training.train_anomaly"
        )
    try:
        _model = joblib.load(settings.model.anomali)
        _scaler = joblib.load(settings.model.anomali_scaler)
    except Exception as e:
        _gagal_muat_anomali(e)
        return
    if settings.model.anomali_meta.exists():
        _meta = json.loads(settings.model.anomali_meta.read_text(encoding="utf-8"))
    log.info("Model anomali dimuat (dilatih %s).", _meta.get("dilatih_pada", "?"))


def ambang_terlatih() -> float:
    """
    Ambang skor yang dihitung saat pelatihan, bukan angka tetap di .env.

    Skor Isolation Forest tidak punya satuan mutlak: nilainya bergeser
    mengikuti sebaran data latih. Ambang -0,05 pada satu saluran bisa berarti
    "sangat janggal", sedangkan pada saluran lain berarti "biasa saja".
    Karena itu ambang WAJIB diambil dari metadata hasil pelatihan. Nilai di
    berkas .env hanya dipakai bila metadata belum ada.
    """
    try:
        _muat()
    except FileNotFoundError:
        return settings.ambang.anomali
    return float(_meta.get("ambang_skor", settings.ambang.anomali))


def skor(df: pd.DataFrame) -> float | None:
    """
    Skor kejanggalan baris terakhir. Makin negatif makin janggal.

    Mengembalikan None bila model belum dilatih. Sistem tetap berjalan tanpa
    model ini, hanya kehilangan pendapat kedua.
    """
    try:
        _muat()
    except FileNotFoundError as e:
        log.warning("%s", e)
        return None
    try:
        x = df[FITUR].to_numpy(dtype="float32")[-1:]
        return float(_model.score_samples(_scaler.transform(x))[0])
    except Exception as e:  # noqa: BLE001
        log.error("Gagal menghitung skor anomali: %s", e)
        return None


def skor_banyak(df: pd.DataFrame) -> np.ndarray | None:
    """Skor untuk seluruh baris. Dipakai saat evaluasi dan pelatihan ulang."""
    try:
        _muat()
    except FileNotFoundError:
        return None
    x = df[FITUR].to_numpy(dtype="float32")
    return _model.score_samples(_scaler.transform(x))
