"""
Mesin aturan SIGAP Drainase.

Modul ini berisi bagian yang paling menentukan keselamatan warga, sehingga
sengaja ditulis sebagai aturan yang dapat dibaca manusia, bukan sebagai
model kotak hitam. Model pembelajaran mesin berperan sebagai pendapat kedua,
bukan sebagai penentu tunggal.

CATATAN PENTING TENTANG SENSOR RADAR
------------------------------------
VEGAPULS Air 23 mengukur JARAK dari sensor ke permukaan pertama yang
memantulkan gelombang. Di dalam saluran drainase, permukaan itu adalah:
  - permukaan AIR, bila saluran sedang berair;
  - permukaan ENDAPAN, bila saluran sedang kering.

Artinya sensor tidak dapat melihat menembus air untuk mengukur endapan di
bawahnya. Tinggi endapan karena itu tidak diukur langsung, melainkan
disimpulkan dari kenaikan "dasar terbaca" selama periode kering. Cara ini
sah secara fisika dan sudah lazim pada pemantauan saluran terbuka, tetapi
batasannya harus disadari dan dicatat. Rinciannya dibahas pada
docs/KETERBATASAN_SENSOR.md
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

from .config import STATUS_URUT, settings


# ---------------------------------------------------------------------------
# 1. Terjemahan pembacaan radar
# ---------------------------------------------------------------------------
def jarak_ke_permukaan_mm(jarak_mm: float) -> float:
    """Ubah jarak sensor menjadi tinggi permukaan di atas dasar rancangan."""
    s = settings.saluran
    return max(0.0, s.tinggi_pasang_mm - float(jarak_mm))


def tinggi_air_mm(jarak_mm: float, dasar_terbaca_mm: float) -> float:
    """
    Tinggi kolom air = permukaan terbaca dikurangi dasar terbaca.

    `dasar_terbaca_mm` adalah tinggi dasar saluran yang sedang berlaku,
    yaitu dasar asli ditambah endapan yang menumpuk di atasnya.
    """
    return max(0.0, jarak_ke_permukaan_mm(jarak_mm) - float(dasar_terbaca_mm))


def rasio_endapan(dasar_terbaca_mm: float) -> float:
    """Tinggi endapan dibagi kedalaman saluran. Nilai 0 berarti bersih."""
    kedalaman = max(1.0, settings.saluran.kedalaman_mm)
    return min(1.0, max(0.0, float(dasar_terbaca_mm) / kedalaman))


def rasio_debit(debit_lpm: float, hujan_mm_per_jam: float = 0.0) -> float:
    """
    Debit terukur dibandingkan debit yang WAJAR untuk curah hujan saat itu.

    Membandingkan debit mentah dengan satu angka tetap akan keliru: saluran
    yang bersih pun berdebit rendah ketika tidak hujan. Karena itu pembanding
    disesuaikan dengan curah hujan. Saat kering, pembanding memakai aliran
    dasar sekitar 15 persen dari debit rancangan.
    """
    s = settings.saluran
    faktor_hujan = min(1.0, float(hujan_mm_per_jam) / 10.0)
    harapan = s.debit_rancangan_lpm * (0.15 + 0.85 * faktor_hujan)
    if harapan <= 0:
        return 1.0
    return max(0.0, float(debit_lpm) / harapan)


# ---------------------------------------------------------------------------
# 2. Matriks status
# ---------------------------------------------------------------------------
@dataclass
class Penilaian:
    status: str
    alasan: str
    rasio_endapan: float
    rasio_debit: float
    tinggi_air_mm: float
    rasio_air: float
    laju_naik_mm_per_menit: float
    ph: float | None
    ph_menyimpang: bool
    skor_anomali: float | None
    anomali_terdeteksi: bool
    duga_model: str | None
    keyakinan_model: float | None

    def dict(self) -> dict[str, Any]:
        return asdict(self)


def nilai_status(
    r_endapan: float,
    r_debit: float,
    r_air: float,
    laju_naik: float,
    ph: float | None = None,
    skor_anomali: float | None = None,
    lonjakan_dasar: float | None = None,
    duga_model: str | None = None,
    keyakinan_model: float | None = None,
) -> Penilaian:
    """
    Matriks penilaian empat tingkat.

        AMAN     : endapan rendah, debit normal
        WASPADA  : endapan tinggi, debit normal          -> penyempitan
        SIAGA    : endapan tinggi, debit menurun         -> penyumbatan
        KRITIS   : endapan sangat tinggi, debit sangat rendah

    Di luar matriks pokok, ada tiga pemicu tambahan yang menaikkan status
    tanpa memandang kondisi endapan, karena ketiganya menandakan bahaya
    yang sedang berlangsung, bukan bahaya yang sedang menumpuk.
    """
    a = settings.ambang

    endapan_tinggi = r_endapan >= a.endapan_tinggi
    endapan_sangat_tinggi = r_endapan >= a.endapan_sangat_tinggi
    debit_menurun = r_debit < a.debit_menurun
    debit_sangat_rendah = r_debit < a.debit_sangat_rendah

    # --- matriks pokok ---
    if endapan_sangat_tinggi and debit_sangat_rendah:
        status, alasan = "KRITIS", "Endapan sangat tinggi dan debit air nyaris berhenti. Indikasi sumbatan parah."
    elif endapan_tinggi and debit_menurun:
        status, alasan = "SIAGA", "Endapan tinggi disertai penurunan debit. Indikasi saluran mulai tersumbat."
    elif endapan_tinggi:
        status, alasan = "WASPADA", "Endapan tinggi namun aliran masih normal. Indikasi penyempitan saluran."
    else:
        status, alasan = "AMAN", "Endapan rendah dan aliran normal."

    # --- pemicu tambahan ---
    # Perbedaan arah antara muka air dan aliran adalah tanda khas sumbatan.
    # Pada saluran sehat, air naik berarti aliran ikut naik. Bila air tinggi
    # tetapi aliran justru rendah, ada sesuatu yang menahan di hilir.
    # Aturan ini penting karena matriks pokok hanya melihat endapan, sehingga
    # sumbatan mendadak oleh benda besar (kasur, dahan, tumpukan plastik)
    # bisa lolos meski endapan dasarnya masih rendah.
    if debit_sangat_rendah and r_air >= 0.45 and status in ("AMAN", "WASPADA"):
        status = "SIAGA"
        alasan = ("Muka air cukup tinggi tetapi aliran nyaris berhenti. "
                  "Indikasi ada benda yang menyumbat di hilir, bukan sekadar endapan.")

    # Saluran yang terisi material lebih dari separuh kedalamannya adalah
    # keadaan kritis, tidak peduli sedang hujan atau tidak. Aliran memang
    # tampak normal saat kemarau, tetapi kapasitas yang tersisa tinggal
    # sedikit; begitu hujan turun, saluran langsung meluap. Tanpa aturan ini,
    # kondisi tersebut hanya berstatus WASPADA sepanjang musim kemarau, dan
    # pengerukan tidak akan pernah dijadwalkan tepat waktu.
    if endapan_sangat_tinggi:
        status = "KRITIS"
        alasan = ("Endapan sudah melewati separuh kedalaman saluran. Kapasitas "
                  "tersisa sangat tipis dan saluran akan langsung meluap begitu "
                  "hujan turun. Perlu pengerukan segera.")

    # Dasar saluran yang naik terlalu cepat bukan endapan. Endapan sungguhan
    # menumpuk 2 sampai 7 milimeter per hari; kenaikan belasan milimeter per
    # hari berarti ada air yang tertahan di belakang sumbatan. Keduanya tampak
    # sama bagi radar, tetapi kecepatannya membedakan.
    if lonjakan_dasar is not None and lonjakan_dasar >= 1.5 and status in ("AMAN", "WASPADA"):
        status = "SIAGA"
        alasan = ("Dasar saluran terbaca naik jauh lebih cepat daripada laju penumpukan "
                  "endapan yang wajar. Ini menandakan air tertahan di belakang sumbatan, "
                  "bukan endapan yang menumpuk perlahan.")

    if r_air >= a.air_meluap:
        status, alasan = "KRITIS", "Muka air sudah mendekati bibir saluran. Risiko meluap ke jalan dan permukiman."
    elif laju_naik >= a.laju_naik_mendadak and status in ("AMAN", "WASPADA"):
        status = "SIAGA"
        alasan = "Muka air naik mendadak. Saluran kemungkinan tidak sanggup menampung aliran masuk."

    ph_menyimpang = ph is not None and not (a.ph_min <= ph <= a.ph_max)
    anomali = skor_anomali is not None and skor_anomali < a.anomali

    # Model hanya boleh MENAIKKAN status, tidak pernah menurunkannya.
    #
    # Pembatasan ini berlaku untuk kedua model. Model anomali dibatasi karena
    # terbukti lemah: pada pengujian ia hanya menangkap sekitar 5 persen
    # kejadian berbahaya. Model klasifikasi dibatasi karena alasan yang
    # berbeda, yaitu ketepatannya yang tinggi masih diukur terhadap simulator,
    # bukan terhadap saluran Mangunharjo.
    #
    # Setelah terkumpul data verifikasi lapangan yang cukup dan ketepatan model
    # terbukti di lapangan, pembatasan ini boleh dilonggarkan. Keputusan itu
    # harus diambil manusia yang bertanggung jawab, bukan oleh kode ini.
    if anomali and status == "AMAN":
        status = "WASPADA"
        alasan = "Pola pembacaan sensor menyimpang dari kebiasaan saluran ini, meski nilai tunggalnya masih normal."

    if duga_model in STATUS_URUT and STATUS_URUT[duga_model] > STATUS_URUT[status]:
        yakin = keyakinan_model if keyakinan_model is not None else 1.0
        # Keyakinan rendah tidak layak menaikkan status; angka di bawah 0,5
        # berarti model sendiri ragu di antara beberapa kemungkinan.
        if yakin >= 0.5:
            sebelum = status
            status = duga_model
            alasan = (f"Mesin aturan menilai {sebelum}, tetapi model klasifikasi menilai "
                      f"{duga_model} dengan keyakinan {yakin * 100:.0f} persen berdasarkan "
                      f"keseluruhan pola pembacaan. Status dinaikkan mengikuti penilaian "
                      f"yang lebih waspada.")

    return Penilaian(
        status=status,
        alasan=alasan,
        rasio_endapan=round(r_endapan, 4),
        rasio_debit=round(r_debit, 4),
        tinggi_air_mm=0.0,
        rasio_air=round(r_air, 4),
        laju_naik_mm_per_menit=round(laju_naik, 3),
        ph=None if ph is None else round(float(ph), 2),
        ph_menyimpang=ph_menyimpang,
        skor_anomali=None if skor_anomali is None else round(float(skor_anomali), 4),
        anomali_terdeteksi=bool(anomali),
        duga_model=duga_model,
        keyakinan_model=None if keyakinan_model is None else round(float(keyakinan_model), 4),
    )


# ---------------------------------------------------------------------------
# 3. Perkiraan kuantitas sampah
# ---------------------------------------------------------------------------
def estimasi_volume_sampah_m3(dasar_terbaca_mm: float) -> dict[str, float]:
    """
    Perkiraan volume material yang menumpuk pada segmen yang diwakili sensor.

    Rumusnya sederhana: tinggi endapan dikali lebar saluran dikali panjang
    segmen. Hasilnya adalah perkiraan kasar, bukan pengukuran. Satu sensor
    hanya melihat satu titik, sedangkan endapan di saluran tidak pernah rata.
    Karena itu keluaran disertai rentang bawah dan atas.
    """
    s = settings.saluran
    tinggi_m = max(0.0, float(dasar_terbaca_mm)) / 1000.0
    lebar_m = s.lebar_mm / 1000.0
    volume = tinggi_m * lebar_m * s.panjang_segmen_m
    return {
        "volume_m3": round(volume, 3),
        "volume_min_m3": round(volume * 0.6, 3),
        "volume_maks_m3": round(volume * 1.5, 3),
        "setara_karung": int(round(volume / 0.05)),  # 1 karung ~ 50 liter
    }


def dugaan_jenis_sampah(ph: float | None, laju_endap_mm_per_hari: float) -> dict[str, Any]:
    """
    Dugaan jenis material yang mendominasi endapan.

    Dasar penalarannya: sampah organik yang membusuk di air tergenang
    menghasilkan asam organik sehingga pH cenderung turun, dan penumpukannya
    berlangsung cepat. Endapan anorganik seperti lumpur, pasir, dan plastik
    tidak banyak mengubah pH dan menumpuk lebih lambat.

    PERINGATAN: pH air saluran juga dipengaruhi limbah rumah tangga, air
    sabun, intrusi air laut, dan hujan asam. Dugaan di bawah ini karena itu
    lemah dan HANYA boleh dipakai sebagai keterangan tambahan bagi petugas,
    tidak boleh menjadi dasar keputusan. Keyakinan sengaja dibatasi rendah
    sampai tersedia data pembanding dari hasil pengerukan sebenarnya.
    """
    if ph is None:
        return {"dugaan": "tidak diketahui", "keyakinan": 0.0,
                "catatan": "Data pH tidak tersedia."}

    cepat = laju_endap_mm_per_hari >= 3.0

    if ph < 6.5 and cepat:
        dugaan, yakin = "didominasi sampah organik", 0.45
    elif ph < 6.5:
        dugaan, yakin = "cenderung organik", 0.30
    elif ph > 8.5:
        dugaan, yakin = "cenderung limbah deterjen atau intrusi air laut", 0.30
    elif cepat:
        dugaan, yakin = "campuran, penumpukan cepat", 0.25
    else:
        dugaan, yakin = "cenderung lumpur atau material anorganik", 0.30

    return {
        "dugaan": dugaan,
        "keyakinan": yakin,
        "catatan": "Dugaan berdasarkan pH dan laju penumpukan. Perlu diperiksa langsung oleh petugas.",
    }


def ringkas_untuk_petugas(p: Penilaian, volume: dict, jenis: dict) -> str:
    """Satu paragraf teknis yang siap dibaca petugas lapangan."""
    s = settings.saluran
    return (
        f"Saluran {s.nama} ({s.id}) berstatus {p.status}. "
        f"Endapan mencapai {p.rasio_endapan * 100:.0f} persen kedalaman saluran, "
        f"aliran berada di {p.rasio_debit * 100:.0f} persen dari yang seharusnya. "
        f"Perkiraan material menumpuk {volume['volume_m3']:.1f} meter kubik "
        f"(rentang {volume['volume_min_m3']:.1f} sampai {volume['volume_maks_m3']:.1f}), "
        f"setara sekitar {volume['setara_karung']} karung. "
        f"Dugaan jenis material: {jenis['dugaan']}."
    )
