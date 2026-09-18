"""
Model 3D sistem SIGAP Drainase di lapangan.

Satu berkas ini menghasilkan dua hal dari sumber geometri yang sama:
  1. Gambar render dari empat sudut pandang (PNG)
  2. Berkas model tiga dimensi (OBJ dan MTL) yang dapat dibuka di Blender,
     Windows 3D Viewer, atau disisipkan ke PowerPoint

Memakai satu sumber geometri untuk keduanya penting: bila nanti ada ukuran
yang diperbaiki, gambar dan model tidak akan saling bertentangan.

Satuan dalam meter. Acuan (0,0,0) berada di dasar saluran, di tengah bak
kontrol.
"""
from __future__ import annotations

import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

KELUAR = Path("/mnt/user-data/outputs/model3d")
KELUAR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Warna bahan
# ---------------------------------------------------------------------------
WARNA = {
    "tanah":    "#C9B79B",
    "aspal":    "#8E8E8E",
    "beton":    "#D5D8DA",
    "beton2":   "#BFC4C7",
    "air":      "#7FB3D3",
    "endapan":  "#8A6F47",
    "sensor":   "#1F4E79",
    "logam":    "#7A858C",
    "kotak":    "#F0F3F5",
    "tiang":    "#9AA3A9",
    "probe":    "#2E7D5B",
    "berkas":   "#9CC3DB",
}

# ---------------------------------------------------------------------------
# Ukuran saluran, mengikuti nilai bawaan titik MTS-01
# ---------------------------------------------------------------------------
LEBAR_SALURAN = 0.60      # lebar dalam
KEDALAMAN     = 0.80      # dasar ke bibir
TEBAL_BETON   = 0.15
PANJANG       = 4.60      # panjang potongan yang digambar
BAK_PANJANG   = 2.20      # panjang bak kontrol
BAK_TINGGI    = 1.35      # dasar ke pelat penutup
TINGGI_PASANG = 1.20      # dasar ke muka sensor

TINGGI_ENDAPAN = 0.30     # dapat diubah untuk memperagakan status
TINGGI_AIR     = 0.42

muka = []                 # kumpulan (titik, warna, nama) untuk render dan OBJ


def kotak(x0, y0, z0, dx, dy, dz, warna, nama):
    """Tambahkan sebuah balok. Sisi bawah dihilangkan bila tertutup benda lain."""
    x1, y1, z1 = x0 + dx, y0 + dy, z0 + dz
    t = [
        [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)],   # bawah
        [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],   # atas
        [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],   # depan
        [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],   # belakang
        [(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)],   # kiri
        [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],   # kanan
    ]
    for s in t:
        muka.append((s, warna, nama))


def silinder(cx, cy, z0, jari, tinggi, warna, nama, sisi=20, sumbu="z"):
    """Silinder sederhana, dibangun dari sisi-sisi datar."""
    for i in range(sisi):
        a1 = 2 * math.pi * i / sisi
        a2 = 2 * math.pi * (i + 1) / sisi
        if sumbu == "z":
            p1 = (cx + jari * math.cos(a1), cy + jari * math.sin(a1), z0)
            p2 = (cx + jari * math.cos(a2), cy + jari * math.sin(a2), z0)
            p3 = (p2[0], p2[1], z0 + tinggi)
            p4 = (p1[0], p1[1], z0 + tinggi)
        else:  # sumbu x, dipakai untuk sensor debit yang melintang
            p1 = (cx, cy + jari * math.cos(a1), z0 + jari * math.sin(a1))
            p2 = (cx, cy + jari * math.cos(a2), z0 + jari * math.sin(a2))
            p3 = (cx + tinggi, p2[1], p2[2])
            p4 = (cx + tinggi, p1[1], p1[2])
        muka.append(([p1, p2, p3, p4], warna, nama))

    # tutup atas dan bawah
    for ujung in (0, tinggi):
        lingkar = []
        for i in range(sisi):
            a = 2 * math.pi * i / sisi
            if sumbu == "z":
                lingkar.append((cx + jari * math.cos(a), cy + jari * math.sin(a), z0 + ujung))
            else:
                lingkar.append((cx + ujung, cy + jari * math.cos(a), z0 + jari * math.sin(a)))
        muka.append((lingkar, warna, nama))


def kerucut(cx, cy, z_atas, z_bawah, jari_bawah, warna, nama, sisi=18):
    """Berkas gelombang radar, digambar sebagai kerucut terbalik."""
    puncak = (cx, cy, z_atas)
    for i in range(sisi):
        a1 = 2 * math.pi * i / sisi
        a2 = 2 * math.pi * (i + 1) / sisi
        p1 = (cx + jari_bawah * math.cos(a1), cy + jari_bawah * math.sin(a1), z_bawah)
        p2 = (cx + jari_bawah * math.cos(a2), cy + jari_bawah * math.sin(a2), z_bawah)
        muka.append(([puncak, p1, p2], warna, nama))


# ===========================================================================
#  MENYUSUN PEMANDANGAN
# ===========================================================================
Y0 = -LEBAR_SALURAN / 2
X_BAK0, X_BAK1 = -BAK_PANJANG / 2, BAK_PANJANG / 2

# Model ini digambar sebagai POTONGAN. Tanah, jalan, dan dinding di sisi
# depan sengaja dihilangkan, seolah-olah tanahnya dibelah, supaya isi saluran
# beserta letak sensornya terlihat. Pada kenyataannya seluruh bagian itu
# tertutup rapat dan tertimbun tanah.
kotak(-PANJANG / 2, Y0 - TEBAL_BETON - 0.9, -0.6,
      PANJANG, 0.9, KEDALAMAN + 0.6 + 0.25, WARNA["tanah"], "tanah_belakang")

# --- permukaan jalan, hanya sisi belakang --------------------------------
kotak(-PANJANG / 2, Y0 - TEBAL_BETON - 0.9, KEDALAMAN + 0.25, PANJANG, 0.9, 0.06,
      WARNA["aspal"], "jalan")

# --- dinding dan dasar saluran -------------------------------------------
kotak(-PANJANG / 2, Y0 - TEBAL_BETON, -TEBAL_BETON,
      PANJANG, LEBAR_SALURAN + 2 * TEBAL_BETON, TEBAL_BETON, WARNA["beton2"], "dasar_beton")
kotak(-PANJANG / 2, Y0 - TEBAL_BETON, 0, PANJANG, TEBAL_BETON, KEDALAMAN,
      WARNA["beton"], "dinding_belakang")
# Dinding depan sepenuhnya dibuang agar isi saluran terlihat. Sebagai
# penanda bahwa aslinya dinding itu ada, disisakan potongan pendek di kedua
# ujung model saja.
for x_awal in (-PANJANG / 2, PANJANG / 2 - 0.30):
    kotak(x_awal, Y0 + LEBAR_SALURAN, 0, 0.30, TEBAL_BETON, KEDALAMAN,
          WARNA["beton2"], "bekas_potongan")

# --- pelat penutup saluran, dua potong agar bak kontrol terbuka ----------
for x0, dx in [(-PANJANG / 2, PANJANG / 2 - BAK_PANJANG / 2),
               (BAK_PANJANG / 2, PANJANG / 2 - BAK_PANJANG / 2)]:
    kotak(x0, Y0 - TEBAL_BETON, KEDALAMAN,
          dx, LEBAR_SALURAN * 0.55 + TEBAL_BETON, 0.25, WARNA["beton2"], "pelat_saluran")

# --- dinding bak kontrol, menjulang lebih tinggi --------------------------
kotak(X_BAK0, Y0 - TEBAL_BETON, KEDALAMAN, BAK_PANJANG, TEBAL_BETON,
      BAK_TINGGI - KEDALAMAN + 0.25, WARNA["beton"], "dinding_bak")
# Dua dinding ujung bak kontrol
for x_awal in (X_BAK0, X_BAK1 - TEBAL_BETON):
    kotak(x_awal, Y0 - TEBAL_BETON, KEDALAMAN, TEBAL_BETON,
          LEBAR_SALURAN + 2 * TEBAL_BETON, BAK_TINGGI - KEDALAMAN + 0.25,
          WARNA["beton2"], "dinding_bak")

# --- pelat penutup bak kontrol, digambar terbuka sebagian ----------------
# Tutup bak kontrol digambar terbuka, tergeser ke satu sisi.
kotak(X_BAK0, Y0 - TEBAL_BETON, BAK_TINGGI + 0.25, 0.70,
      LEBAR_SALURAN + 2 * TEBAL_BETON, 0.10, WARNA["beton2"], "tutup_bak")

# --- endapan dan air ------------------------------------------------------
kotak(-PANJANG / 2, Y0, 0, PANJANG, LEBAR_SALURAN, TINGGI_ENDAPAN,
      WARNA["endapan"], "endapan")
kotak(-PANJANG / 2, Y0, TINGGI_ENDAPAN, PANJANG, LEBAR_SALURAN,
      TINGGI_AIR - TINGGI_ENDAPAN, WARNA["air"], "air")

# --- dudukan besi siku melintang di atas bak -----------------------------
kotak(-0.06, Y0 - TEBAL_BETON, TINGGI_PASANG + 0.10, 0.12,
      LEBAR_SALURAN + 2 * TEBAL_BETON, 0.05, WARNA["logam"], "dudukan")

# --- sensor radar ---------------------------------------------------------
silinder(0, 0, TINGGI_PASANG - 0.10, 0.055, 0.20, WARNA["sensor"], "sensor_radar")
silinder(0, 0, TINGGI_PASANG - 0.14, 0.075, 0.04, "#143D5E", "muka_antena")
kerucut(0, 0, TINGGI_PASANG - 0.14, TINGGI_AIR, 0.26, WARNA["berkas"], "berkas_radar")

# --- sensor debit, melintang pada saluran hilir --------------------------
silinder(1.35, 0, 0.18, 0.11, 0.26, WARNA["logam"], "sensor_debit", sumbu="x")

# --- probe pH, tergantung dari dudukan -----------------------------------
silinder(-0.55, 0.14, TINGGI_AIR - 0.12, 0.012, TINGGI_PASANG - TINGGI_AIR + 0.22,
         "#33393D", "kabel_ph")
silinder(-0.55, 0.14, TINGGI_AIR - 0.16, 0.028, 0.10, WARNA["probe"], "probe_ph")

# --- tiang dan kotak panel di atas tanah ---------------------------------
TIANG_X, TIANG_Y = 1.95, Y0 - TEBAL_BETON - 0.45
silinder(TIANG_X, TIANG_Y, KEDALAMAN + 0.31, 0.045, 1.35, WARNA["tiang"], "tiang")
kotak(TIANG_X - 0.22, TIANG_Y - 0.13, KEDALAMAN + 1.05, 0.44, 0.22, 0.34,
      WARNA["kotak"], "kotak_panel")
silinder(TIANG_X, TIANG_Y, KEDALAMAN + 1.66, 0.008, 0.28, WARNA["logam"], "antena")

# --- pipa pelindung kabel dari bak ke tiang ------------------------------
kotak(0.10, TIANG_Y - 0.02, KEDALAMAN + 0.31, TIANG_X - 0.10, 0.04, 0.04,
      WARNA["tiang"], "pipa_kabel")


# ===========================================================================
#  MENGGAMBAR
# ===========================================================================
def terang(warna_hex, faktor):
    """Menggelapkan atau menerangkan warna, agar sisi-sisinya terbedakan."""
    w = warna_hex.lstrip("#")
    r, g, b = (int(w[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(min(1, max(0, c * faktor)) for c in (r, g, b))


def normal_muka(titik):
    p = np.asarray(titik, dtype=float)
    if len(p) < 3:
        return np.array([0, 0, 1.0])
    n = np.cross(p[1] - p[0], p[2] - p[0])
    panjang = np.linalg.norm(n)
    return n / panjang if panjang > 1e-9 else np.array([0, 0, 1.0])


CAHAYA = np.array([0.45, -0.75, 0.85])
CAHAYA = CAHAYA / np.linalg.norm(CAHAYA)


def render(nama_berkas, elev, azim, judul, sorot=None):
    fig = plt.figure(figsize=(13, 9), dpi=190)
    ax = fig.add_subplot(111, projection="3d")

    poligon, warna_isi = [], []
    for titik, warna, nama in muka:
        n = normal_muka(titik)
        naung = 0.62 + 0.38 * max(0.0, float(np.dot(n, CAHAYA)))
        alpha = 0.34 if nama == "berkas_radar" else (0.78 if nama == "air" else 1.0)
        if sorot and nama not in sorot:
            c = terang("#C8CDD1", naung)
            alpha = min(alpha, 0.30)
        else:
            c = terang(warna, naung)
        poligon.append(titik)
        warna_isi.append((*c, alpha))

    koleksi = Poly3DCollection(poligon, facecolors=warna_isi,
                               edgecolors=(0.20, 0.24, 0.27, 0.35), linewidths=0.35)
    ax.add_collection3d(koleksi)

    ax.set_xlim(-2.4, 2.4)
    ax.set_ylim(-1.3, 1.1)
    ax.set_zlim(-0.35, 2.45)
    ax.set_box_aspect((4.8, 2.4, 2.8))
    ax.view_init(elev=elev, azim=azim)
    ax.set_axis_off()
    ax.set_facecolor("white")
    fig.patch.set_facecolor("white")

    ax.text2D(0.5, 0.965, judul, transform=ax.transAxes, ha="center",
              fontsize=15, fontweight="bold", color="#1F4E79")
    ax.text2D(0.5, 0.932,
              "SIGAP Drainase  \u00b7  Titik MTS-01, Kelurahan Meteseh, Kecamatan Tembalang, Kota Semarang",
              transform=ax.transAxes, ha="center", fontsize=9, color="#5C7180")

    fig.savefig(KELUAR / nama_berkas, dpi=190, facecolor="white",
                bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)
    print("dibuat:", nama_berkas)


# ===========================================================================
#  EKSPOR OBJ
# ===========================================================================
def ekspor_obj():
    bahan = {}
    for _, warna, nama in muka:
        bahan.setdefault(warna, f"bahan_{len(bahan):02d}")

    with open(KELUAR / "sigap_drainase.mtl", "w", encoding="utf-8") as f:
        f.write("# Bahan model SIGAP Drainase\n")
        for warna, nama_bahan in bahan.items():
            w = warna.lstrip("#")
            r, g, b = (int(w[i:i + 2], 16) / 255 for i in (0, 2, 4))
            f.write(f"\nnewmtl {nama_bahan}\n")
            f.write(f"Kd {r:.4f} {g:.4f} {b:.4f}\n")
            f.write("Ka 0.2 0.2 0.2\nKs 0.1 0.1 0.1\nNs 12\n")
            f.write("d 0.45\n" if warna == WARNA["berkas"] else "d 1.0\n")

    with open(KELUAR / "sigap_drainase.obj", "w", encoding="utf-8") as f:
        f.write("# Model 3D sistem SIGAP Drainase di lapangan\n")
        f.write("# Satuan meter. Titik acuan di dasar saluran, tengah bak kontrol.\n")
        f.write("mtllib sigap_drainase.mtl\n\n")

        nomor = 1
        bahan_kini = None
        kelompok_kini = None
        for titik, warna, nama in muka:
            if nama != kelompok_kini:
                f.write(f"\ng {nama}\n")
                kelompok_kini = nama
            if bahan[warna] != bahan_kini:
                f.write(f"usemtl {bahan[warna]}\n")
                bahan_kini = bahan[warna]
            for x, y, z in titik:
                # Tukar sumbu agar Y menjadi arah atas, mengikuti kebiasaan
                # perangkat lunak tiga dimensi seperti Blender dan 3D Viewer.
                f.write(f"v {x:.4f} {z:.4f} {-y:.4f}\n")
            f.write("f " + " ".join(str(nomor + i) for i in range(len(titik))) + "\n")
            nomor += len(titik)

    print("dibuat: sigap_drainase.obj dan sigap_drainase.mtl "
          f"({len(muka)} muka, {nomor - 1} titik)")


if __name__ == "__main__":
    render("3D_1_Tampak_Umum.png", 18, 38,
           "Tampak Umum Pemasangan Sistem di Lapangan")
    render("3D_2_Tampak_Potongan.png", 6, 88,
           "Tampak Potongan Melintang Bak Kontrol")
    render("3D_3_Tampak_Atas.png", 55, 42,
           "Tampak Atas Titik Pantau")
    render("3D_4_Sorot_Sensor.png", 12, 34,
           "Letak Sensor Radar, Debit, dan pH",
           sorot={"sensor_radar", "muka_antena", "berkas_radar", "dudukan",
                  "sensor_debit", "probe_ph", "kabel_ph", "kotak_panel",
                  "tiang", "antena", "air", "endapan"})
    ekspor_obj()
