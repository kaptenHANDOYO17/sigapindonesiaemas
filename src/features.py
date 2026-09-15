"""
Rekayasa fitur SIGAP Drainase.

Dipakai BERSAMA oleh pelatihan dan inferensi supaya tidak pernah terjadi
perbedaan perlakuan antara keduanya.

Bagian terpenting di berkas ini adalah `dasar_terbaca`, yaitu penaksir
tinggi endapan. Karena radar tidak bisa melihat menembus air, tinggi endapan
disimpulkan dari permukaan terendah yang pernah terbaca selama saluran
kering. Nilai itulah dasar saluran yang sedang berlaku.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

KOLOM_MENTAH = ["jarak_mm", "debit_lpm", "ph_air", "hujan_mm"]

FITUR = [
    "permukaan_mm",
    "tinggi_air_mm",
    "rasio_endapan",
    "rasio_debit",
    "rasio_air",
    "laju_naik",
    "debit_lpm",
    "ph_air",
    "hujan_mm",
    "hujan_3jam",
    "permukaan_rerata_1jam",
    "permukaan_simpangan_1jam",
    "debit_rerata_1jam",
    "selisih_air_debit",
    "laju_dasar",
    "lonjakan_dasar",
    "jam_sin",
    "jam_cos",
]


def dasar_terbaca(
    df: pd.DataFrame,
    kolom_permukaan: str = "permukaan_mm",
    jendela_hari: int = 5,
    jam_kering: int = 6,
) -> pd.Series:
    """
    Taksir tinggi dasar saluran yang sedang berlaku (dasar asli + endapan).

    Cara kerjanya: ambil pembacaan saat saluran benar-benar kering, yaitu
    ketika tidak ada hujan selama beberapa jam terakhir. Pada saat itu,
    permukaan yang dipantulkan radar adalah endapan itu sendiri. Dari
    kumpulan pembacaan kering tersebut, ambil persentil ke-10 dalam jendela
    lima hari terakhir. Persentil dipakai, bukan nilai minimum, supaya satu
    pembacaan salah tidak langsung menggeser taksiran.

    PENYARINGAN KERING HARUS BERSIFAT LOKAL. Versi awal fungsi ini memakai
    kuantil atas seluruh riwayat, dan itu keliru: begitu endapan menumpuk,
    seluruh pembacaan baru dianggap "terlalu tinggi untuk disebut kering"
    lalu dibuang, sehingga taksiran dasar mandek di angka lama. Akibatnya
    saluran yang sudah tersumbat parah tetap terbaca aman. Cacat ini
    tertangkap oleh training/evaluate.py, dan itulah alasan berkas evaluasi
    tersebut wajib dijalankan setiap kali fungsi ini diubah.

    Panjang jendela lima hari dipilih lewat pengujian berjenjang. Jendela
    yang terlalu panjang membuat taksiran tertinggal di belakang endapan
    yang sedang menumpuk; jendela yang terlalu pendek membuat taksiran
    goyah oleh satu-dua pembacaan salah. Pada data uji, jendela lima hari
    dengan persentil kesepuluh menghasilkan galat rerata sekitar 28 mm,
    yaitu di bawah empat persen kedalaman saluran.
    """
    df = df.sort_values("timestamp").copy()
    permukaan = df[kolom_permukaan].astype(float)

    waktu = pd.to_datetime(df["timestamp"], utc=True)
    hujan = df.get("hujan_mm", pd.Series(0.0, index=df.index)).fillna(0.0)
    hujan.index = waktu
    hujan_terakhir = hujan.rolling(f"{jam_kering}h", min_periods=1).sum()
    kering = (hujan_terakhir <= 0.5).to_numpy()

    calon = permukaan.where(kering)
    calon.index = waktu

    dasar = calon.rolling(f"{jendela_hari}D", min_periods=1).quantile(0.10)
    dasar = dasar.ffill().bfill().fillna(0.0)
    dasar.index = df.index
    return dasar.clip(lower=0.0)


def buat_fitur(df: pd.DataFrame, tinggi_pasang_mm: float,
               kedalaman_mm: float, debit_rancangan_lpm: float) -> pd.DataFrame:
    """Bangun seluruh kolom fitur dari data sensor mentah."""
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp").reset_index(drop=True)

    for k in KOLOM_MENTAH:
        if k not in df.columns:
            df[k] = np.nan
        df[k] = pd.to_numeric(df[k], errors="coerce")

    df["hujan_mm"] = df["hujan_mm"].fillna(0.0)
    df["permukaan_mm"] = (tinggi_pasang_mm - df["jarak_mm"]).clip(lower=0.0)

    df["dasar_mm"] = dasar_terbaca(df)
    df["tinggi_air_mm"] = (df["permukaan_mm"] - df["dasar_mm"]).clip(lower=0.0)

    df["rasio_endapan"] = (df["dasar_mm"] / max(kedalaman_mm, 1.0)).clip(0, 1)
    df["rasio_air"] = (df["permukaan_mm"] / max(kedalaman_mm, 1.0)).clip(0, 2)

    faktor = (df["hujan_mm"] / 10.0).clip(upper=1.0)
    harapan = debit_rancangan_lpm * (0.15 + 0.85 * faktor)
    df["rasio_debit"] = (df["debit_lpm"] / harapan.replace(0, np.nan)).clip(0, 3).fillna(1.0)

    # Laju kenaikan muka air dalam mm per menit
    selisih_menit = df["timestamp"].diff().dt.total_seconds().div(60).replace(0, np.nan)
    df["laju_naik"] = (df["permukaan_mm"].diff() / selisih_menit).fillna(0.0)

    idx = df.set_index("timestamp")
    df["hujan_3jam"] = idx["hujan_mm"].rolling("3h", min_periods=1).sum().to_numpy()
    df["permukaan_rerata_1jam"] = idx["permukaan_mm"].rolling("1h", min_periods=1).mean().to_numpy()
    df["permukaan_simpangan_1jam"] = idx["permukaan_mm"].rolling("1h", min_periods=2).std().fillna(0).to_numpy()
    df["debit_rerata_1jam"] = idx["debit_lpm"].rolling("1h", min_periods=1).mean().to_numpy()

    # Tanda khas penyumbatan: air naik sementara aliran justru berkurang.
    # Pada saluran sehat, keduanya bergerak searah.
    df["selisih_air_debit"] = df["rasio_air"] - df["rasio_debit"]

    # Seberapa cepat "dasar terbaca" naik, dalam milimeter per hari.
    #
    # Ini membedakan dua hal yang tampak sama bagi radar. Endapan sungguhan
    # menumpuk perlahan, sekitar 2 sampai 7 milimeter per hari. Genangan yang
    # tertahan di belakang sumbatan muncul dalam hitungan jam dan menaikkan
    # dasar terbaca secara melonjak. Tanpa fitur ini, keduanya sama-sama
    # terbaca sebagai "penyempitan biasa", dan sumbatan mendadak lolos dari
    # penilaian. Cacat itu tertangkap pada uji lintas saluran, ketika satu
    # saluran uji melewatkan 37 persen kondisi kritisnya.
    dasar_seri = df["dasar_mm"].copy()
    dasar_seri.index = idx.index
    dasar_kemarin = dasar_seri.rolling("24h", min_periods=1).apply(
        lambda v: v.iloc[0], raw=False)
    df["laju_dasar"] = (dasar_seri - dasar_kemarin).to_numpy()

    # Lonjakan: laju kenaikan dasar dibandingkan laju penumpukan alami yang
    # wajar (dipatok 8 mm per hari). Nilai di atas 1 berarti kenaikan terlalu
    # cepat untuk disebut endapan.
    df["lonjakan_dasar"] = (df["laju_dasar"] / 8.0).clip(-3, 10)

    jam = df["timestamp"].dt.hour + df["timestamp"].dt.minute / 60
    df["jam_sin"] = np.sin(2 * np.pi * jam / 24)
    df["jam_cos"] = np.cos(2 * np.pi * jam / 24)

    df["ph_air"] = df["ph_air"].interpolate(limit_direction="both").fillna(7.0)
    df[FITUR] = df[FITUR].replace([np.inf, -np.inf], np.nan)
    df[FITUR] = df[FITUR].interpolate(limit_direction="both").fillna(0.0)
    return df


def laju_endapan_mm_per_hari(df: pd.DataFrame, hari: int = 7) -> float:
    """Seberapa cepat endapan menumpuk dalam beberapa hari terakhir."""
    if "dasar_mm" not in df.columns or len(df) < 2:
        return 0.0
    idx = df.set_index(pd.to_datetime(df["timestamp"], utc=True))["dasar_mm"]
    akhir = idx.iloc[-1]
    batas = idx.index[-1] - pd.Timedelta(days=hari)
    awal_seri = idx[idx.index <= batas]
    if awal_seri.empty:
        awal_seri = idx.iloc[:1]
    awal = awal_seri.iloc[-1]
    return float((akhir - awal) / max(hari, 1))


def buat_jendela(matriks: np.ndarray, idx_target: int,
                 panjang_input: int, panjang_output: int):
    """Ubah deret waktu menjadi pasangan masukan dan keluaran untuk LSTM."""
    X, y = [], []
    for i in range(len(matriks) - panjang_input - panjang_output + 1):
        X.append(matriks[i:i + panjang_input])
        y.append(matriks[i + panjang_input:i + panjang_input + panjang_output, idx_target])
    if not X:
        raise ValueError(
            f"Data terlalu pendek. Butuh minimal {panjang_input + panjang_output} baris, "
            f"tersedia {len(matriks)}."
        )
    return np.asarray(X, dtype="float32"), np.asarray(y, dtype="float32")
