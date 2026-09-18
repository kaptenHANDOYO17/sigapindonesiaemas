"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { BAHASA, teks } from "../lib/bahasa";

/**
 * Pengaturan tampilan: bahasa dan terang atau gelap.
 *
 * Pilihan disimpan di peramban masing-masing pengunjung, bukan di basis data,
 * karena ini soal kenyamanan pribadi dan tidak perlu diketahui siapa pun.
 *
 * Bahasa sekaligus menentukan tema warna:
 *   Indonesia  -> tema merah putih
 *   Jawa       -> tema cokelat batik
 *   English    -> tema biru bawaan
 */
const Konteks = createContext({ bahasa: "id", mode: "siang", t: (k) => k });

export function useSetelan() { return useContext(Konteks); }

export default function Setelan({ children }) {
  const [bahasa, setBahasa] = useState("id");
  const [mode, setMode] = useState("siang");
  const [siap, setSiap] = useState(false);

  // Baca pilihan tersimpan. Dilakukan setelah halaman muncul, karena
  // localStorage tidak tersedia saat halaman dibangun di server.
  useEffect(() => {
    try {
      const b = localStorage.getItem("sigap-bahasa");
      const m = localStorage.getItem("sigap-mode");
      if (b && BAHASA[b]) setBahasa(b);
      if (m === "malam" || m === "siang") setMode(m);
      else if (matchMedia("(prefers-color-scheme: dark)").matches) setMode("malam");
    } catch (_) { /* peramban menolak penyimpanan, abaikan */ }
    setSiap(true);
  }, []);

  useEffect(() => {
    if (!siap) return;
    document.documentElement.setAttribute("data-bahasa", bahasa);
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.lang = BAHASA[bahasa].kode;
    try {
      localStorage.setItem("sigap-bahasa", bahasa);
      localStorage.setItem("sigap-mode", mode);
    } catch (_) {}
  }, [bahasa, mode, siap]);

  const nilai = {
    bahasa, setBahasa, mode, setMode,
    t: (kunci) => teks(kunci, bahasa),
  };

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

/* ------------------------------------------------------- tombol setelan */
export function TombolSetelan() {
  const { bahasa, setBahasa, mode, setMode, t } = useSetelan();

  return (
    <div className="setelan">
      <div className="pilih-bahasa" role="group" aria-label={t("setelan.bahasa")}>
        {Object.entries(BAHASA).map(([kode, d]) => (
          <button key={kode} onClick={() => setBahasa(kode)}
                  className={bahasa === kode ? "nyala" : ""}
                  title={d.nama} aria-pressed={bahasa === kode}>
            {d.bendera}
          </button>
        ))}
      </div>

      <button className="tombol-mode"
              onClick={() => setMode(mode === "siang" ? "malam" : "siang")}
              title={mode === "siang" ? t("setelan.malam") : t("setelan.siang")}
              aria-label={mode === "siang" ? t("setelan.malam") : t("setelan.siang")}>
        {mode === "siang" ? "\u263D" : "\u2600"}
      </button>
    </div>
  );
}
