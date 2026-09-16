"""
AI Agent SIGAP Drainase — penyusun dan pengirim notifikasi.

Inilah berkas yang mengubah angka sensor menjadi kalimat yang dibaca manusia,
lalu mengantarkannya ke ponsel yang tepat. Agen ini menjalankan empat tugas
secara berurutan:

    1. Memutuskan apakah pesan layak dikirim sekarang (aturan anti-spam).
    2. Menyusun isi pesan yang BERBEDA untuk warga dan untuk petugas BPBD.
    3. Mengambil daftar penerima dari Supabase sesuai perannya.
    4. Mengirim lewat Telegram dan WhatsApp, lalu mencatat hasilnya.

Mengapa isi pesannya dibedakan
------------------------------
Warga membutuhkan jawaban atas satu pertanyaan: apa yang harus saya lakukan
sekarang. Petugas BPBD membutuhkan jawaban atas pertanyaan yang lain: di mana
titiknya, seberapa parah, dan alat apa yang perlu dibawa. Mengirim satu pesan
yang sama kepada keduanya membuat pesan itu terlalu teknis bagi warga dan
terlalu dangkal bagi petugas.

Penyusunan kalimat memakai templat berkaidah, bukan model bahasa besar.
Alasannya: pesan kebencanaan harus dapat diprediksi, dapat diaudit, dan tidak
boleh mengarang. Bila di kemudian hari Anda ingin memakai LangChain atau
model bahasa untuk memperhalus kalimat, letakkan lapisan itu DI ATAS templat
ini, dan tetap simpan templat sebagai cadangan bila model gagal menjawab.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

import requests

from . import supabase_client as sb
from .config import STATUS_IKON, STATUS_URUT, settings

log = logging.getLogger("agent")

TG_API = "https://api.telegram.org/bot{}/{}"
WA_API = "https://graph.facebook.com/v21.0/{}/messages"


# ---------------------------------------------------------------------------
# Naskah tindakan
# ---------------------------------------------------------------------------
TINDAKAN_WARGA = {
    "WASPADA": [
        "Jangan membuang sampah ke saluran, termasuk sisa makanan dan minyak jelantah.",
        "Bersihkan daun dan sampah di mulut saluran depan rumah bila memungkinkan.",
        "Periksa apakah talang dan selokan halaman masih mengalir lancar.",
    ],
    "SIAGA": [
        "Naikkan barang berharga dan dokumen penting ke tempat yang lebih tinggi.",
        "Pindahkan kendaraan ke lokasi yang tidak tergenang.",
        "Siapkan tas berisi obat, senter, dan dokumen dalam plastik kedap air.",
        "Hindari membuang apa pun ke saluran sampai kondisi kembali normal.",
    ],
    "KRITIS": [
        "Utamakan keselamatan jiwa, bukan barang.",
        "Matikan aliran listrik dari MCB utama sebelum air masuk rumah.",
        "Jangan menerjang genangan yang mengalir deras atau lebih tinggi dari lutut.",
        "Jauhi tiang listrik, kabel menjuntai, dan mulut saluran yang terbuka.",
        "Dahulukan lansia, anak kecil, dan penyandang disabilitas menuju tempat aman.",
    ],
}

ALAT_BPBD = {
    "WASPADA": "Cukup pembersihan ringan pada mulut saluran. Satu regu kecil memadai.",
    "SIAGA": "Perlu pengerukan manual dengan cangkul dan serok. Siapkan karung dan kendaraan pengangkut.",
    "KRITIS": "Perlu penanganan segera. Pertimbangkan alat berat atau pompa penyedot, "
              "serta penutupan sementara jalan bila air sudah meluap.",
}


# ---------------------------------------------------------------------------
# 1. Keputusan pengiriman
# ---------------------------------------------------------------------------
def perlu_kirim(status: str, status_sebelum: str | None,
                paksa: bool = False) -> tuple[bool, str]:
    """
    Putuskan apakah notifikasi massal layak dikirim saat ini.

    Aturannya sengaja ketat. Warga yang menerima peringatan berulang untuk
    keadaan yang sama akan berhenti membacanya, tepat sebelum peringatan
    yang sungguh-sungguh penting datang.
    """
    if status == "AMAN":
        return False, "kondisi aman"
    if paksa:
        return True, "dipaksa lewat argumen"

    naik = (status_sebelum is None
            or STATUS_URUT.get(status, 0) > STATUS_URUT.get(status_sebelum, 0))
    if naik:
        return True, f"status naik dari {status_sebelum or 'belum ada'} ke {status}"

    jam = sb.jam_sejak_notifikasi_terakhir()
    if jam is None:
        return True, "belum pernah ada notifikasi"
    if jam >= settings.jeda_notifikasi_jam:
        return True, f"jeda terpenuhi ({jam:.1f} jam)"
    return False, f"baru {jam:.1f} jam lalu, jeda minimal {settings.jeda_notifikasi_jam} jam"


# ---------------------------------------------------------------------------
# 2. Penyusunan pesan
# ---------------------------------------------------------------------------
def _waktu_lokal(iso: str | None = None) -> str:
    t = datetime.fromisoformat(iso.replace("Z", "+00:00")) if iso else datetime.now(timezone.utc)
    return t.astimezone().strftime("%d %b %Y, %H:%M WIB")


def susun_pesan_warga(h: dict[str, Any]) -> str:
    status = h["status"]
    s = settings.saluran
    judul = {
        "WASPADA": "SALURAN MULAI MENYEMPIT",
        "SIAGA": "SALURAN TERSUMBAT, WASPADA GENANGAN",
        "KRITIS": "BAHAYA GENANGAN, SEGERA BERSIAP",
    }.get(status, "INFORMASI SALURAN")

    baris = [
        f"{STATUS_IKON.get(status, '⚪')} <b>{judul}</b>",
        f"{s.nama}",
        f"{_waktu_lokal()}",
        "",
        _kalimat_warga(h),
    ]

    ramalan = h.get("ramalan")
    if ramalan and ramalan.get("berpotensi_meluap"):
        if ramalan.get("data_basi"):
            baris += ["", "Air diperkirakan mencapai bibir saluran dalam beberapa jam ke depan. "
                          "<i>Jam tepatnya tidak disebutkan karena pembacaan sensor terakhir "
                          "sudah lama, sehingga perhitungan waktunya tidak dapat dipercaya.</i>"]
        else:
            baris += ["", f"Air diperkirakan mencapai bibir saluran sekitar "
                          f"<b>{_waktu_lokal(ramalan['waktu_puncak'])}</b>."]

    langkah = TINDAKAN_WARGA.get(status)
    if langkah:
        baris += ["", "<b>Yang perlu dilakukan sekarang:</b>"]
        baris += [f"{i}. {t}" for i, t in enumerate(langkah, 1)]

    if status == "KRITIS":
        baris += ["", "<b>Darurat:</b> 112 (umum) • 115 (Basarnas) • BPBD Kota Semarang"]

    baris += ["", "<i>Angka di atas berasal dari sensor dan perkiraan model, "
                  "bukan kepastian. Tetap ikuti arahan BPBD dan aparat setempat.</i>"]
    return "\n".join(baris)


def _kalimat_warga(h: dict[str, Any]) -> str:
    """Terjemahkan angka teknis menjadi satu kalimat yang dimengerti warga."""
    persen_endapan = int(round(h["rasio_endapan"] * 100))
    status = h["status"]
    if status == "WASPADA":
        return (f"Saluran di lingkungan Anda tersumbat sekitar {persen_endapan} persen "
                f"oleh sampah dan endapan. Air masih mengalir, tetapi kapasitasnya "
                f"berkurang. Bila turun hujan deras, genangan bisa cepat muncul.")
    if status == "SIAGA":
        return (f"Saluran tersumbat sekitar {persen_endapan} persen dan aliran air "
                f"sudah melambat. Genangan berpotensi terjadi dalam beberapa jam "
                f"ke depan, terutama bila hujan turun.")
    return (f"Saluran tersumbat parah, sekitar {persen_endapan} persen, dan air "
            f"nyaris tidak mengalir. Genangan sangat mungkin masuk ke jalan dan "
            f"permukiman. Bersiaplah sekarang juga.")


def susun_pesan_bpbd(h: dict[str, Any]) -> str:
    """Laporan teknis untuk petugas: cukup rinci untuk langsung ditindaklanjuti."""
    s = settings.saluran
    status = h["status"]
    vol = h.get("volume", {})
    jenis = h.get("jenis_sampah", {})

    baris = [
        f"{STATUS_IKON.get(status, '⚪')} <b>LAPORAN OTOMATIS SIGAP DRAINASE</b>",
        f"<b>Status: {status}</b>",
        "",
        f"<b>Lokasi</b>   : {s.nama}",
        f"<b>Kode</b>     : {s.id}",
        f"<b>Koordinat</b>: {s.lat:.5f}, {s.lon:.5f}",
        f"<b>Waktu</b>    : {_waktu_lokal()}",
        "",
        "<b>Pembacaan sensor</b>",
        f"• Endapan          : {h['rasio_endapan'] * 100:.0f}% kedalaman "
        f"({h.get('dasar_mm', 0):.0f} mm dari {s.kedalaman_mm:.0f} mm)",
        f"• Aliran           : {h['rasio_debit'] * 100:.0f}% dari yang seharusnya "
        f"({h.get('debit_lpm', 0):.0f} L/menit)",
        f"• Muka air         : {h['rasio_air'] * 100:.0f}% kedalaman saluran",
        f"• Laju kenaikan    : {h.get('laju_naik', 0):.1f} mm/menit",
        f"• pH air           : {h.get('ph', '-')}"
        + ("  (di luar rentang wajar)" if h.get("ph_menyimpang") else ""),
        f"• Curah hujan      : {h.get('hujan_mm', 0):.1f} mm/jam",
        "",
        "<b>Analisis</b>",
        f"{h['alasan']}",
    ]

    if vol:
        baris += [
            "",
            "<b>Perkiraan material</b>",
            f"• Volume  : {vol['volume_m3']:.1f} m\u00b3 "
            f"(rentang {vol['volume_min_m3']:.1f}\u2013{vol['volume_maks_m3']:.1f} m\u00b3)",
            f"• Setara  : sekitar {vol['setara_karung']} karung",
            f"• Dugaan jenis: {jenis.get('dugaan', '-')} "
            f"(keyakinan {jenis.get('keyakinan', 0) * 100:.0f}%, perlu diperiksa langsung)",
        ]

    ramalan = h.get("ramalan")
    if ramalan:
        waktu_puncak = ("waktu tidak dapat dipastikan, pembacaan sensor terakhir sudah "
                        f"{ramalan.get('umur_data_jam', 0):.0f} jam yang lalu"
                        if ramalan.get("data_basi")
                        else _waktu_lokal(ramalan["waktu_puncak"]))
        baris += ["", "<b>Ramalan muka air</b>",
                  f"• Puncak {ramalan['puncak_mm']:.0f} mm "
                  f"({ramalan['rasio_puncak'] * 100:.0f}% kedalaman) "
                  f"pada {waktu_puncak}"]
        if ramalan.get("berpotensi_meluap"):
            baris.append("• <b>Berpotensi meluap.</b>")

    baris += ["", "<b>Tindakan yang disarankan</b>", ALAT_BPBD.get(status, "-")]

    if settings.situs_url:
        baris += ["", f"Dasbor: {settings.situs_url}",
                  f"Verifikasi setelah pembersihan: {settings.situs_url.rstrip('/')}/verifikasi"]

    baris += ["", "<i>Pesan ini disusun otomatis oleh sistem. Volume dan jenis material "
                  "adalah perkiraan dari satu titik sensor, sehingga kondisi sebenarnya "
                  "dapat berbeda.</i>"]
    return "\n".join(baris)


# ---------------------------------------------------------------------------
# 3. Pengiriman
# ---------------------------------------------------------------------------
def kirim_telegram(chat_id: str, teks: str, tombol: list | None = None) -> bool:
    if settings.dry_run:
        log.info("[UJI COBA] Telegram ke %s:\n%s\n", chat_id, teks[:600])
        return True
    if not settings.telegram_token:
        return False
    muatan: dict[str, Any] = {"chat_id": chat_id, "text": teks, "parse_mode": "HTML",
                             "disable_web_page_preview": True}
    if tombol:
        muatan["reply_markup"] = {"inline_keyboard": tombol}
    try:
        r = requests.post(TG_API.format(settings.telegram_token, "sendMessage"),
                          json=muatan, timeout=25)
        if r.status_code == 403:
            log.info("Kontak %s memblokir bot. Dinonaktifkan.", chat_id)
            sb.nonaktifkan_kontak(chat_id)
            return False
        r.raise_for_status()
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("Gagal kirim Telegram ke %s: %s", chat_id, e)
        return False


def kirim_whatsapp(nomor: str, status: str, ringkas: str, peran: str = "warga") -> bool:
    """
    Kirim lewat WhatsApp Business Cloud API.

    Catatan penting: di luar jendela 24 jam percakapan, WhatsApp hanya
    mengizinkan pesan bertemplat yang sudah disetujui Meta. Karena peringatan
    bencana datang tanpa didahului percakapan, templat WAJIB didaftarkan
    lebih dulu. Cara pendaftarannya ada di docs/PANDUAN_WHATSAPP.md
    """
    if settings.dry_run:
        log.info("[UJI COBA] WhatsApp ke %s: %s | %s", nomor, status, ringkas[:200])
        return True
    if not (settings.wa_token and settings.wa_phone_id):
        return False

    templat = settings.wa_template_bpbd if peran == "bpbd" else settings.wa_template_warga
    try:
        r = requests.post(
            WA_API.format(settings.wa_phone_id),
            headers={"Authorization": f"Bearer {settings.wa_token}",
                     "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to": _rapikan_nomor(nomor),
                "type": "template",
                "template": {
                    "name": templat,
                    "language": {"code": "id"},
                    "components": [{
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": status},
                            {"type": "text", "text": settings.saluran.nama},
                            {"type": "text", "text": ringkas[:900]},
                        ],
                    }],
                },
            },
            timeout=30,
        )
        r.raise_for_status()
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("Gagal kirim WhatsApp ke %s: %s", nomor, e)
        return False


def _rapikan_nomor(nomor: str) -> str:
    """Ubah 08xxx menjadi 628xxx sesuai format internasional."""
    n = "".join(c for c in str(nomor) if c.isdigit())
    if n.startswith("0"):
        n = "62" + n[1:]
    elif not n.startswith("62"):
        n = "62" + n
    return n


# ---------------------------------------------------------------------------
# 4. Penyiaran
# ---------------------------------------------------------------------------
def siarkan(hasil: dict[str, Any]) -> dict[str, Any]:
    """Kirim ke seluruh penerima sesuai perannya. Mengembalikan ringkasan."""
    status = hasil["status"]
    pesan_warga = susun_pesan_warga(hasil)
    pesan_bpbd = susun_pesan_bpbd(hasil)
    ringkas_wa = hasil["alasan"]

    tombol = ([[{"text": "Lihat dasbor", "url": settings.situs_url}]]
              if settings.situs_url.startswith("http") else None)

    laporan = {"warga": {"berhasil": 0, "gagal": 0},
               "bpbd": {"berhasil": 0, "gagal": 0}}

    for peran, isi in (("bpbd", pesan_bpbd), ("warga", pesan_warga)):
        # Petugas dihubungi lebih dulu, karena merekalah yang bisa bertindak.
        kontak = sb.ambil_kontak(peran)
        if not kontak:
            log.warning("Belum ada kontak terdaftar dengan peran %s.", peran)
            continue

        for i, k in enumerate(kontak):
            ok = False
            kanal = (k.get("kanal") or "telegram").lower()

            if kanal in ("telegram", "keduanya") and k.get("chat_id"):
                ok = kirim_telegram(k["chat_id"], isi,
                                    tombol if peran == "warga" else None)
                sb.catat_notifikasi(k["chat_id"], peran, "telegram", status, ok, isi)

            if kanal in ("whatsapp", "keduanya") and k.get("nomor_kontak"):
                ok_wa = kirim_whatsapp(k["nomor_kontak"], status, ringkas_wa, peran)
                sb.catat_notifikasi(k["nomor_kontak"], peran, "whatsapp", status, ok_wa, ringkas_wa)
                ok = ok or ok_wa

            laporan[peran]["berhasil" if ok else "gagal"] += 1

            # Telegram membatasi sekitar 30 pesan per detik untuk siaran.
            if (i + 1) % 25 == 0:
                time.sleep(1.1)

    log.info("Siaran selesai. BPBD: %s | Warga: %s", laporan["bpbd"], laporan["warga"])
    return laporan


def _aman_html(teks: str) -> str:
    """
    Lolos-kan tanda kurung siku agar Telegram tidak salah membacanya sebagai tag.

    Pesan galat sering memuat potongan seperti <class 'numpy.random...'>.
    Telegram menolak seluruh pesan dengan galat 400 bila menemukan tag yang
    tidak dikenalnya, sehingga laporan kerusakan justru tidak pernah sampai.
    Itu kejadian nyata: sistem gagal, lalu kabar kegagalannya ikut gagal
    terkirim.
    """
    return (teks.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;"))


def lapor_admin(teks: str, sudah_html: bool = False) -> None:
    """
    Kirim kabar kepada pengelola.

    Setel sudah_html=True hanya bila teksnya memang sudah Anda susun dengan
    tag HTML yang benar. Untuk pesan galat mentah, biarkan apa adanya supaya
    dilolos-kan lebih dulu.
    """
    if not settings.telegram_admin:
        return
    kirim_telegram(settings.telegram_admin, teks if sudah_html else _aman_html(teks))
