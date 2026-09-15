"""
Konfigurasi terpusat SIGAP Drainase.

Semua nilai rahasia diambil dari Environment Variables (.env saat lokal,
GitHub Secrets saat produksi). Tidak ada kunci yang ditulis di dalam kode.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover
    pass

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
DATA_DIR = ROOT / "datasets"


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default) or ""


def _f(key: str, default: float) -> float:
    try:
        return float(os.getenv(key, default))
    except (TypeError, ValueError):
        return default


def _i(key: str, default: int) -> int:
    return int(_f(key, default))


# ---------------------------------------------------------------------------
# Geometri saluran — WAJIB diukur langsung di lapangan
# ---------------------------------------------------------------------------
@dataclass
class Saluran:
    """
    Ukuran fisik saluran drainase di titik pemasangan sensor.

    Sensor radar mengukur JARAK dari sensor ke permukaan yang memantul.
    Tanpa angka-angka di bawah ini, jarak tersebut tidak bisa diterjemahkan
    menjadi tinggi air maupun tinggi endapan.
    """

    id: str = _env("SALURAN_ID", "MGH-01")
    nama: str = _env("SALURAN_NAMA", "Drainase Mangunharjo RT 06 / RW 02")
    lat: float = _f("SALURAN_LAT", -6.9575)
    lon: float = _f("SALURAN_LON", 110.3160)

    # Jarak dari muka sensor ke dasar saluran saat kondisi bersih (mm).
    # Ukur dengan meteran ketika saluran kering dan baru dikeruk.
    tinggi_pasang_mm: float = _f("TINGGI_PASANG_MM", 1200.0)
    # Lebar dasar saluran (mm) dan kedalaman total saluran (mm)
    lebar_mm: float = _f("LEBAR_SALURAN_MM", 600.0)
    kedalaman_mm: float = _f("KEDALAMAN_SALURAN_MM", 800.0)
    # Panjang segmen yang diwakili satu sensor (m). Dipakai menghitung volume sampah.
    panjang_segmen_m: float = _f("PANJANG_SEGMEN_M", 50.0)
    # Debit rancangan saluran saat bersih (liter/menit) pada kondisi hujan sedang.
    debit_rancangan_lpm: float = _f("DEBIT_RANCANGAN_LPM", 900.0)


# ---------------------------------------------------------------------------
# Ambang batas status — WAJIB dikalibrasi, lihat docs/KALIBRASI.md
# ---------------------------------------------------------------------------
@dataclass
class Ambang:
    # Tinggi endapan terhadap kedalaman saluran (rasio 0-1)
    endapan_tinggi: float = _f("AMBANG_ENDAPAN_TINGGI", 0.30)
    endapan_sangat_tinggi: float = _f("AMBANG_ENDAPAN_SANGAT_TINGGI", 0.55)

    # Debit terhadap debit rancangan pada curah hujan setara (rasio 0-1)
    debit_menurun: float = _f("AMBANG_DEBIT_MENURUN", 0.60)
    debit_sangat_rendah: float = _f("AMBANG_DEBIT_SANGAT_RENDAH", 0.30)

    # Tinggi air terhadap kedalaman saluran — risiko meluap
    air_meluap: float = _f("AMBANG_AIR_MELUAP", 0.85)
    # Laju kenaikan muka air yang dianggap mendadak (mm per menit)
    laju_naik_mendadak: float = _f("AMBANG_LAJU_NAIK", 8.0)

    # pH di luar rentang ini dianggap menyimpang
    ph_min: float = _f("AMBANG_PH_MIN", 6.0)
    ph_max: float = _f("AMBANG_PH_MAX", 8.5)

    # Skor Isolation Forest; makin negatif makin ganjil
    anomali: float = _f("AMBANG_ANOMALI", -0.05)


@dataclass
class ModelPaths:
    anomali: Path = field(default_factory=lambda: MODELS_DIR / "isolation_forest.joblib")
    anomali_scaler: Path = field(default_factory=lambda: MODELS_DIR / "anomali_scaler.joblib")
    anomali_meta: Path = field(default_factory=lambda: MODELS_DIR / "anomali_meta.json")
    ramalan: Path = field(default_factory=lambda: MODELS_DIR / "lstm_level.keras")
    ramalan_scaler: Path = field(default_factory=lambda: MODELS_DIR / "ramalan_scaler.joblib")
    ramalan_meta: Path = field(default_factory=lambda: MODELS_DIR / "ramalan_meta.json")


@dataclass
class Settings:
    saluran: Saluran = field(default_factory=Saluran)
    ambang: Ambang = field(default_factory=Ambang)
    model: ModelPaths = field(default_factory=ModelPaths)

    # --- Supabase ---
    supabase_url: str = _env("SUPABASE_URL")
    supabase_key: str = _env("SUPABASE_KEY")

    # --- VEGA Inventory System (sumber data sensor radar) ---
    vega_base_url: str = _env("VEGA_BASE_URL", "https://vis.vega.com/api/v1")
    vega_token: str = _env("VEGA_API_TOKEN")
    vega_device_id: str = _env("VEGA_DEVICE_ID")

    # --- Telegram & WhatsApp ---
    telegram_token: str = _env("TELEGRAM_BOT_TOKEN")
    telegram_admin: str = _env("TELEGRAM_ADMIN_CHAT_ID")
    wa_token: str = _env("WHATSAPP_TOKEN")
    wa_phone_id: str = _env("WHATSAPP_PHONE_NUMBER_ID")
    wa_template_warga: str = _env("WHATSAPP_TEMPLATE_WARGA", "sigap_peringatan_warga")
    wa_template_bpbd: str = _env("WHATSAPP_TEMPLATE_BPBD", "sigap_laporan_bpbd")

    # --- Perilaku sistem ---
    jam_ramalan: int = _i("JAM_RAMALAN", 12)
    menit_riwayat: int = _i("MENIT_RIWAYAT", 720)
    jeda_notifikasi_jam: float = _f("JEDA_NOTIFIKASI_JAM", 4.0)
    situs_url: str = _env("SITUS_URL", "")
    dry_run: bool = _env("DRY_RUN", "false").lower() == "true"

    def wajib_lengkap(self) -> None:
        kurang = [
            n for n, v in {
                "SUPABASE_URL": self.supabase_url,
                "SUPABASE_KEY": self.supabase_key,
                "TELEGRAM_BOT_TOKEN": self.telegram_token,
            }.items() if not v
        ]
        if kurang:
            raise RuntimeError(
                "Konfigurasi belum lengkap: " + ", ".join(kurang) +
                ". Isi di berkas .env (lokal) atau GitHub Secrets (produksi). "
                "Lihat PANDUAN_AWAM.md bagian 4."
            )


settings = Settings()

# Urutan keparahan status. Dipakai untuk membandingkan dan mengambil yang terparah.
STATUS_URUT = {"AMAN": 0, "WASPADA": 1, "SIAGA": 2, "KRITIS": 3}
STATUS_IKON = {"AMAN": "🟢", "WASPADA": "🟡", "SIAGA": "🟠", "KRITIS": "🔴"}


def status_terparah(*statuses: str) -> str:
    valid = [s for s in statuses if s in STATUS_URUT]
    return max(valid, key=lambda s: STATUS_URUT[s]) if valid else "AMAN"
