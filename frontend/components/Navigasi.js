"use client";

import { useEffect, useState } from "react";
import MenuPengelola from "./MenuPengelola";
import { TombolSetelan, useSetelan } from "./Setelan";

/**
 * Menu navigasi utama.
 *
 * Di layar lebar, seluruh tautan tampil berjajar. Di ponsel, tautan disembunyikan
 * di balik satu tombol, karena tujuh tautan berjajar akan memenuhi layar dan
 * mendorong isi halaman ke bawah.
 */
const TAUTAN = [
  ["/", "nav.dasbor"],
  ["/peta", "nav.peta"],
  ["/daftar", "nav.daftar"],
  ["/lapor", "nav.lapor"],
  ["/simulasi", "nav.simulasi"],
  ["/tentang", "nav.tentang"],
];

export default function Navigasi() {
  const [buka, setBuka] = useState(false);
  const { t } = useSetelan();

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
        {TAUTAN.map(([alamat, kunci]) => (
          <a key={alamat} href={alamat} onClick={() => setBuka(false)}>{t(kunci)}</a>
        ))}
        <TombolSetelan />
        <MenuPengelola />
      </nav>
    </>
  );
}
