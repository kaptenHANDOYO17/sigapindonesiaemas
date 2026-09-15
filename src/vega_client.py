"""
Penarik data sensor.

Ada dua jalur masuk data, dan sistem menerima keduanya:

JALUR A — VEGAPULS Air 23 (radar level)
    Sensor ini mandiri berbaterai. Ia tidak dihubungkan ke mikrokontroler.
    Datanya dikirim sendiri lewat jaringan NB-IoT, LTE-M, atau LoRaWAN
    menuju VEGA Inventory System, yang menyediakan REST API. Modul ini
    menarik pembacaan terbaru dari API tersebut.

JALUR B — Sensor debit dan pH
    Kedua sensor ini bukan perangkat mandiri, sehingga dihubungkan ke
    mikrokontroler ESP32 yang mengirim data langsung ke Supabase. Kodenya
    ada di firmware/esp32_drainase/.

Modul ini juga menarik curah hujan dari Open-Meteo. Tanpa data hujan,
debit rendah tidak bisa dibedakan antara "saluran tersumbat" dan "memang
sedang tidak hujan" — dan kekeliruan itu akan membuat sistem membunyikan
alarm palsu sepanjang musim kemarau.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from .config import settings

log = logging.getLogger("sensor")
TIMEOUT = 30
PERCOBAAN = 3

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"


def _ambil(url: str, **kw) -> dict | None:
    for n in range(1, PERCOBAAN + 1):
        try:
            r = requests.get(url, timeout=TIMEOUT, **kw)
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            log.warning("Gagal mengambil %s (percobaan %d/%d): %s", url, n, PERCOBAAN, e)
    return None


# ---------------------------------------------------------------------------
# VEGA Inventory System
# ---------------------------------------------------------------------------
def ambil_vega(sejak_menit: int = 120) -> list[dict[str, Any]]:
    """
    Tarik pembacaan terbaru VEGAPULS Air 23 dari VEGA Inventory System.

    Struktur balasan API dapat berbeda antar versi dan antar langganan.
    Karena itu modul ini mencoba beberapa bentuk yang umum lalu menormalkan
    hasilnya menjadi daftar berisi timestamp dan jarak dalam milimeter.
    Bila struktur di akun Anda berbeda, sesuaikan fungsi `_normalkan` saja.
    """
    if not (settings.vega_token and settings.vega_device_id):
        log.info("VEGA belum dikonfigurasi. Melewati penarikan radar.")
        return []

    sejak = datetime.now(timezone.utc) - timedelta(minutes=sejak_menit)
    url = f"{settings.vega_base_url.rstrip('/')}/devices/{settings.vega_device_id}/measurements"
    data = _ambil(
        url,
        headers={"Authorization": f"Bearer {settings.vega_token}",
                 "Accept": "application/json"},
        params={"from": sejak.isoformat(), "to": datetime.now(timezone.utc).isoformat()},
    )
    if not data:
        return []
    return _normalkan(data)


def _normalkan(data: Any) -> list[dict[str, Any]]:
    """Ubah berbagai bentuk balasan API menjadi satu bentuk baku."""
    if isinstance(data, dict):
        for kunci in ("measurements", "values", "data", "items", "results"):
            if kunci in data and isinstance(data[kunci], list):
                data = data[kunci]
                break
        else:
            data = [data]

    hasil = []
    for baris in data:
        if not isinstance(baris, dict):
            continue
        waktu = (baris.get("timestamp") or baris.get("time")
                 or baris.get("measurementTime") or baris.get("date"))
        nilai = baris.get("value")
        if nilai is None:
            nilai = baris.get("distance") or baris.get("level") or baris.get("measurement")
        if isinstance(nilai, dict):
            nilai = nilai.get("value")
        if waktu is None or nilai is None:
            continue

        satuan = str(baris.get("unit") or baris.get("uom") or "mm").lower()
        jarak_mm = float(nilai)
        if satuan in ("m", "meter", "metre"):
            jarak_mm *= 1000.0
        elif satuan in ("cm", "centimeter"):
            jarak_mm *= 10.0

        hasil.append({"timestamp": str(waktu), "jarak_mm": round(jarak_mm, 1)})

    log.info("VEGA: %d pembacaan diterima.", len(hasil))
    return hasil


# ---------------------------------------------------------------------------
# Curah hujan
# ---------------------------------------------------------------------------
def ambil_hujan(jam_ke_belakang: int = 24, jam_ke_depan: int = 12) -> dict[str, Any]:
    """Curah hujan per jam di sekitar titik sensor, ke belakang dan ke depan."""
    s = settings.saluran
    data = _ambil(
        OPEN_METEO,
        params={
            "latitude": s.lat, "longitude": s.lon,
            "hourly": "precipitation,rain",
            "past_days": max(1, jam_ke_belakang // 24 + 1),
            "forecast_days": max(1, jam_ke_depan // 24 + 1),
            "timezone": "UTC",
        },
    )
    if not data or "hourly" not in data:
        log.warning("Data hujan tidak tersedia. Penilaian debit memakai asumsi kering.")
        return {"waktu": [], "hujan": [], "tersedia": False}

    return {
        "waktu": data["hourly"]["time"],
        "hujan": [0.0 if v is None else float(v) for v in data["hourly"]["precipitation"]],
        "tersedia": True,
    }


def hujan_saat_ini(hujan: dict[str, Any]) -> float:
    """Curah hujan pada jam berjalan, dalam milimeter per jam."""
    if not hujan.get("tersedia") or not hujan["waktu"]:
        return 0.0
    sekarang = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    target = sekarang.strftime("%Y-%m-%dT%H:00")
    try:
        return float(hujan["hujan"][hujan["waktu"].index(target)])
    except (ValueError, IndexError):
        return float(hujan["hujan"][-1]) if hujan["hujan"] else 0.0
