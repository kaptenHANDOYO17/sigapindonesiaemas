"""
Pembangkit data sintetis saluran drainase.

MENGAPA BERKAS INI ADA
----------------------
Ini menjawab persoalan paling mendasar dalam proyek ini: pada hari pertama
sensor dipasang, belum ada satu pun data. Model tidak punya apa pun untuk
dipelajari, padahal warga sudah perlu dilindungi.

Ada tiga jalan keluar, dan proyek ini memakai ketiganya berurutan:

  Bulan 0     : model dilatih dengan data sintetis dari berkas ini, yang
                dibangun dari persamaan aliran saluran terbuka. Keputusan
                tetap dipegang matriks aturan, bukan model.
  Bulan 1-3   : model dilatih ulang dengan data sensor asli, masih tanpa label.
  Bulan 4 dst : label sesungguhnya mulai tersedia dari verifikasi petugas
                setelah pengerukan, sehingga model bisa dinilai kebenarannya.

Simulator ini bukan pengganti data nyata. Ia hanya mencegah sistem lumpuh
di bulan pertama. Setiap model yang dilatih darinya diberi tanda
`sumber: sintetis` pada metadatanya supaya tidak tertukar dengan model asli.

DASAR FISIKA YANG DIPAKAI
-------------------------
1. Aliran memakai pendekatan rumus Manning untuk saluran persegi.
2. Endapan menumpuk perlahan setiap hari, dan tersapu sebagian saat hujan
   deras karena kecepatan aliran naik.
3. Penyumbatan dimodelkan sebagai penyempitan penampang efektif, sehingga
   muka air naik sementara debit justru turun. Inilah tanda khas yang harus
   dikenali model.
4. pH mengikuti pola harian ringan, turun ketika endapan organik menumpuk
   dan air tergenang lama, naik sedikit saat hujan mengencerkan.
"""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("simulator")


def hujan_asli(n: int, menit: int, rng: np.random.Generator) -> np.ndarray | None:
    """
    Pakai curah hujan sungguhan Mangunharjo bila berkasnya tersedia.

    Berkas dihasilkan oleh datasets/unduh_data_asli.py, yang harus dijalankan
    di komputer Anda karena akses API cuaca diblokir di lingkungan penyusunan.

    Data aslinya per jam, sedangkan simulasi berjalan per 15 menit. Hujan satu
    jam dibagi ke empat langkah memakai bentuk lengkung, bukan dibagi rata,
    karena hujan tropis memuncak di tengah lalu mereda. Membagi rata akan
    membuat lonjakan muka air terlihat lebih lembut daripada kenyataan.
    """
    berkas = Path(__file__).resolve().parent.parent / "datasets" / "asli" / "hujan_mangunharjo.csv"
    if not berkas.exists():
        return None

    df = pd.read_csv(berkas, parse_dates=["waktu"])
    per_jam = df["hujan_mm"].to_numpy(dtype=float)
    if len(per_jam) == 0:
        return None

    langkah_per_jam = max(1, int(60 / menit))
    bentuk = np.sin(np.linspace(0.35, np.pi - 0.35, langkah_per_jam))
    bentuk = bentuk / bentuk.sum()

    halus = np.repeat(per_jam, langkah_per_jam) * np.tile(bentuk, len(per_jam))

    # Mulai dari titik acak agar setiap saluran memperoleh potongan tahun yang
    # berbeda, tetapi tetap dari cuaca sungguhan.
    if len(halus) <= n:
        ulang = int(np.ceil(n / len(halus)))
        halus = np.tile(halus, ulang)
    awal = int(rng.integers(0, len(halus) - n))
    log.info("Memakai curah hujan ASLI Mangunharjo (%d jam tersedia).", len(per_jam))
    return halus[awal:awal + n]


def hujan_sintetis(n: int, menit: int, rng: np.random.Generator) -> np.ndarray:
    """
    Curah hujan bergaya iklim tropis: sebagian besar waktu kering, diselingi
    hujan deras yang singkat, dengan musim hujan lebih sering pada awal dan
    akhir tahun.
    """
    hujan = np.zeros(n)
    langkah_per_hari = int(24 * 60 / menit)
    hari = n // langkah_per_hari + 1

    for d in range(hari):
        musim = 0.55 if (d % 365) < 120 or (d % 365) > 300 else 0.22
        if rng.random() > musim:
            continue
        jumlah = rng.integers(1, 3)
        for _ in range(jumlah):
            awal = d * langkah_per_hari + rng.integers(0, langkah_per_hari)
            panjang = int(rng.integers(2, max(3, langkah_per_hari // 6)))
            puncak = rng.gamma(2.0, 4.0)
            bentuk = np.sin(np.linspace(0, np.pi, panjang)) * puncak
            akhir = min(n, awal + panjang)
            if awal < n:
                hujan[awal:akhir] += bentuk[:akhir - awal]
    return np.clip(hujan, 0, 60)


def simulasikan(
    hari: int = 180,
    menit: int = 15,
    tinggi_pasang_mm: float = 1200.0,
    kedalaman_mm: float = 800.0,
    lebar_mm: float = 600.0,
    debit_rancangan_lpm: float = 900.0,
    seed: int = 42,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    n = int(hari * 24 * 60 / menit)
    waktu = pd.date_range("2025-01-01", periods=n, freq=f"{menit}min", tz="UTC")

    hujan = hujan_asli(n, menit, rng)
    if hujan is None:
        hujan = hujan_sintetis(n, menit, rng)
    hujan_3jam = pd.Series(hujan).rolling(int(180 / menit), min_periods=1).sum().to_numpy()

    endapan = np.zeros(n)      # mm di atas dasar asli
    sumbatan = np.zeros(n)     # 0 sampai 1, penyempitan penampang efektif
    permukaan = np.zeros(n)
    debit = np.zeros(n)
    ph = np.zeros(n)

    endapan_kini = 5.0
    sumbat_kini = 0.0
    # Laju penumpukan nyata pada saluran permukiman padat berkisar 2 sampai 7 mm
    # per hari, sehingga saluran sedalam 80 cm bisa tersumbat sepertiga dalam
    # dua bulan bila tidak dikeruk. Angka ini yang membuat status naik.
    laju_dasar = rng.uniform(2.5, 7.0) / (24 * 60 / menit)  # mm per langkah

    # Jadwal pengerukan: sekitar setiap 60 hari, seperti praktik lapangan
    langkah_per_hari = int(24 * 60 / menit)
    # Sebagian jadwal sengaja dilewatkan, meniru kenyataan bahwa pengerukan
    # kadang tertunda karena anggaran atau prioritas lain. Justru periode
    # terlewat inilah yang menghasilkan kondisi kritis, dan model perlu
    # pernah melihatnya agar bisa mengenalinya.
    semua_jadwal = list(range(60, hari, int(rng.integers(45, 80))))
    jadwal_keruk = set(
        int(d * langkah_per_hari) for d in semua_jadwal
        if rng.random() > 0.15
    )

    for i in range(n):
        h = hujan[i]

        # --- endapan menumpuk, lalu tersapu sebagian saat hujan deras ---
        endapan_kini += laju_dasar * rng.uniform(0.5, 1.6)
        if h > 12:
            endapan_kini -= min(endapan_kini * 0.02, 1.5)   # penggelontoran alami
        keruk = i in jadwal_keruk
        # Pengerukan darurat: begitu saluran benar-benar parah, biasanya ada
        # laporan warga dan petugas turun dalam beberapa hari. Tanpa mekanisme
        # ini, simulasi akan menghasilkan saluran yang tersumbat parah
        # berbulan-bulan tanpa ada yang menangani, dan itu tidak realistis.
        if endapan_kini > kedalaman_mm * 0.60 and rng.random() < 0.0012:
            keruk = True
        if keruk:
            endapan_kini = rng.uniform(2, 15)               # setelah dikeruk
            sumbat_kini = 0.0
            log.debug("Pengerukan pada langkah %d", i)

        endapan_kini = float(np.clip(endapan_kini, 0, kedalaman_mm * 0.85))

        # --- kejadian sumbatan mendadak, misalnya kasur atau tumpukan plastik ---
        if rng.random() < 0.00035:
            sumbat_kini = min(0.9, sumbat_kini + rng.uniform(0.25, 0.6))
        sumbat_kini = max(0.0, sumbat_kini - 0.0006)  # sebagian hanyut sendiri

        # Penyempitan total = akibat endapan + akibat sumbatan mendadak
        sempit = min(0.95, endapan_kini / kedalaman_mm + sumbat_kini)

        # --- hidrolika sederhana ---
        aliran_masuk = debit_rancangan_lpm * (0.12 + 0.88 * min(1.0, hujan_3jam[i] / 25.0))
        kapasitas = debit_rancangan_lpm * (1 - sempit) ** 1.67  # pendekatan Manning
        debit_kini = min(aliran_masuk, kapasitas) * rng.uniform(0.93, 1.07)

        # Air menumpuk bila aliran masuk melebihi kapasitas
        kelebihan = max(0.0, aliran_masuk - kapasitas) / max(debit_rancangan_lpm, 1)
        tinggi_air = kedalaman_mm * (0.06 + 0.55 * min(1.0, hujan_3jam[i] / 25.0) + 0.75 * kelebihan)
        tinggi_air = float(np.clip(tinggi_air, 0, kedalaman_mm * 1.05))

        permukaan_kini = endapan_kini + tinggi_air
        if h < 0.2 and hujan_3jam[i] < 1:
            # Saat kering, permukaan yang terbaca adalah endapan ditambah
            # aliran dasar yang tipis. Namun bila ada sumbatan di hilir, air
            # akan menggenang di belakangnya dan tidak surut meski tidak
            # hujan. Genangan diam inilah yang membuat sumbatan tetap bisa
            # terdeteksi di musim kemarau.
            genangan = kedalaman_mm * 0.45 * sumbat_kini
            permukaan_kini = endapan_kini + genangan + rng.uniform(0, 12)

        # --- pH ---
        organik = min(1.0, endapan_kini / (kedalaman_mm * 0.5))
        ph_kini = 7.3 - 1.1 * organik + 0.25 * min(1.0, h / 10) + rng.normal(0, 0.12)

        endapan[i] = endapan_kini
        sumbatan[i] = sumbat_kini
        permukaan[i] = permukaan_kini
        debit[i] = max(0.0, debit_kini)
        ph[i] = float(np.clip(ph_kini, 4.5, 9.5))

    jarak = np.clip(tinggi_pasang_mm - permukaan, 0, tinggi_pasang_mm)
    jarak += rng.normal(0, 2.0, n)  # akurasi sensor sekitar plus minus 5 mm

    return pd.DataFrame({
        "timestamp": waktu,
        "jarak_mm": np.round(jarak, 1),
        "debit_lpm": np.round(debit, 1),
        "ph_air": np.round(ph, 2),
        "hujan_mm": np.round(hujan, 2),
        # Kolom di bawah ini hanya ada pada data sintetis dan dipakai untuk
        # menguji seberapa benar taksiran endapan sistem. Data asli tidak
        # akan punya kolom ini.
        "asli_endapan_mm": np.round(endapan, 1),
        "asli_sumbatan": np.round(sumbatan, 3),
    })


def main() -> None:
    p = argparse.ArgumentParser(description="Bangkitkan data sintetis saluran drainase")
    p.add_argument("--hari", type=int, default=180)
    p.add_argument("--menit", type=int, default=15)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--keluaran", default="datasets/sintetis_drainase.csv")
    p.add_argument("--hujan-asli", action="store_true",
                   help="paksa berhenti bila berkas hujan asli belum diunduh")
    a = p.parse_args()

    if a.hujan_asli:
        berkas = Path("datasets/asli/hujan_mangunharjo.csv")
        if not berkas.exists():
            raise SystemExit(
                "Berkas curah hujan asli belum ada. Jalankan dulu di komputer Anda:\n"
                "    python datasets/unduh_data_asli.py --tahun 10")

    df = simulasikan(hari=a.hari, menit=a.menit, seed=a.seed)
    jalur = Path(a.keluaran)
    jalur.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(jalur, index=False)

    log.info("Tersimpan: %s (%d baris, %d hari)", jalur, len(df), a.hari)
    log.info("Endapan berkisar %.0f sampai %.0f mm",
             df["asli_endapan_mm"].min(), df["asli_endapan_mm"].max())
    log.info("Hari berhujan: %.0f persen",
             (df.groupby(df["timestamp"].dt.date)["hujan_mm"].max() > 1).mean() * 100)


if __name__ == "__main__":
    main()
