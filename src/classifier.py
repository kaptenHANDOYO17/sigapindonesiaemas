"""
Inferensi model klasifikasi status (terawasi).

Model ini menggantikan peran Isolation Forest sebagai pendapat kedua. Alasannya
ada di training/train_classifier.py: pada pengujian, model tak terawasi hanya
menangkap sekitar 5 persen kejadian berbahaya, sedangkan model terawasi
menangkap lebih dari 90 persen pada data uji dari seed yang belum pernah
dilihat.

WEWENANGNYA TETAP DIBATASI. Model boleh MENAIKKAN status, tidak boleh
menurunkannya. Pembatasan ini dipertahankan karena angka ketepatan di atas
berasal dari simulator, bukan dari saluran Mangunharjo. Setelah terkumpul data
verifikasi lapangan yang cukup dan ketepatannya terbukti, pembatasan ini boleh
dilonggarkan, tetapi keputusan itu harus diambil manusia, bukan oleh kode.
"""
from __future__ import annotations

import json
import logging

import joblib
import numpy as np
import pandas as pd

from .config import MODELS_DIR
from .features import FITUR

log = logging.getLogger("klasifikasi")

JALUR = MODELS_DIR / "klasifikasi_status.joblib"
META = MODELS_DIR / "klasifikasi_meta.json"

_model = None
_meta: dict = {}


def tersedia() -> bool:
    return JALUR.exists()



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

_gagal_muat = False


def _muat() -> None:
    global _model, _meta, _gagal_muat
    if _model is not None or _gagal_muat:
        return
    if not tersedia():
        raise FileNotFoundError(
            f"Model klasifikasi belum ada di {JALUR}. "
            "Latih dulu: python -m training.train_classifier --sumber sintetis"
        )
    try:
        _model = joblib.load(JALUR)
    except Exception as e:
        # Sengaja tidak melempar galat. Penilaian status tetap dapat berjalan
        # memakai matriks aturan saja, hanya tanpa pendapat kedua dari model.
        # Menghentikan seluruh siklus karena satu model gagal dibaca berarti
        # warga tidak menerima peringatan apa pun, dan itu jauh lebih merugikan.
        _gagal_muat = True
        log.error("Model klasifikasi gagal dimuat: %s", e)
        log.error(_SARAN_VERSI)
        log.warning("Penilaian dilanjutkan dengan matriks aturan saja.")
        return
    if META.exists():
        _meta = json.loads(META.read_text(encoding="utf-8"))
    log.info("Model klasifikasi dimuat (sumber %s, dilatih %s).",
             _meta.get("sumber", "?"), _meta.get("dilatih_pada", "?"))


def duga(df: pd.DataFrame) -> dict | None:
    """
    Dugaan status untuk baris terakhir, beserta keyakinannya.

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
        kelas = list(_model.classes_)
        peluang = _model.predict_proba(x)[0]
        i = int(np.argmax(peluang))
        return {
            "status": str(kelas[i]),
            "keyakinan": round(float(peluang[i]), 4),
            "peluang": {str(k): round(float(p), 4) for k, p in zip(kelas, peluang)},
            "sumber_pelatihan": _meta.get("sumber", "?"),
        }
    except Exception as e:  # noqa: BLE001
        log.error("Gagal menjalankan model klasifikasi: %s", e)
        return None


def duga_banyak(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray] | None:
    """
    Dugaan dan keyakinan untuk seluruh baris. Dipakai saat evaluasi.

    Mengembalikan keyakinan, bukan sekadar kelas, supaya evaluasi memakai
    aturan yang persis sama dengan pipeline sungguhan. Bila evaluasi memakai
    keyakinan tetap 1,0 sementara pipeline memakai peluang sebenarnya, angka
    hasil evaluasi tidak menggambarkan perilaku sistem yang berjalan.
    """
    try:
        _muat()
    except FileNotFoundError:
        return None
    x = df[FITUR].to_numpy(dtype="float32")
    peluang = _model.predict_proba(x)
    kelas = np.asarray(_model.classes_)
    i = peluang.argmax(axis=1)
    return kelas[i], peluang.max(axis=1)
