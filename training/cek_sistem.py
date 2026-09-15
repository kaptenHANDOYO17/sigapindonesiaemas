"""
Pemeriksaan menyeluruh SIGAP Drainase.

Jalankan:
    python -m training.cek_sistem

Setiap komponen diuji lalu dilaporkan LULUS, GAGAL, LEWATI, atau PERHATIAN,
lengkap dengan cara memperbaikinya. Jalankan ini setiap kali ada yang tidak
beres; biasanya bagian yang bermasalah langsung terlihat.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HIJAU, MERAH, KUNING, ABU, RESET = "\033[92m", "\033[91m", "\033[93m", "\033[90m", "\033[0m"
hasil: list[tuple[str, str]] = []


def lapor(nama: str, status: str, pesan: str = "") -> None:
    warna = {"LULUS": HIJAU, "GAGAL": MERAH, "LEWATI": ABU, "PERHATIAN": KUNING}[status]
    print(f"  {warna}{status:<10}{RESET} {nama}")
    if pesan:
        print(f"             {ABU}{pesan}{RESET}")
    hasil.append((nama, status))


def bagian(judul: str) -> None:
    print(f"\n{judul}\n" + "-" * 62)


# --------------------------------------------------------------------------
def cek_pustaka() -> None:
    bagian("1. Pustaka Python")
    for modul, paket in {
        "numpy": "numpy", "pandas": "pandas", "requests": "requests",
        "sklearn": "scikit-learn", "joblib": "joblib",
    }.items():
        try:
            m = __import__(modul)
            lapor(f"{paket} ({getattr(m, '__version__', '?')})", "LULUS")
        except ImportError:
            lapor(paket, "GAGAL", f"Jalankan: pip install {paket}")
    try:
        import tensorflow as tf
        lapor(f"tensorflow ({tf.__version__})", "LULUS")
    except ImportError:
        lapor("tensorflow", "PERHATIAN",
              "Belum terpasang. Sistem tetap jalan tanpa ramalan LSTM, "
              "tetapi fitur prediksi tidak tersedia.")


def cek_gpu() -> None:
    bagian("2. Kartu grafis")
    try:
        import tensorflow as tf
    except ImportError:
        lapor("GPU", "LEWATI", "TensorFlow belum terpasang")
        return
    gpus = tf.config.list_physical_devices("GPU")
    if not gpus:
        lapor("GPU", "PERHATIAN",
              "Tidak terdeteksi. Pelatihan tetap bisa di CPU, hanya lebih lama. "
              "Baca docs/PANDUAN_GPU.md")
        return
    for g in gpus:
        rinci = tf.config.experimental.get_device_details(g)
        lapor(f"GPU: {rinci.get('device_name', g.name)}", "LULUS")


def cek_konfigurasi() -> None:
    bagian("3. Konfigurasi (.env)")
    from src.config import settings

    for nama, nilai, penting in [
        ("SUPABASE_URL", settings.supabase_url, True),
        ("SUPABASE_KEY", settings.supabase_key, True),
        ("TELEGRAM_BOT_TOKEN", settings.telegram_token, True),
        ("VEGA_API_TOKEN", settings.vega_token, False),
        ("VEGA_DEVICE_ID", settings.vega_device_id, False),
        ("WHATSAPP_TOKEN", settings.wa_token, False),
        ("TELEGRAM_ADMIN_CHAT_ID", settings.telegram_admin, False),
    ]:
        if nilai:
            lapor(nama, "LULUS", f"terisi ({len(str(nilai))} karakter)")
        elif penting:
            lapor(nama, "GAGAL", "belum diisi di berkas .env")
        else:
            lapor(nama, "LEWATI", "kosong, fitur terkait dinonaktifkan")

    s = settings.saluran
    lapor(f"Saluran: {s.nama} ({s.id})", "LULUS")

    # Geometri saluran adalah sumber kesalahan paling sering. Nilai bawaan
    # hampir pasti tidak sesuai dengan saluran sebenarnya.
    bawaan = (s.tinggi_pasang_mm == 1200.0 and s.kedalaman_mm == 800.0
              and s.lebar_mm == 600.0)
    lapor(
        f"Geometri: pasang {s.tinggi_pasang_mm:.0f} mm, dalam {s.kedalaman_mm:.0f} mm, "
        f"lebar {s.lebar_mm:.0f} mm",
        "PERHATIAN" if bawaan else "LULUS",
        "Masih memakai nilai bawaan. Ukur langsung saluran Anda, lalu isi di .env. "
        "Tanpa ini seluruh angka sistem salah. Baca docs/KALIBRASI.md" if bawaan else "",
    )

    if s.tinggi_pasang_mm <= s.kedalaman_mm:
        lapor("Hubungan tinggi pasang dan kedalaman", "GAGAL",
              "TINGGI_PASANG_MM harus LEBIH BESAR daripada KEDALAMAN_SALURAN_MM, "
              "karena sensor dipasang di atas bibir saluran.")
    else:
        lapor("Hubungan tinggi pasang dan kedalaman", "LULUS",
              f"sensor berada {s.tinggi_pasang_mm - s.kedalaman_mm:.0f} mm di atas bibir saluran")


def cek_sensor() -> None:
    bagian("4. Sumber data sensor")
    from src.config import settings
    from src.vega_client import ambil_hujan, ambil_vega

    if settings.vega_token and settings.vega_device_id:
        b = ambil_vega(sejak_menit=1440)
        lapor(f"VEGA Inventory System ({len(b)} pembacaan / 24 jam)",
              "LULUS" if b else "GAGAL",
              "" if b else "Tidak ada balasan. Periksa token, ID perangkat, dan "
                           "VEGA_BASE_URL. Struktur API dapat berbeda antar akun; "
                           "sesuaikan fungsi _normalkan di src/vega_client.py")
    else:
        lapor("VEGA Inventory System", "LEWATI", "belum dikonfigurasi")

    h = ambil_hujan()
    lapor("Curah hujan Open-Meteo", "LULUS" if h["tersedia"] else "GAGAL",
          f"{len(h['waktu'])} titik waktu" if h["tersedia"] else
          "Tanpa data hujan, debit rendah saat kemarau akan salah dibaca "
          "sebagai penyumbatan.")


def cek_model() -> None:
    bagian("5. Model AI")
    import json
    from src.config import MODELS_DIR, settings

    if settings.model.anomali.exists():
        ukuran = settings.model.anomali.stat().st_size / 1e6
        lapor(f"Model anomali ({ukuran:.1f} MB)", "LULUS")
        if settings.model.anomali_meta.exists():
            m = json.loads(settings.model.anomali_meta.read_text(encoding="utf-8"))
            sumber = m.get("sumber", "?")
            lapor(f"Sumber data pelatihan: {sumber}",
                  "PERHATIAN" if sumber == "sintetis" else "LULUS",
                  "Masih memakai data buatan. Latih ulang dengan data asli "
                  "setelah sensor mengumpulkan data sebulan: "
                  "python -m training.train_anomaly --sumber supabase"
                  if sumber == "sintetis" else "")
            lapor(f"Ambang skor: {m.get('ambang_skor', '?')}", "LULUS")
    else:
        lapor("Model anomali", "PERHATIAN",
              "Belum ada. Sistem tetap berjalan dengan matriks aturan saja. "
              "Latih dengan: python -m training.train_anomaly --sumber sintetis")

    jalur_klas = MODELS_DIR / "klasifikasi_status.joblib"
    if jalur_klas.exists():
        lapor("Model klasifikasi status", "LULUS")
        meta_klas = MODELS_DIR / "klasifikasi_meta.json"
        if meta_klas.exists():
            mk = json.loads(meta_klas.read_text(encoding="utf-8"))
            sumber = mk.get("sumber", "?")
            m2 = mk.get("metrik_uji", {})
            lapor(f"Sumber pelatihan klasifikasi: {sumber}",
                  "PERHATIAN" if sumber == "sintetis" else "LULUS",
                  "Masih dari simulator. Latih ulang dengan --sumber verifikasi "
                  "setelah terkumpul 30 catatan verifikasi lapangan."
                  if sumber == "sintetis" else "")
            if m2.get("kritis_terbaca_aman") is not None:
                lapor(f"KRITIS terbaca AMAN: {m2['kritis_terbaca_aman'] * 100:.2f} persen",
                      "LULUS" if m2["kritis_terbaca_aman"] < 0.02 else "PERHATIAN")
    else:
        lapor("Model klasifikasi status", "PERHATIAN",
              "Belum ada. Sistem berjalan dengan matriks aturan saja, dan ketepatannya "
              "jauh lebih rendah. Latih dengan: python -m training.train_classifier")

    if settings.model.ramalan.exists():
        lapor("Model ramalan LSTM", "LULUS")
        if settings.model.ramalan_meta.exists():
            m = json.loads(settings.model.ramalan_meta.read_text(encoding="utf-8"))
            mae = m.get("metrik", {}).get("mae_3jam_mm")
            if mae is not None:
                batas = settings.saluran.kedalaman_mm * 0.15
                lapor(f"Galat 3 jam pertama: {mae:.1f} mm",
                      "LULUS" if mae <= batas else "PERHATIAN",
                      "" if mae <= batas else
                      f"Melebihi 15 persen kedalaman saluran ({batas:.0f} mm). "
                      "Ramalan belum layak menjadi dasar peringatan.")
    else:
        lapor("Model ramalan LSTM", "PERHATIAN",
              "Belum ada. Fitur prediksi tidak aktif. "
              "Latih dengan: python -m training.train_forecast --sumber sintetis")


def cek_supabase() -> None:
    bagian("6. Sambungan Supabase")
    from src import supabase_client as sb
    from src.config import settings

    if not settings.supabase_url:
        lapor("Supabase", "LEWATI", "belum dikonfigurasi")
        return

    df = sb.ambil_sensor(menit=1440)
    lapor(f"Tabel sensor_drainase ({len(df)} baris / 24 jam)",
          "LULUS" if len(df) else "PERHATIAN",
          "" if len(df) else "Kosong. Periksa apakah VEGA dan ESP32 sudah mengirim data.")

    d = sb.status_terakhir()
    lapor("Tabel status_ai", "LULUS" if d else "PERHATIAN",
          f"terakhir {d.get('timestamp')} berstatus {d.get('status')}" if d
          else "belum ada penilaian, wajar bila sistem baru dipasang")

    warga = sb.ambil_kontak("warga")
    petugas = sb.ambil_kontak("bpbd")
    lapor(f"Kontak terdaftar: {len(warga)} warga, {len(petugas)} petugas",
          "LULUS" if warga or petugas else "PERHATIAN",
          "" if petugas else "Belum ada petugas BPBD terdaftar. Laporan teknis "
                             "tidak akan sampai ke siapa pun.")

    ver = sb.ambil_verifikasi(hari=180)
    lapor(f"Verifikasi lapangan: {len(ver)} catatan",
          "LULUS" if len(ver) >= 5 else "PERHATIAN",
          "" if len(ver) >= 5 else
          "Kurang dari 5 catatan. Ambang batas belum bisa diperbaiki dari data "
          "nyata, sehingga sistem masih menebak. Ini kekurangan terpenting.")


def cek_telegram() -> None:
    bagian("7. Bot Telegram")
    from src.config import settings

    if not settings.telegram_token:
        lapor("Telegram", "LEWATI", "token belum diisi")
        return
    import requests
    try:
        r = requests.get(
            f"https://api.telegram.org/bot{settings.telegram_token}/getMe", timeout=20
        ).json()
        if r.get("ok"):
            b = r["result"]
            lapor(f"Bot aktif: @{b['username']}", "LULUS")
            print(f"             {ABU}Tautan warga : https://t.me/{b['username']}?start=warga{RESET}")
            print(f"             {ABU}Tautan petugas: https://t.me/{b['username']}?start=bpbd{RESET}")
        else:
            lapor("Bot Telegram", "GAGAL", "Token ditolak. Ambil ulang dari @BotFather.")
    except Exception as e:  # noqa: BLE001
        lapor("Bot Telegram", "GAGAL", str(e)[:150])


def cek_alur() -> None:
    bagian("8. Uji mesin aturan")
    from src.rules import estimasi_volume_sampah_m3, nilai_status

    kasus = [
        ("Saluran bersih, hujan normal", dict(r_endapan=0.05, r_debit=0.95, r_air=0.30, laju_naik=1.0), "AMAN"),
        ("Endapan tinggi, aliran normal", dict(r_endapan=0.35, r_debit=0.90, r_air=0.40, laju_naik=1.0), "WASPADA"),
        ("Endapan tinggi, aliran turun", dict(r_endapan=0.35, r_debit=0.45, r_air=0.50, laju_naik=1.0), "SIAGA"),
        ("Endapan parah", dict(r_endapan=0.60, r_debit=0.20, r_air=0.70, laju_naik=1.0), "KRITIS"),
        ("Air hampir meluap", dict(r_endapan=0.10, r_debit=0.90, r_air=0.90, laju_naik=2.0), "KRITIS"),
        ("Air naik mendadak", dict(r_endapan=0.10, r_debit=0.80, r_air=0.50, laju_naik=12.0), "SIAGA"),
        ("Sumbatan benda besar", dict(r_endapan=0.10, r_debit=0.20, r_air=0.55, laju_naik=1.0), "SIAGA"),
    ]
    for nama, arg, diharapkan in kasus:
        p = nilai_status(**arg)
        lapor(f"{nama} -> {p.status}",
              "LULUS" if p.status == diharapkan else "GAGAL",
              "" if p.status == diharapkan else f"seharusnya {diharapkan}")

    v = estimasi_volume_sampah_m3(300.0)
    lapor(f"Perkiraan volume: {v['volume_m3']} m3 ({v['setara_karung']} karung)",
          "LULUS" if v["volume_m3"] > 0 else "GAGAL")


def main() -> int:
    print("=" * 62)
    print("  SIGAP DRAINASE — PEMERIKSAAN SISTEM")
    print("=" * 62)

    for f in (cek_pustaka, cek_gpu, cek_konfigurasi, cek_sensor,
              cek_model, cek_supabase, cek_telegram, cek_alur):
        try:
            f()
        except Exception as e:  # noqa: BLE001
            lapor(f.__name__, "GAGAL", f"{type(e).__name__}: {str(e)[:170]}")

    gagal = sum(1 for _, s in hasil if s == "GAGAL")
    perhatian = sum(1 for _, s in hasil if s == "PERHATIAN")
    lulus = sum(1 for _, s in hasil if s == "LULUS")

    print("\n" + "=" * 62)
    print(f"  {HIJAU}{lulus} lulus{RESET} · {KUNING}{perhatian} perlu perhatian{RESET} · "
          f"{MERAH}{gagal} gagal{RESET}")
    print("=" * 62)
    if gagal == 0:
        print(f"\n{HIJAU}Sistem siap. Uji siklus penuh dengan:{RESET}\n"
              "  python -m src.main --dry-run\n")
    else:
        print(f"\n{MERAH}Perbaiki dulu bagian yang GAGAL di atas.{RESET}\n")
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(main())
