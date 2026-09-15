"""
SIGAP Drainase — pipeline utama.

Satu kali jalan setara satu siklus lengkap:

    1. Tarik pembacaan radar dari VEGA Inventory System
    2. Tarik curah hujan dari Open-Meteo
    3. Simpan ke Supabase, lalu baca kembali riwayatnya
    4. Bangun fitur dan taksir tinggi endapan
    5. Nilai status dengan matriks aturan, ditambah pendapat model anomali
    6. Ramalkan muka air beberapa jam ke depan
    7. Perkirakan volume dan jenis material
    8. Simpan status, lalu kirim notifikasi bila perlu

Jalankan:
    python -m src.main                 siklus penuh
    python -m src.main --dry-run       uji coba, tidak menulis apa pun
    python -m src.main --paksa-kirim   abaikan jeda anti-spam
    python -m src.main --tanpa-vega    lewati radar, pakai data yang sudah ada
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import traceback
from datetime import datetime, timezone

import pandas as pd

from . import agent, anomaly, classifier, forecast, rules
from . import supabase_client as sb
from . import vega_client as vega
from .config import STATUS_IKON, settings
from .features import buat_fitur, laju_endapan_mm_per_hari

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)-9s | %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("sigap")


def tarik_dan_simpan() -> int:
    """Ambil pembacaan radar terbaru dan gabungkan dengan curah hujan."""
    bacaan = vega.ambil_vega()
    if not bacaan:
        return 0

    hujan = vega.ambil_hujan()
    peta_hujan = dict(zip(hujan.get("waktu", []), hujan.get("hujan", [])))

    baris = []
    for b in bacaan:
        t = pd.to_datetime(b["timestamp"], utc=True, errors="coerce")
        if pd.isna(t):
            continue
        kunci = t.strftime("%Y-%m-%dT%H:00")
        baris.append({
            "saluran_id": settings.saluran.id,
            "timestamp": t.isoformat(),
            "jarak_mm": b["jarak_mm"],
            "hujan_mm": peta_hujan.get(kunci, 0.0),
            "sumber": "vega",
        })
    return sb.simpan_sensor(baris)


def jalankan(tanpa_vega: bool = False, paksa_kirim: bool = False) -> dict:
    mulai = datetime.now(timezone.utc)
    s = settings.saluran
    log.info("=" * 64)
    log.info("Siklus SIGAP Drainase — %s (%s)", s.nama, s.id)

    # --- 1-3. Data ---------------------------------------------------------
    if not tanpa_vega:
        log.info("Pembacaan radar baru tersimpan: %d", tarik_dan_simpan())

    df = sb.ambil_sensor(menit=max(settings.menit_riwayat, 4320))
    if df.empty:
        raise RuntimeError(
            "Tidak ada data sensor di Supabase. Periksa apakah VEGA sudah "
            "terhubung dan ESP32 sudah mengirim data debit serta pH."
        )
    log.info("Riwayat sensor: %d baris, terbaru %s", len(df), df["timestamp"].iloc[-1])
    umur = (datetime.now(timezone.utc)
            - pd.to_datetime(df["timestamp"].iloc[-1], utc=True).to_pydatetime())
    umur_jam = umur.total_seconds() / 3600
    if umur_jam > 3:
        log.warning("Pembacaan sensor terakhir sudah %.1f jam yang lalu. Sensor kemungkinan "
                    "mati, baterai lemah, atau sinyal terputus. Penilaian tetap dijalankan, "
                    "tetapi ramalan tidak akan menyebut jam puncak.", umur_jam)
        agent.lapor_admin(
            f"\u26a0\ufe0f <b>Data sensor SIGAP Drainase basi</b>\n"
            f"Pembacaan terakhir {umur_jam:.1f} jam yang lalu. Periksa perangkat di lapangan.")

    hujan = vega.ambil_hujan()
    hujan_kini = vega.hujan_saat_ini(hujan)

    # --- 4. Fitur ----------------------------------------------------------
    df = buat_fitur(df, s.tinggi_pasang_mm, s.kedalaman_mm, s.debit_rancangan_lpm)
    kini = df.iloc[-1]
    dasar_mm = float(kini["dasar_mm"])

    # --- 5. Penilaian ------------------------------------------------------
    skor = anomaly.skor(df)
    # Ambang diambil dari hasil pelatihan, bukan dari nilai tetap, karena
    # skala skor Isolation Forest berbeda pada setiap saluran.
    if skor is not None:
        settings.ambang.anomali = anomaly.ambang_terlatih()
    duga = classifier.duga(df)
    if duga:
        log.info("Model klasifikasi menduga %s (keyakinan %.0f persen).",
                 duga["status"], duga["keyakinan"] * 100)

    penilaian = rules.nilai_status(
        r_endapan=float(kini["rasio_endapan"]),
        r_debit=float(kini["rasio_debit"]),
        r_air=float(kini["rasio_air"]),
        laju_naik=float(kini["laju_naik"]),
        ph=float(kini["ph_air"]) if pd.notna(kini["ph_air"]) else None,
        skor_anomali=skor,
        lonjakan_dasar=float(kini["lonjakan_dasar"]),
        duga_model=duga["status"] if duga else None,
        keyakinan_model=duga["keyakinan"] if duga else None,
    )
    penilaian.tinggi_air_mm = round(float(kini["tinggi_air_mm"]), 1)
    log.info(">>> STATUS: %s — %s", penilaian.status, penilaian.alasan)

    # --- 6. Ramalan --------------------------------------------------------
    ramalan = forecast.ramal(df)
    if ramalan:
        log.info("Ramalan: puncak %.0f mm (%.0f%% kedalaman) pada %s",
                 ramalan["puncak_mm"], ramalan["rasio_puncak"] * 100, ramalan["waktu_puncak"])

    # --- 7. Perkiraan material --------------------------------------------
    volume = rules.estimasi_volume_sampah_m3(dasar_mm)
    laju = laju_endapan_mm_per_hari(df)
    jenis = rules.dugaan_jenis_sampah(penilaian.ph, laju)
    log.info("Material: %.1f m3 (%d karung), dugaan %s",
             volume["volume_m3"], volume["setara_karung"], jenis["dugaan"])

    # --- 8. Simpan ---------------------------------------------------------
    sebelumnya = sb.status_terakhir()
    status_sebelum = sebelumnya.get("status") if sebelumnya else None

    hasil = {
        **penilaian.dict(),
        "dasar_mm": round(dasar_mm, 1),
        "debit_lpm": round(float(kini["debit_lpm"]), 1) if pd.notna(kini["debit_lpm"]) else 0.0,
        "hujan_mm": round(hujan_kini, 2),
        "laju_naik": penilaian.laju_naik_mm_per_menit,
        "laju_endapan_mm_per_hari": round(laju, 3),
        "volume": volume,
        "jenis_sampah": jenis,
        "ramalan": ramalan,
    }

    sb.simpan_status({
        "saluran_id": s.id,
        "timestamp": mulai.isoformat(),
        "status": penilaian.status,
        "alasan": penilaian.alasan,
        "rasio_endapan": penilaian.rasio_endapan,
        "rasio_debit": penilaian.rasio_debit,
        "rasio_air": penilaian.rasio_air,
        "tinggi_air_mm": penilaian.tinggi_air_mm,
        "dasar_mm": hasil["dasar_mm"],
        "debit_lpm": hasil["debit_lpm"],
        "ph_air": penilaian.ph,
        "hujan_mm": hasil["hujan_mm"],
        "laju_naik": penilaian.laju_naik_mm_per_menit,
        "skor_anomali": penilaian.skor_anomali,
        "anomali_terdeteksi": penilaian.anomali_terdeteksi,
        "duga_model": penilaian.duga_model,
        "keyakinan_model": penilaian.keyakinan_model,
        "estimasi_volume_m3": volume["volume_m3"],
        "estimasi_karung": volume["setara_karung"],
        "dugaan_jenis_sampah": jenis["dugaan"],
        "keyakinan_jenis": jenis["keyakinan"],
        "ramalan": ramalan,
        "ringkasan_petugas": rules.ringkas_untuk_petugas(penilaian, volume, jenis),
    })

    # --- 9. Notifikasi -----------------------------------------------------
    perlu, alasan = agent.perlu_kirim(penilaian.status, status_sebelum, paksa_kirim)
    if perlu:
        log.info("Mengirim notifikasi (%s).", alasan)
        hasil["notifikasi"] = agent.siarkan(hasil)
    else:
        log.info("Notifikasi tidak dikirim (%s).", alasan)
        hasil["notifikasi"] = {"alasan": alasan}

    durasi = (datetime.now(timezone.utc) - mulai).total_seconds()
    log.info("Siklus selesai dalam %.1f detik.", durasi)

    ringkasan = {
        "status": penilaian.status,
        "alasan": penilaian.alasan,
        "endapan_persen": round(penilaian.rasio_endapan * 100, 1),
        "debit_persen": round(penilaian.rasio_debit * 100, 1),
        "volume_m3": volume["volume_m3"],
        "notifikasi": hasil["notifikasi"],
        "durasi_detik": round(durasi, 1),
    }
    _tulis_ringkasan_actions(ringkasan)
    return ringkasan


def _tulis_ringkasan_actions(r: dict) -> None:
    import os
    berkas = os.getenv("GITHUB_STEP_SUMMARY")
    if not berkas:
        return
    with open(berkas, "a", encoding="utf-8") as f:
        f.write(
            f"### {STATUS_IKON.get(r['status'], '')} Status: **{r['status']}**\n\n"
            f"{r['alasan']}\n\n"
            f"| Item | Nilai |\n|---|---|\n"
            f"| Endapan | {r['endapan_persen']}% kedalaman |\n"
            f"| Aliran | {r['debit_persen']}% dari seharusnya |\n"
            f"| Perkiraan material | {r['volume_m3']} m³ |\n"
            f"| Durasi siklus | {r['durasi_detik']} detik |\n"
        )


def main() -> int:
    p = argparse.ArgumentParser(description="SIGAP Drainase — siklus pemantauan")
    p.add_argument("--dry-run", action="store_true", help="tidak menulis ke Supabase maupun mengirim pesan")
    p.add_argument("--tanpa-vega", action="store_true", help="lewati penarikan radar")
    p.add_argument("--paksa-kirim", action="store_true", help="abaikan jeda anti-spam")
    a = p.parse_args()

    if a.dry_run:
        settings.dry_run = True
        log.warning("MODE UJI COBA — tidak ada data yang ditulis dan tidak ada pesan terkirim.")
    else:
        settings.wajib_lengkap()

    try:
        ringkasan = jalankan(a.tanpa_vega, a.paksa_kirim)
        print(json.dumps(ringkasan, indent=2, ensure_ascii=False))
        return 0
    except Exception as e:  # noqa: BLE001
        log.error("SIKLUS GAGAL: %s", e)
        log.debug(traceback.format_exc())
        agent.lapor_admin(
            f"⚠️ <b>SIGAP Drainase gagal berjalan</b>\n"
            f"<code>{type(e).__name__}: {e}</code>"
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
