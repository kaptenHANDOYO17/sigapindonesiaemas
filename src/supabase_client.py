"""Klien Supabase ringan berbasis REST (PostgREST)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import requests

from .config import settings

log = logging.getLogger("supabase")
TIMEOUT = 30


def _h(extra: dict | None = None) -> dict:
    h = {
        "apikey": settings.supabase_key,
        "Authorization": f"Bearer {settings.supabase_key}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def _url(tabel: str) -> str:
    return f"{settings.supabase_url.rstrip('/')}/rest/v1/{tabel}"


# ------------------------------------------------------------ data sensor
def simpan_sensor(baris: list[dict]) -> int:
    """Simpan pembacaan sensor. Duplikat digabung berdasarkan waktu dan saluran."""
    if not baris or settings.dry_run:
        return 0
    try:
        r = requests.post(
            _url("sensor_drainase"),
            headers=_h({"Prefer": "resolution=merge-duplicates,return=minimal"}),
            json=baris, timeout=TIMEOUT,
        )
        r.raise_for_status()
        log.info("%d baris sensor tersimpan.", len(baris))
        return len(baris)
    except Exception as e:  # noqa: BLE001
        log.error("Gagal menyimpan data sensor: %s", e)
        return 0


def ambil_sensor(menit: int = 4320) -> pd.DataFrame:
    """Tarik riwayat sensor. Bawaan tiga hari ke belakang."""
    sejak = (datetime.now(timezone.utc) - pd.Timedelta(minutes=menit)).isoformat()
    try:
        r = requests.get(
            _url("sensor_drainase"), headers=_h(),
            params={
                "select": "timestamp,jarak_mm,debit_lpm,ph_air,hujan_mm",
                "saluran_id": f"eq.{settings.saluran.id}",
                "timestamp": f"gte.{sejak}",
                "order": "timestamp.asc", "limit": "20000",
            },
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        df = pd.DataFrame(r.json())
        if not df.empty:
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, format="mixed")
        return df
    except Exception as e:  # noqa: BLE001
        log.error("Gagal mengambil data sensor: %s", e)
        return pd.DataFrame()


def ambil_sensor_rentang(hari: int) -> pd.DataFrame:
    """Dipakai pelatihan ulang bulanan."""
    return ambil_sensor(menit=hari * 24 * 60)


# ------------------------------------------------------------ status AI
def simpan_status(data: dict) -> dict | None:
    if settings.dry_run:
        log.info("[UJI COBA] status tidak disimpan: %s", data.get("status"))
        return None
    try:
        r = requests.post(
            _url("status_ai"), headers=_h({"Prefer": "return=representation"}),
            json=data, timeout=TIMEOUT,
        )
        r.raise_for_status()
        hasil = r.json()
        return hasil[0] if hasil else None
    except Exception as e:  # noqa: BLE001
        log.error("Gagal menyimpan status: %s", e)
        return None


def status_terakhir() -> dict | None:
    try:
        r = requests.get(
            _url("status_ai"), headers=_h(),
            params={"select": "*", "saluran_id": f"eq.{settings.saluran.id}",
                    "order": "timestamp.desc", "limit": "1"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        d = r.json()
        return d[0] if d else None
    except Exception as e:  # noqa: BLE001
        log.error("Gagal mengambil status terakhir: %s", e)
        return None


# ------------------------------------------------------------ kontak
def ambil_kontak(peran: str | None = None) -> list[dict]:
    # Hanya kontak yang aktif DAN sudah terkonfirmasi yang dikirimi pesan.
    # Pendaftaran lewat situs masuk dengan aktif=false, sehingga nomor yang
    # didaftarkan orang lain tidak akan menerima apa pun sebelum diperiksa.
    params = {
        "select": "nama,nomor_kontak,chat_id,peran,kanal",
        "aktif": "is.true",
        "terkonfirmasi": "is.true",
    }
    if peran:
        params["peran"] = f"eq.{peran}"
    try:
        r = requests.get(_url("kontak_stakeholder"), headers=_h(),
                         params=params, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as e:  # noqa: BLE001
        log.error("Gagal mengambil daftar kontak: %s", e)
        return []


def daftarkan_kontak(chat_id: str, nama: str, peran: str = "warga",
                     nomor: str = "", kanal: str = "telegram") -> bool:
    try:
        r = requests.post(
            _url("kontak_stakeholder"),
            headers=_h({"Prefer": "resolution=merge-duplicates,return=minimal"}),
            # Pendaftaran lewat bot langsung terkonfirmasi, karena wargalah
            # yang memulai percakapan. Persetujuannya sudah jelas dengan
            # sendirinya, berbeda dengan formulir terbuka di situs.
            json={"chat_id": str(chat_id), "nama": nama, "peran": peran,
                  "nomor_kontak": nomor, "kanal": kanal, "aktif": True,
                  "terkonfirmasi": True, "sumber_daftar": "telegram"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        return True
    except Exception as e:  # noqa: BLE001
        log.error("Gagal mendaftarkan kontak %s: %s", chat_id, e)
        return False


def nonaktifkan_kontak(chat_id: str) -> bool:
    try:
        r = requests.patch(
            _url("kontak_stakeholder"), headers=_h({"Prefer": "return=minimal"}),
            params={"chat_id": f"eq.{chat_id}"}, json={"aktif": False}, timeout=TIMEOUT,
        )
        r.raise_for_status()
        return True
    except Exception:  # noqa: BLE001
        return False


# ------------------------------------------------------------ notifikasi
def catat_notifikasi(tujuan: str, peran: str, kanal: str,
                     status: str, berhasil: bool, isi: str = "") -> None:
    if settings.dry_run:
        return
    try:
        requests.post(
            _url("log_notifikasi"), headers=_h({"Prefer": "return=minimal"}),
            json={"tujuan": tujuan, "peran": peran, "kanal": kanal,
                  "status": status, "berhasil": berhasil, "isi": isi[:1000]},
            timeout=TIMEOUT,
        )
    except Exception:  # noqa: BLE001
        pass


def jam_sejak_notifikasi_terakhir() -> float | None:
    try:
        r = requests.get(
            _url("log_notifikasi"), headers=_h(),
            params={"select": "dikirim_pada", "berhasil": "is.true",
                    "order": "dikirim_pada.desc", "limit": "1"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        d = r.json()
        if not d:
            return None
        t = datetime.fromisoformat(d[0]["dikirim_pada"].replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - t).total_seconds() / 3600
    except Exception:  # noqa: BLE001
        return None


# ------------------------------------------------------------ verifikasi BPBD
def ambil_verifikasi(hari: int = 60) -> pd.DataFrame:
    """
    Hasil pemeriksaan petugas setelah pembersihan.

    Inilah satu-satunya sumber kebenaran di seluruh sistem. Tanpa data ini,
    model hanya bisa menebak; dengan data ini, model bisa belajar.
    """
    sejak = (datetime.now(timezone.utc) - pd.Timedelta(days=hari)).isoformat()
    try:
        r = requests.get(
            _url("verifikasi_lapangan"), headers=_h(),
            params={"select": "*", "waktu_periksa": f"gte.{sejak}",
                    "order": "waktu_periksa.asc", "limit": "5000"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        df = pd.DataFrame(r.json())
        if not df.empty:
            df["waktu_periksa"] = pd.to_datetime(df["waktu_periksa"], utc=True, format="mixed")
        return df
    except Exception as e:  # noqa: BLE001
        log.error("Gagal mengambil data verifikasi: %s", e)
        return pd.DataFrame()
