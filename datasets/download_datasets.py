"""
Pengunduh dataset pendukung.

BACA INI DULU
-------------
Berbeda dengan proyek pengenalan gambar, tidak ada dataset publik yang berisi
"pembacaan sensor radar dan debit dari saluran drainase Indonesia yang berlabel
tersumbat atau tidak". Dataset seperti itu memang belum ada.

Karena itu dataset publik di sini TIDAK dipakai untuk melatih model utama.
Fungsinya ada tiga, dan ketiganya jujur disebutkan:

  1. Menera simulator. Rentang nilai pH dan debit pada data nyata dipakai
     untuk memeriksa apakah angka keluaran simulator masuk akal.
  2. Melatih pemahaman pola musiman curah hujan dan tinggi muka air.
  3. Bahan pembanding saat menulis laporan dan proposal.

Model utama tetap dilatih dari data sensor Anda sendiri. Dataset publik hanya
menjaga agar bulan pertama tidak berjalan tanpa acuan apa pun.

Sumber yang dipakai:
  Kaggle      adityakadiwal/water-potability          (3.276 baris, termasuk pH)
  Kaggle      mssmartypants/water-quality             (kualitas air, banyak parameter)
  HuggingFace pencarian otomatis dengan kata kunci water quality
  Roboflow    pencarian proyek deteksi sampah saluran (untuk pengembangan kamera)

Pemakaian:
    python datasets/download_datasets.py --semua
    python datasets/download_datasets.py --cari
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import zipfile
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("dataset")

ROOT = Path(__file__).resolve().parent.parent
MENTAH = ROOT / "datasets" / "publik"
RINGKAS = ROOT / "datasets" / "ringkasan_acuan.json"

KAGGLE_SLUG = [
    "adityakadiwal/water-potability",
    "mssmartypants/water-quality",
]
HF_KATA_KUNCI = ["water quality", "water level", "flood sensor"]


def unduh_kaggle() -> list[Path]:
    try:
        import kagglehub
    except ImportError:
        log.error("Jalankan dulu: pip install kagglehub")
        return []

    hasil = []
    for slug in KAGGLE_SLUG:
        try:
            log.info("Mengunduh Kaggle: %s", slug)
            jalur = Path(kagglehub.dataset_download(slug))
            tujuan = MENTAH / slug.replace("/", "__")
            tujuan.mkdir(parents=True, exist_ok=True)
            for f in jalur.rglob("*.csv"):
                (tujuan / f.name).write_bytes(f.read_bytes())
                hasil.append(tujuan / f.name)
        except Exception as e:  # noqa: BLE001
            log.error("Gagal mengunduh %s: %s. Pastikan ~/.kaggle/kaggle.json sudah ada.", slug, e)
    return hasil


def unduh_hf(maks: int = 2) -> list[Path]:
    try:
        from huggingface_hub import HfApi
        from datasets import load_dataset
    except ImportError:
        log.error("Jalankan dulu: pip install datasets huggingface_hub")
        return []

    api = HfApi()
    hasil = []
    for kata in HF_KATA_KUNCI:
        try:
            kandidat = list(api.list_datasets(search=kata, limit=5))
        except Exception as e:  # noqa: BLE001
            log.warning("Pencarian HF gagal untuk '%s': %s", kata, e)
            continue

        for d in kandidat[:maks]:
            try:
                log.info("Mencoba HuggingFace: %s", d.id)
                ds = load_dataset(d.id, split="train")
                tujuan = MENTAH / ("hf__" + d.id.replace("/", "__"))
                tujuan.mkdir(parents=True, exist_ok=True)
                berkas = tujuan / "data.csv"
                ds.to_pandas().head(20000).to_csv(berkas, index=False)
                hasil.append(berkas)
                break  # satu dataset per kata kunci sudah cukup
            except Exception as e:  # noqa: BLE001
                log.debug("Lewati %s: %s", d.id, e)
    return hasil


def cari_roboflow() -> None:
    """
    Roboflow dipakai bila kelak Anda menambahkan kamera pada saluran.
    Sistem yang ada sekarang murni berbasis sensor, sehingga langkah ini
    bersifat persiapan untuk pengembangan tahap berikutnya.
    """
    kunci = os.getenv("ROBOFLOW_API_KEY")
    if not kunci:
        log.info("ROBOFLOW_API_KEY belum diisi. Melewati Roboflow.")
        log.info("Untuk pengembangan kamera nanti, cari proyek di: "
                 "https://universe.roboflow.com/search?q=drainage+trash")
        return
    log.info("Roboflow siap dipakai. Cari proyek deteksi sampah saluran di "
             "https://universe.roboflow.com/search?q=drainage+trash lalu "
             "masukkan slug proyeknya ke berkas ini.")


def ringkas_acuan(berkas: list[Path]) -> None:
    """Ambil rentang nilai wajar dari data publik untuk menera simulator."""
    import pandas as pd

    acuan: dict[str, dict] = {}
    for f in berkas:
        try:
            df = pd.read_csv(f, nrows=50000)
        except Exception:  # noqa: BLE001
            continue
        for kolom in df.columns:
            nama = kolom.strip().lower()
            if nama not in ("ph", "turbidity", "solids", "conductivity", "hardness"):
                continue
            seri = pd.to_numeric(df[kolom], errors="coerce").dropna()
            if seri.empty:
                continue
            acuan.setdefault(nama, {})[f.parent.name] = {
                "n": int(len(seri)),
                "min": round(float(seri.min()), 3),
                "p05": round(float(seri.quantile(0.05)), 3),
                "median": round(float(seri.median()), 3),
                "p95": round(float(seri.quantile(0.95)), 3),
                "maks": round(float(seri.max()), 3),
            }

    RINGKAS.parent.mkdir(parents=True, exist_ok=True)
    RINGKAS.write_text(json.dumps(acuan, indent=2), encoding="utf-8")
    log.info("Ringkasan acuan tersimpan: %s", RINGKAS)

    if "ph" in acuan:
        for sumber, nilai in acuan["ph"].items():
            log.info("  pH dari %s: median %.2f, rentang wajar %.2f sampai %.2f",
                     sumber, nilai["median"], nilai["p05"], nilai["p95"])
        log.info("Bandingkan angka di atas dengan AMBANG_PH_MIN dan AMBANG_PH_MAX "
                 "di berkas .env Anda.")


def kemas() -> None:
    zip_path = ROOT / "datasets" / "dataset_publik.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for f in MENTAH.rglob("*"):
            if f.is_file():
                z.write(f, f.relative_to(MENTAH.parent))
        if RINGKAS.exists():
            z.write(RINGKAS, RINGKAS.name)
    log.info("Dikemas: %s (%.1f MB)", zip_path, zip_path.stat().st_size / 1e6)


def cari_alternatif() -> None:
    log.info("--- Dataset alternatif yang masih aktif ---")
    try:
        from huggingface_hub import HfApi
        for kata in HF_KATA_KUNCI:
            for d in HfApi().list_datasets(search=kata, limit=8):
                log.info("[HF]     %s", d.id)
    except Exception as e:  # noqa: BLE001
        log.warning("Pencarian HF gagal: %s", e)
    try:
        import subprocess
        for kata in ["water quality", "drainage", "flood sensor"]:
            out = subprocess.run(["kaggle", "datasets", "list", "-s", kata],
                                 capture_output=True, text=True, timeout=60)
            for baris in out.stdout.splitlines()[:6]:
                log.info("[Kaggle] %s", baris)
    except Exception as e:  # noqa: BLE001
        log.warning("Pencarian Kaggle gagal: %s", e)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--semua", action="store_true")
    p.add_argument("--sumber", nargs="*", default=[], choices=["kaggle", "hf", "roboflow"])
    p.add_argument("--cari", action="store_true")
    a = p.parse_args()

    MENTAH.mkdir(parents=True, exist_ok=True)
    if a.cari:
        cari_alternatif()
        return

    sumber = ["kaggle", "hf", "roboflow"] if a.semua else (a.sumber or ["kaggle"])
    berkas: list[Path] = []
    if "kaggle" in sumber:
        berkas += unduh_kaggle()
    if "hf" in sumber:
        berkas += unduh_hf()
    if "roboflow" in sumber:
        cari_roboflow()

    if berkas:
        ringkas_acuan(berkas)
        kemas()
    else:
        log.warning("Tidak ada berkas terunduh. Sistem tetap bisa berjalan dengan "
                    "data sintetis: python -m training.generate_dataset")


if __name__ == "__main__":
    main()
