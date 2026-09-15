"""
Pengunduh data asli untuk Mangunharjo.

BACA INI DULU
-------------
Skrip ini TIDAK dapat dijalankan dari lingkungan tempat proyek ini disusun,
karena akses ke API cuaca diblokir di sana. Jalankan di laptop Anda sendiri,
yang tidak punya batasan itu.

APA YANG DIAMBIL, DAN APA YANG TIDAK
------------------------------------
Yang diambil ASLI:
  1. Curah hujan per jam di titik saluran, dari Open-Meteo ERA5, sepanjang
     tahun yang Anda minta. Ini data pengukuran ulang (reanalysis) yang
     dibangun dari stasiun cuaca, satelit, dan radar.
  2. Tinggi muka laut per jam, dari Open-Meteo Marine. Mangunharjo berada di
     pesisir, dan air laut pasang menahan aliran keluar saluran. Tanpa ini,
     genangan saat pasang tidak terwakili.

Yang TIDAK bisa diambil, karena memang belum ada di dunia:
  3. Tinggi endapan dan label tersumbat pada saluran drainase permukiman
     Indonesia. Tidak ada satu pun dataset publik berisi itu. Satu-satunya
     sumbernya adalah petugas yang mengisi formulir verifikasi di lapangan.

Karena itu setelah skrip ini dijalankan, yang berubah adalah PENDORONG
simulasi menjadi cuaca sungguhan Semarang, bukan cuaca buatan. Labelnya tetap
berasal dari model fisika. Itu perbaikan nyata dan besar, tetapi bukan berarti
model menjadi "terlatih pada data asli" sepenuhnya. Jangan menyebutnya begitu
dalam proposal.

Pemakaian:
    pip install requests pandas
    python datasets/unduh_data_asli.py --tahun 10
    python -m training.generate_dataset --hujan-asli
    python -m training.train_classifier --sumber sintetis
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("unduh")

ROOT = Path(__file__).resolve().parent.parent
KELUAR = ROOT / "datasets" / "asli"

LAT, LON = -6.9575, 110.3160          # Kelurahan Mangunharjo, Kecamatan Tugu
ARSIP = "https://archive-api.open-meteo.com/v1/archive"
LAUT = "https://marine-api.open-meteo.com/v1/marine"


def ambil(url: str, params: dict, percobaan: int = 3) -> dict | None:
    for n in range(1, percobaan + 1):
        try:
            r = requests.get(url, params=params, timeout=120)
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            log.warning("Percobaan %d dari %d gagal: %s", n, percobaan, e)
    return None


def unduh_hujan(mulai: date, akhir: date) -> pd.DataFrame:
    """Curah hujan per jam dari ERA5. Satu permintaan bisa mencakup puluhan tahun."""
    log.info("Mengunduh curah hujan %s sampai %s ...", mulai, akhir)
    d = ambil(ARSIP, {
        "latitude": LAT, "longitude": LON,
        "start_date": mulai.isoformat(), "end_date": akhir.isoformat(),
        "hourly": "precipitation",
        "timezone": "Asia/Bangkok",
    })
    if not d or "hourly" not in d:
        raise SystemExit(
            "Gagal mengunduh curah hujan. Periksa sambungan internet Anda. "
            "Bila situs sedang sibuk, coba lagi beberapa menit kemudian."
        )
    df = pd.DataFrame({
        "waktu": pd.to_datetime(d["hourly"]["time"]),
        "hujan_mm": [0.0 if v is None else float(v) for v in d["hourly"]["precipitation"]],
    })
    log.info("  %d jam data hujan diterima.", len(df))
    return df


def unduh_pasang(mulai: date, akhir: date) -> pd.DataFrame | None:
    """
    Tinggi muka laut per jam. Cakupan API laut lebih pendek daripada ERA5,
    sehingga bila gagal, program tetap berjalan tanpa data pasang.
    """
    log.info("Mengunduh tinggi muka laut %s sampai %s ...", mulai, akhir)
    d = ambil(LAUT, {
        "latitude": LAT, "longitude": LON,
        "start_date": mulai.isoformat(), "end_date": akhir.isoformat(),
        "hourly": "sea_level_height_msl",
        "timezone": "Asia/Bangkok",
    }, percobaan=2)
    if not d or "hourly" not in d:
        log.warning("Data pasang tidak tersedia untuk rentang ini. Dilewati. "
                    "Simulasi akan berjalan tanpa pengaruh pasang laut.")
        return None
    nilai = d["hourly"].get("sea_level_height_msl") or []
    if not any(v is not None for v in nilai):
        log.warning("Data pasang kosong. Dilewati.")
        return None
    df = pd.DataFrame({
        "waktu": pd.to_datetime(d["hourly"]["time"]),
        "muka_laut_m": [None if v is None else float(v) for v in nilai],
    })
    df["muka_laut_m"] = df["muka_laut_m"].interpolate(limit_direction="both")
    log.info("  %d jam data pasang diterima.", len(df))
    return df


def ringkas(hujan: pd.DataFrame) -> dict:
    """Ringkasan iklim yang bisa Anda kutip dalam proposal."""
    h = hujan.set_index("waktu")["hujan_mm"]
    harian = h.resample("D").sum()
    bulanan = harian.groupby(harian.index.month).mean()
    return {
        "rentang": [str(h.index.min().date()), str(h.index.max().date())],
        "jumlah_jam": int(len(h)),
        "hujan_tahunan_rerata_mm": round(float(harian.mean() * 365.25), 1),
        "persen_hari_berhujan": round(float((harian > 1).mean()) * 100, 1),
        "hujan_harian_maksimum_mm": round(float(harian.max()), 1),
        "hujan_per_jam_maksimum_mm": round(float(h.max()), 1),
        "rerata_hujan_harian_per_bulan_mm": {
            str(b): round(float(v), 2) for b, v in bulanan.items()
        },
        "bulan_terbasah": int(bulanan.idxmax()),
        "bulan_terkering": int(bulanan.idxmin()),
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--tahun", type=int, default=10, help="berapa tahun ke belakang")
    p.add_argument("--tanpa-pasang", action="store_true")
    a = p.parse_args()

    akhir = date.today() - timedelta(days=6)     # ERA5 tertinggal beberapa hari
    mulai = akhir - timedelta(days=int(365.25 * a.tahun))
    KELUAR.mkdir(parents=True, exist_ok=True)

    hujan = unduh_hujan(mulai, akhir)
    hujan.to_csv(KELUAR / "hujan_mangunharjo.csv", index=False)
    log.info("Tersimpan: %s", KELUAR / "hujan_mangunharjo.csv")

    if not a.tanpa_pasang:
        # API laut biasanya hanya menyediakan beberapa tahun terakhir.
        pasang = unduh_pasang(max(mulai, akhir - timedelta(days=365 * 3)), akhir)
        if pasang is not None:
            pasang.to_csv(KELUAR / "pasang_mangunharjo.csv", index=False)
            log.info("Tersimpan: %s", KELUAR / "pasang_mangunharjo.csv")

    r = ringkas(hujan)
    (KELUAR / "ringkasan_iklim.json").write_text(
        json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")

    log.info("")
    log.info("=" * 66)
    log.info("RINGKASAN IKLIM MANGUNHARJO (dapat dikutip dalam proposal)")
    log.info("=" * 66)
    log.info("Rentang data          : %s sampai %s", *r["rentang"])
    log.info("Curah hujan tahunan   : %.0f mm", r["hujan_tahunan_rerata_mm"])
    log.info("Hari berhujan         : %.1f persen", r["persen_hari_berhujan"])
    log.info("Hujan harian terbesar : %.1f mm", r["hujan_harian_maksimum_mm"])
    log.info("Hujan per jam terbesar: %.1f mm", r["hujan_per_jam_maksimum_mm"])
    log.info("Bulan terbasah        : bulan ke-%d", r["bulan_terbasah"])
    log.info("Bulan terkering       : bulan ke-%d", r["bulan_terkering"])
    log.info("")
    log.info("Sumber: Open-Meteo ERA5 reanalysis. Sebutkan sumber ini bila "
             "angka di atas dikutip.")
    log.info("")
    log.info("Langkah berikutnya:")
    log.info("  python -m training.generate_dataset --hujan-asli --hari 730")
    log.info("  python -m training.train_classifier --sumber sintetis")
    log.info("  python -m training.protokol")


if __name__ == "__main__":
    main()
