"use client";

import { useEffect, useState } from "react";
import MenuPengelola from "./MenuPengelola";
import { TombolSetelan } from "./Setelan";

/**
 * Menu navigasi utama.
 *
 * Di layar lebar, seluruh tautan tampil berjajar. Di ponsel, tautan disembunyikan
 * di balik satu tombol, karena tujuh tautan berjajar akan memenuhi layar dan
 * mendorong isi halaman ke bawah.
 */
const TAUTAN = [
  ["/", "Dasbor"],
  ["/peta", "Peta Sensor"],
  ["/daftar", "Daftar Peringatan"],
  ["/lapor", "Lapor"],
  ["/simulasi", "Simulasi"],
  ["/tentang", "Tentang Sistem"],
];

export default function Navigasi() {
  const [buka, setBuka] = useState(false);

  // Tutup menu ketika layar melebar, supaya tidak tertinggal terbuka.
  useEffect(() => {
    function ukur() { if (innerWidth > 900) setBuka(false); }
    addEventListener("resize", ukur);
    return () => removeEventListener("resize", ukur);
  }, []);

  return (
    <>
      <button className="tombol-menu" onClick={() => setBuka((b) => !b)}
              aria-label="Buka menu" aria-expanded={buka}>
        <span /><span /><span />
      </button>

      <nav className={`kepala-kanan ${buka ? "kepala-buka" : ""}`}>
        {TAUTAN.map(([alamat, label]) => (
          <a key={alamat} href={alamat} onClick={() => setBuka(false)}>{label}</a>
        ))}
        <TombolSetelan />
        <MenuPengelola />
      </nav>
    </>
  );
}
