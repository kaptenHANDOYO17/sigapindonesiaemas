"""
Pelatihan ulang bulanan.

Jalankan:
    python -m training.retrain
    python -m training.retrain --hari 30 --lewati-ramalan

APA YANG SEBENARNYA DIPELAJARI ULANG
------------------------------------
Ada dua hal berbeda yang diperbarui, dan keduanya sering tertukar:

1. MODEL. Isolation Forest dan LSTM dilatih ulang dengan data 30 hari
   terakhir supaya mengikuti perubahan musim. Saluran yang normal di musim
   kemarau berperilaku sangat berbeda di musim hujan; model yang dilatih
   pada satu musim akan salah menilai pada musim berikutnya.

2. AMBANG BATAS. Inilah yang sebenarnya paling menentukan, dan inilah yang
   dipelajari dari verifikasi petugas. Setiap kali petugas mengisi formulir
   setelah pengerukan, sistem memperoleh satu pasang data: apa yang dikira
   sistem, dan apa yang sebenarnya ada di lapangan. Dari kumpulan pasangan
   itulah ambang bisa digeser ke arah yang benar.

Tanpa verifikasi petugas, langkah kedua tidak mungkin dilakukan, dan sistem
selamanya hanya menebak. Karena itu mengisi formulir verifikasi bukan
pekerjaan tambahan, melainkan bagian dari cara kerja sistem.

Berkas ini TIDAK mengubah berkas .env secara otomatis. Ia hanya mengusulkan
ambang baru beserta alasannya, lalu manusia yang memutuskan. Ambang menyangkut
keselamatan warga, sehingga tidak layak diubah tanpa ada yang memeriksa.
"""
from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import supabase_client as sb  # noqa: E402
from src.config import MODELS_DIR, ROOT, STATUS_URUT, settings  # noqa: E402
from src.features import buat_fitur  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("latih-ulang")

USULAN = MODELS_DIR / "usulan_ambang.json"
LAPORAN = ROOT / "LAPORAN_LATIH_ULANG.md"


# ---------------------------------------------------------------------------
def periksa_kecukupan(hari: int) -> pd.DataFrame:
    df = sb.ambil_sensor_rentang(hari)
    if df.empty:
        raise SystemExit("Tidak ada data sensor. Periksa apakah sensor masih mengirim.")

    diharapkan = hari * 24 * 4  # interval 15 menit
    kelengkapan = len(df) / diharapkan
    log.info("Data terkumpul: %d baris (%.0f persen dari yang diharapkan).",
             len(df), kelengkapan * 100)

    if kelengkapan < 0.5:
        log.warning("Lebih dari separuh data hilang. Kemungkinan sensor sering mati, "
                    "baterai lemah, atau sinyal buruk. Periksa perangkat sebelum "
                    "mempercayai model hasil pelatihan ini.")
    return df


# ---------------------------------------------------------------------------
def belajar_dari_verifikasi(hari: int) -> dict | None:
    """
    Bandingkan penilaian sistem dengan temuan petugas di lapangan,
    lalu usulkan ambang yang lebih tepat.
    """
    ver = sb.ambil_verifikasi(hari=max(hari, 90))
    if ver.empty:
        log.warning("Belum ada data verifikasi lapangan. Ambang tidak dapat "
                    "diperbaiki bulan ini. Ingatkan petugas untuk mengisi "
                    "formulir setelah setiap pengerukan.")
        return None

    perlu = {"kondisi_sebenarnya", "tinggi_endapan_cm"}
    if not perlu.issubset(ver.columns):
        log.warning("Kolom verifikasi tidak lengkap. Dilewati.")
        return None

    ver = ver.dropna(subset=["kondisi_sebenarnya"])
    if len(ver) < 5:
        log.warning("Baru ada %d verifikasi. Butuh minimal 5 sebelum ambang "
                    "layak digeser.", len(ver))
        return None

    log.info("Belajar dari %d verifikasi lapangan.", len(ver))

    # --- Seberapa tepat sistem selama ini ---
    if "peringatan_tepat" in ver.columns:
        tepat = ver["peringatan_tepat"].dropna()
        if len(tepat):
            log.info("Ketepatan menurut petugas: %.0f persen (%d dari %d)",
                     tepat.mean() * 100, int(tepat.sum()), len(tepat))

    # --- Apakah taksiran tinggi endapan meleset? ---
    usul: dict = {"diperiksa_pada": datetime.now(timezone.utc).isoformat(),
                  "jumlah_verifikasi": int(len(ver))}

    hasil = ver.dropna(subset=["tinggi_endapan_cm"])
    if len(hasil) >= 5:
        kedalaman_cm = settings.saluran.kedalaman_mm / 10
        rasio_asli = (hasil["tinggi_endapan_cm"] / kedalaman_cm).clip(0, 1)

        # Ambang WASPADA sebaiknya berada tepat di bawah tingkat endapan
        # terendah yang oleh petugas sudah dinilai bermasalah.
        bermasalah = rasio_asli[hasil["kondisi_sebenarnya"].isin(["WASPADA", "SIAGA", "KRITIS"])]
        parah = rasio_asli[hasil["kondisi_sebenarnya"] == "KRITIS"]

        if len(bermasalah) >= 3:
            baru = float(np.percentile(bermasalah, 15)) - 0.03  # beri jaminan waktu
            usul["endapan_tinggi"] = round(max(0.10, min(0.50, baru)), 3)
        if len(parah) >= 3:
            baru = float(np.percentile(parah, 15)) - 0.03
            usul["endapan_sangat_tinggi"] = round(max(0.30, min(0.80, baru)), 3)

    # --- Arah kesalahan: sistem meremehkan atau melebihkan? ---
    if "status_ai_id" in ver.columns:
        selisih = []
        for _, b in ver.iterrows():
            asli = STATUS_URUT.get(b.get("kondisi_sebenarnya"), None)
            if asli is None:
                continue
            selisih.append(asli)
        if selisih:
            usul["rerata_tingkat_sebenarnya"] = round(float(np.mean(selisih)), 2)

    if "jenis_sampah_dominan" in ver.columns:
        jenis = ver["jenis_sampah_dominan"].dropna()
        if len(jenis):
            usul["jenis_sampah_tercatat"] = jenis.value_counts().head(4).to_dict()

    # --- Seberapa tepat perkiraan volume? ---
    if "volume_terangkut_m3" in ver.columns:
        vol = ver["volume_terangkut_m3"].dropna()
        if len(vol) >= 3:
            usul["volume_nyata_rerata_m3"] = round(float(vol.mean()), 2)
            log.info("Volume terangkut sebenarnya, rata-rata %.1f m3. "
                     "Bandingkan dengan perkiraan sistem untuk menyetel "
                     "PANJANG_SEGMEN_M.", vol.mean())

    return usul


# ---------------------------------------------------------------------------
def _cukup_verifikasi(minimal: int = 30) -> bool:
    """Model terawasi baru layak dilatih dari lapangan setelah cukup catatan."""
    try:
        ver = sb.ambil_verifikasi(hari=730)
        n = 0 if ver.empty else int(ver["kondisi_sebenarnya"].notna().sum())
        log.info("Catatan verifikasi lapangan tersedia: %d (butuh %d).", n, minimal)
        return n >= minimal
    except Exception:  # noqa: BLE001
        return False


def latih(sumber: str, hari: int, lewati_ramalan: bool) -> dict:
    hasil = {}
    perintah = [sys.executable, "-m", "training.train_anomaly",
                "--sumber", sumber, "--hari", str(hari)]
    log.info("Melatih ulang model anomali.")
    r = subprocess.run(perintah, cwd=ROOT, capture_output=True, text=True)
    hasil["anomali"] = "berhasil" if r.returncode == 0 else "gagal"
    if r.returncode != 0:
        log.error("Pelatihan anomali gagal:\n%s", r.stderr[-1500:])

    # Model klasifikasi adalah yang paling menentukan ketepatan sistem, dan
    # justru inilah yang paling diuntungkan oleh bertambahnya data verifikasi
    # lapangan. Sumbernya beralih otomatis ke data lapangan begitu terkumpul
    # cukup catatan.
    log.info("Melatih ulang model klasifikasi.")
    sumber_klasifikasi = "verifikasi" if _cukup_verifikasi() else "sintetis"
    r = subprocess.run(
        [sys.executable, "-m", "training.train_classifier", "--sumber", sumber_klasifikasi],
        cwd=ROOT, capture_output=True, text=True,
    )
    hasil["klasifikasi"] = (f"berhasil ({sumber_klasifikasi})"
                            if r.returncode == 0 else f"gagal ({sumber_klasifikasi})")
    if r.returncode != 0:
        log.error("Pelatihan klasifikasi gagal:\n%s", r.stderr[-1500:])

    if lewati_ramalan:
        hasil["ramalan"] = "dilewati"
        return hasil

    log.info("Melatih ulang model ramalan.")
    r = subprocess.run(
        [sys.executable, "-m", "training.train_forecast",
         "--sumber", sumber, "--hari", str(hari), "--epoch", "40"],
        cwd=ROOT, capture_output=True, text=True,
    )
    hasil["ramalan"] = "berhasil" if r.returncode == 0 else "gagal"
    if r.returncode != 0:
        log.error("Pelatihan ramalan gagal:\n%s", r.stderr[-1500:])
    return hasil


# ---------------------------------------------------------------------------
def tulis_laporan(hasil: dict, usul: dict | None, df: pd.DataFrame, hari: int) -> None:
    a = settings.ambang
    baris = [
        "# Laporan Pelatihan Ulang Bulanan",
        "",
        f"Dijalankan: {datetime.now(timezone.utc).astimezone().strftime('%d %B %Y, %H:%M WIB')}",
        f"Saluran: {settings.saluran.nama} ({settings.saluran.id})",
        f"Rentang data: {hari} hari terakhir, {len(df)} baris",
        "",
        "## Hasil pelatihan",
        "",
        "| Model | Hasil |",
        "|---|---|",
        f"| Klasifikasi status (terawasi) | {hasil.get('klasifikasi', '-')} |",
        f"| Deteksi anomali (Isolation Forest) | {hasil.get('anomali', '-')} |",
        f"| Ramalan muka air (LSTM) | {hasil.get('ramalan', '-')} |",
        "",
    ]

    if usul:
        baris += [
            "## Usulan penyesuaian ambang",
            "",
            f"Berdasarkan {usul['jumlah_verifikasi']} verifikasi lapangan dari petugas.",
            "",
            "| Ambang | Nilai sekarang | Usulan | Selisih |",
            "|---|---|---|---|",
        ]
        peta = {"endapan_tinggi": a.endapan_tinggi,
                "endapan_sangat_tinggi": a.endapan_sangat_tinggi}
        ada_usulan = False
        for kunci, sekarang in peta.items():
            if kunci in usul:
                baru = usul[kunci]
                baris.append(f"| `AMBANG_{kunci.upper()}` | {sekarang:.3f} | "
                             f"{baru:.3f} | {baru - sekarang:+.3f} |")
                ada_usulan = True
        if not ada_usulan:
            baris.append("| — | — | belum cukup data | — |")

        baris += [
            "",
            "> Ambang **tidak** diubah otomatis. Bila Anda setuju dengan usulan di "
            "atas, ubah sendiri nilainya di GitHub Variables, lalu catat alasan "
            "perubahannya. Angka ini menyangkut keselamatan warga, sehingga harus "
            "ada manusia yang memutuskan dan bertanggung jawab.",
            "",
        ]
        if "volume_nyata_rerata_m3" in usul:
            baris += [
                f"Volume material yang benar-benar terangkut rata-rata "
                f"**{usul['volume_nyata_rerata_m3']} m³**. Bandingkan dengan "
                f"perkiraan sistem pada periode yang sama. Bila perkiraan sistem "
                f"selalu lebih kecil, naikkan `PANJANG_SEGMEN_M`; bila selalu "
                f"lebih besar, turunkan.",
                "",
            ]
        if "jenis_sampah_tercatat" in usul:
            baris += ["Jenis material yang tercatat petugas:", ""]
            for j, n in usul["jenis_sampah_tercatat"].items():
                baris.append(f"- {j}: {n} kali")
            baris += ["", "Gunakan catatan ini untuk menilai apakah dugaan jenis "
                          "sampah berbasis pH memang berguna atau justru menyesatkan. "
                          "Bila dugaan sering meleset, sebaiknya fitur itu "
                          "dinonaktifkan saja daripada menyesatkan petugas.", ""]
    else:
        baris += [
            "## Usulan penyesuaian ambang",
            "",
            "**Tidak ada.** Belum ada cukup data verifikasi lapangan.",
            "",
            "Ini adalah kekurangan yang paling penting untuk diperbaiki. Selama "
            "petugas belum mengisi formulir verifikasi setelah pengerukan, sistem "
            "tidak punya cara untuk mengetahui apakah penilaiannya benar. Model "
            "boleh dilatih ulang setiap bulan, tetapi tanpa umpan balik dari "
            "lapangan, yang dipelajari hanyalah kebiasaan sensor, bukan kebenaran.",
            "",
        ]

    baris += ["## Langkah berikutnya", "",
              "1. Periksa tabel usulan di atas.",
              "2. Jalankan `python -m training.evaluate` untuk melihat arah kesalahan sistem.",
              "3. Bila ada usulan ambang, bahas bersama petugas BPBD sebelum diubah.",
              "4. Pastikan formulir verifikasi terisi setelah setiap pengerukan.",
              ""]

    LAPORAN.write_text("\n".join(baris), encoding="utf-8")
    log.info("Laporan ditulis ke %s", LAPORAN)


# ---------------------------------------------------------------------------
def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--hari", type=int, default=30)
    p.add_argument("--lewati-ramalan", action="store_true")
    p.add_argument("--paksa-sintetis", action="store_true")
    a = p.parse_args()

    log.info("=" * 60)
    log.info("PELATIHAN ULANG BULANAN — %s", settings.saluran.nama)

    if a.paksa_sintetis:
        df, sumber = pd.DataFrame(), "sintetis"
    else:
        df = periksa_kecukupan(a.hari)
        # Butuh sekitar dua minggu data pada interval 15 menit sebelum
        # pelatihan dari data asli lebih baik daripada data sintetis.
        sumber = "supabase" if len(df) >= 1500 else "sintetis"
        if sumber == "sintetis":
            log.warning("Data asli belum cukup (%d baris). Tetap memakai data "
                        "sintetis bulan ini.", len(df))

    hasil = latih(sumber, a.hari, a.lewati_ramalan)
    usul = belajar_dari_verifikasi(a.hari)

    if usul:
        USULAN.parent.mkdir(parents=True, exist_ok=True)
        USULAN.write_text(json.dumps(usul, indent=2, ensure_ascii=False), encoding="utf-8")

    tulis_laporan(hasil, usul, df, a.hari)
    log.info("Selesai. Baca %s", LAPORAN.name)


if __name__ == "__main__":
    main()
