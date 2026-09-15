"""
Bot pendaftaran dan layanan SIGAP Drainase.

Memakai requests dan long polling saja, tanpa pustaka bot berat, supaya bisa
dijalankan di mana pun: laptop, Raspberry Pi, atau GitHub Actions.

Jalankan:
    python bot/bot_daftar.py                 mode berjalan terus
    python bot/bot_daftar.py --sekali        proses antrean lalu keluar
    python bot/bot_daftar.py --pasang-menu   hanya pasang menu perintah

Perintah lengkap ada di bot/botfather_commands.txt
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import supabase_client as sb  # noqa: E402
from src.agent import TINDAKAN_WARGA  # noqa: E402
from src.config import STATUS_IKON, settings  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("bot")

API = "https://api.telegram.org/bot{}/{}"
OFFSET = Path(__file__).parent / ".offset"


def panggil(metode: str, **muatan):
    try:
        return requests.post(API.format(settings.telegram_token, metode),
                             json=muatan, timeout=40).json()
    except Exception as e:  # noqa: BLE001
        log.warning("Panggilan %s gagal: %s", metode, e)
        return {}


def balas(chat_id, teks, tombol=None):
    m = {"chat_id": chat_id, "text": teks, "parse_mode": "HTML",
         "disable_web_page_preview": True}
    if tombol:
        m["reply_markup"] = {"inline_keyboard": tombol}
    return panggil("sendMessage", **m)


def _waktu(iso):
    if not iso:
        return "-"
    try:
        return (datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
                .astimezone().strftime("%d %b %Y, %H:%M WIB"))
    except Exception:  # noqa: BLE001
        return str(iso)


# --------------------------------------------------------------- perintah
def cmd_start(chat_id, nama, argumen=""):
    # Parameter setelah /start menentukan peran. Tautan untuk petugas BPBD
    # berbeda dari tautan untuk warga, sehingga keduanya menerima jenis
    # pesan yang berbeda tanpa perlu mengisi formulir apa pun.
    peran = "bpbd" if argumen.strip().lower().startswith("bpbd") else "warga"
    berhasil = sb.daftarkan_kontak(chat_id, nama, peran)

    if peran == "bpbd":
        teks = (
            f"Selamat datang, <b>{nama}</b>.\n\n"
            f"Nomor Anda terdaftar sebagai <b>petugas</b> pada sistem "
            f"SIGAP Drainase {settings.saluran.nama}.\n\n"
            "Anda akan menerima laporan teknis otomatis berisi lokasi, tingkat "
            "penyumbatan, perkiraan volume material, dan saran penanganan setiap "
            "kali sistem mendeteksi status Waspada ke atas.\n\n"
            "Setelah pembersihan selesai, mohon isi formulir verifikasi di dasbor. "
            "Data itulah yang membuat sistem semakin tepat dari bulan ke bulan."
        )
    else:
        teks = (
            f"Halo <b>{nama}</b>, selamat datang di <b>SIGAP Drainase</b>.\n\n"
            f"Nomor Anda sudah terdaftar untuk menerima peringatan dini genangan "
            f"di {settings.saluran.nama}.\n\n"
            "Sensor memantau saluran sepanjang hari. Anda akan dihubungi otomatis "
            f"begitu terdeteksi {STATUS_IKON['WASPADA']} Waspada, "
            f"{STATUS_IKON['SIAGA']} Siaga, atau {STATUS_IKON['KRITIS']} Kritis. "
            "Saat kondisi aman, bot ini diam supaya tidak mengganggu.\n\n"
            "Perintah yang bisa dipakai kapan saja:\n"
            "/status — kondisi saluran sekarang\n"
            "/prediksi — ramalan muka air 12 jam\n"
            "/riwayat — kejadian 7 hari terakhir\n"
            "/lapor — laporkan sampah atau genangan\n"
            "/mitigasi — langkah pencegahan\n"
            "/bantuan — semua perintah"
        )

    if not berhasil:
        teks += "\n\n⚠️ Pendaftaran belum tersimpan di server. Coba /daftar beberapa saat lagi."
    balas(chat_id, teks)


def cmd_daftar(chat_id, nama):
    balas(chat_id, "✅ Anda aktif menerima peringatan. Ketik /berhenti kapan saja."
          if sb.daftarkan_kontak(chat_id, nama, "warga")
          else "Pendaftaran gagal tersimpan. Coba lagi beberapa menit lagi.")


def cmd_berhenti(chat_id):
    sb.nonaktifkan_kontak(chat_id)
    balas(chat_id, "Anda berhenti menerima peringatan. Ketik /daftar bila ingin bergabung kembali.")


def cmd_status(chat_id):
    d = sb.status_terakhir()
    if not d:
        balas(chat_id, "Belum ada data. Sistem memperbarui setiap 15 menit.")
        return
    st = d.get("status", "AMAN")
    endapan = float(d.get("rasio_endapan") or 0) * 100
    debit = float(d.get("rasio_debit") or 0) * 100

    keterangan = {
        "AMAN": "Saluran mengalir normal. Tidak ada tindakan khusus yang perlu dilakukan.",
        "WASPADA": "Saluran mulai menyempit oleh endapan. Belum berbahaya, tetapi perlu diperhatikan.",
        "SIAGA": "Aliran melambat. Genangan berpotensi terjadi bila hujan turun.",
        "KRITIS": "Saluran tersumbat parah. Genangan sangat mungkin masuk ke jalan dan rumah.",
    }.get(st, "")

    balas(chat_id, (
        f"{STATUS_IKON.get(st, '⚪')} <b>{st}</b>\n"
        f"{settings.saluran.nama}\n\n"
        f"{keterangan}\n\n"
        f"Endapan   : <b>{endapan:.0f}%</b> kedalaman saluran\n"
        f"Aliran air: <b>{debit:.0f}%</b> dari seharusnya\n"
        f"Perkiraan material: <b>{d.get('estimasi_volume_m3', '-')} m³</b> "
        f"(sekitar {d.get('estimasi_karung', '-')} karung)\n"
        f"Curah hujan: {d.get('hujan_mm', 0)} mm/jam\n\n"
        f"<i>Diperbarui {_waktu(d.get('timestamp'))}</i>"
    ))


def cmd_prediksi(chat_id):
    d = sb.status_terakhir()
    ramalan = (d or {}).get("ramalan")
    if isinstance(ramalan, str):
        import json
        try:
            ramalan = json.loads(ramalan)
        except Exception:  # noqa: BLE001
            ramalan = None
    if not ramalan:
        balas(chat_id, "Ramalan belum tersedia. Model membutuhkan data sensor "
                       "sekitar satu bulan sebelum bisa meramal.")
        return

    kedalaman = settings.saluran.kedalaman_mm
    baris = ["📈 <b>Ramalan muka air 12 jam ke depan</b>", ""]
    for w, mm in list(zip(ramalan["waktu"], ramalan["permukaan_mm"]))[::8][:8]:
        rasio = mm / kedalaman
        ikon = "🔴" if rasio >= 0.85 else ("🟠" if rasio >= 0.6 else "🟢")
        bar = "█" * max(1, min(16, int(rasio * 16)))
        baris.append(f"{ikon} {_waktu(w)[:-4]}  {bar} {rasio * 100:.0f}%")

    baris += ["", f"Puncak {ramalan['rasio_puncak'] * 100:.0f}% kedalaman "
                  f"pada {_waktu(ramalan['waktu_puncak'])}"]
    if ramalan.get("berpotensi_meluap"):
        baris.append("\n⚠️ <b>Saluran berpotensi meluap.</b>")
    baris.append("\n<i>Perkiraan model, bukan kepastian.</i>")
    balas(chat_id, "\n".join(baris))


def cmd_riwayat(chat_id):
    balas(chat_id, "Riwayat lengkap beserta grafiknya ada di dasbor.",
          [[{"text": "Buka dasbor", "url": settings.situs_url}]]
          if settings.situs_url.startswith("http") else None)


def cmd_lapor(chat_id):
    balas(chat_id, (
        "📢 <b>Melaporkan sampah atau genangan</b>\n\n"
        "Ketik laporan Anda dalam satu pesan setelah perintah ini, contohnya:\n"
        "<code>/lapor ada kasur menyumbat saluran depan RT 6</code>\n\n"
        "Laporan Anda diteruskan ke petugas. Sensor hanya memantau satu titik, "
        "sehingga mata warga tetap menjadi pelengkap yang tidak tergantikan."
    ))


def cmd_lapor_isi(chat_id, nama, isi):
    teks = (f"📢 <b>Laporan warga</b>\n\n"
            f"Dari  : {nama}\n"
            f"Waktu : {datetime.now().astimezone().strftime('%d %b %Y, %H:%M WIB')}\n"
            f"Isi   : {isi}")
    diteruskan = 0
    for k in sb.ambil_kontak("bpbd"):
        if k.get("chat_id") and balas(k["chat_id"], teks).get("ok"):
            diteruskan += 1
    if settings.telegram_admin:
        balas(settings.telegram_admin, teks)
    balas(chat_id, f"Terima kasih. Laporan Anda diteruskan ke {diteruskan} petugas."
          if diteruskan else
          "Terima kasih. Laporan tercatat, tetapi belum ada petugas terdaftar "
          "di sistem. Sampaikan juga langsung ke pengurus RT atau RW.")


def cmd_mitigasi(chat_id):
    baris = ["🛟 <b>Mencegah genangan di lingkungan sendiri</b>", "",
             "<b>Sehari-hari:</b>",
             "• Jangan membuang sampah, sisa makanan, atau minyak jelantah ke saluran.",
             "• Bersihkan daun dan plastik di mulut saluran depan rumah.",
             "• Pasang saringan sederhana di lubang pembuangan halaman.",
             "• Laporkan saluran tersumbat lewat /lapor sebelum menjadi parah.",
             ""]
    for tingkat in ("WASPADA", "SIAGA", "KRITIS"):
        baris.append(f"<b>Saat status {tingkat}:</b>")
        baris += [f"• {t}" for t in TINDAKAN_WARGA[tingkat]]
        baris.append("")
    baris.append("Darurat: <b>112</b> • Basarnas: <b>115</b>")
    balas(chat_id, "\n".join(baris))


def cmd_lokasi(chat_id):
    s = settings.saluran
    balas(chat_id, (
        f"📍 <b>Titik pantau</b>\n\n"
        f"Saluran  : {s.nama}\n"
        f"Kode     : {s.id}\n"
        f"Koordinat: {s.lat:.5f}, {s.lon:.5f}\n\n"
        f"<b>Ukuran saluran</b>\n"
        f"Lebar     : {s.lebar_mm / 10:.0f} cm\n"
        f"Kedalaman : {s.kedalaman_mm / 10:.0f} cm\n"
        f"Segmen    : {s.panjang_segmen_m:.0f} meter\n\n"
        f"<b>Sensor terpasang</b>\n"
        f"• Radar VEGAPULS Air 23 (tinggi permukaan, akurasi ±5 mm)\n"
        f"• Sensor debit air\n"
        f"• Modul pH RS485"
    ))
    panggil("sendLocation", chat_id=chat_id, latitude=s.lat, longitude=s.lon)


def cmd_bantuan(chat_id):
    balas(chat_id, (
        "<b>Perintah SIGAP Drainase</b>\n\n"
        "/status — kondisi saluran terkini\n"
        "/prediksi — ramalan muka air 12 jam\n"
        "/riwayat — kejadian 7 hari terakhir\n"
        "/lapor — laporkan sampah atau genangan\n"
        "/mitigasi — langkah pencegahan\n"
        "/lokasi — titik sensor dan ukuran saluran\n"
        "/daftar — mulai menerima peringatan\n"
        "/berhenti — berhenti menerima peringatan\n\n"
        "Peringatan dikirim otomatis hanya saat status Waspada ke atas."
    ))


PERINTAH = {
    "start": lambda c, n, a: cmd_start(c, n, a),
    "daftar": lambda c, n, a: cmd_daftar(c, n),
    "berhenti": lambda c, n, a: cmd_berhenti(c),
    "stop": lambda c, n, a: cmd_berhenti(c),
    "status": lambda c, n, a: cmd_status(c),
    "prediksi": lambda c, n, a: cmd_prediksi(c),
    "riwayat": lambda c, n, a: cmd_riwayat(c),
    "lapor": lambda c, n, a: (cmd_lapor_isi(c, n, a) if a.strip() else cmd_lapor(c)),
    "mitigasi": lambda c, n, a: cmd_mitigasi(c),
    "lokasi": lambda c, n, a: cmd_lokasi(c),
    "bantuan": lambda c, n, a: cmd_bantuan(c),
    "help": lambda c, n, a: cmd_bantuan(c),
}


def proses(update: dict) -> None:
    pesan = update.get("message") or update.get("edited_message")
    if not pesan or "text" not in pesan:
        return
    chat_id = pesan["chat"]["id"]
    nama = pesan["from"].get("first_name", "Warga")
    teks = pesan["text"].strip()

    if not teks.startswith("/"):
        balas(chat_id, "Ketik /bantuan untuk melihat daftar perintah, "
                       "atau /lapor untuk melaporkan sampah dan genangan.")
        return

    bagian = teks.split(maxsplit=1)
    perintah = bagian[0][1:].split("@")[0].lower()
    argumen = bagian[1] if len(bagian) > 1 else ""

    aksi = PERINTAH.get(perintah)
    if not aksi:
        balas(chat_id, f"Perintah /{perintah} tidak dikenal. Ketik /bantuan.")
        return
    log.info("/%s dari %s (%s)", perintah, nama, chat_id)
    try:
        aksi(chat_id, nama, argumen)
    except Exception as e:  # noqa: BLE001
        log.exception("Perintah gagal: %s", e)
        balas(chat_id, "Terjadi gangguan saat memproses. Coba lagi sebentar lagi.")


def pasang_menu() -> None:
    panggil("setMyCommands", commands=[
        {"command": "status", "description": "Kondisi saluran terkini"},
        {"command": "prediksi", "description": "Ramalan muka air 12 jam"},
        {"command": "riwayat", "description": "Kejadian 7 hari terakhir"},
        {"command": "lapor", "description": "Laporkan sampah atau genangan"},
        {"command": "mitigasi", "description": "Langkah pencegahan"},
        {"command": "lokasi", "description": "Titik sensor dan ukuran saluran"},
        {"command": "daftar", "description": "Mulai terima peringatan"},
        {"command": "berhenti", "description": "Berhenti terima peringatan"},
        {"command": "bantuan", "description": "Daftar perintah"},
    ])
    panggil("setMyDescription",
            description="Peringatan dini genangan dan penyumbatan saluran untuk warga Mangunharjo.")
    log.info("Menu perintah terpasang.")


def jalankan(sekali: bool = False) -> None:
    settings.wajib_lengkap()
    pasang_menu()
    offset = int(OFFSET.read_text()) if OFFSET.exists() else 0
    log.info("Bot berjalan. Tekan Ctrl+C untuk berhenti.")
    while True:
        hasil = panggil("getUpdates", offset=offset, timeout=0 if sekali else 25)
        for upd in hasil.get("result", []):
            offset = upd["update_id"] + 1
            proses(upd)
        OFFSET.write_text(str(offset))
        if sekali:
            log.info("Antrean selesai diproses.")
            return
        time.sleep(1)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--sekali", action="store_true")
    p.add_argument("--pasang-menu", action="store_true")
    a = p.parse_args()
    if a.pasang_menu:
        settings.wajib_lengkap()
        pasang_menu()
    else:
        try:
            jalankan(a.sekali)
        except KeyboardInterrupt:
            log.info("Bot dihentikan.")
