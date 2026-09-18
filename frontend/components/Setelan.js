"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Pengaturan tampilan: terang atau gelap.
 *
 * Pilihan disimpan di peramban masing-masing pengunjung, bukan di basis data,
 * karena ini soal kenyamanan pribadi dan tidak perlu diketahui siapa pun.
 *
 * Pemilihan bahasa sengaja dilepas untuk sementara atas permintaan pengelola.
 * Berkas kamusnya tetap disimpan di lib/bahasa.js bila kelak ingin dipasang
 * kembali, tetapi tidak lagi dipanggil dari mana pun.
 */
const Konteks = createContext({ mode: "siang", setMode: () => {} });

export function useSetelan() { return useContext(Konteks); }

export default function Setelan({ children }) {
  const [mode, setMode] = useState("siang");
  const [siap, setSiap] = useState(false);

  // Dibaca setelah halaman muncul, karena localStorage tidak tersedia saat
  // halaman dibangun di server.
  useEffect(() => {
    try {
      const m = localStorage.getItem("sigap-mode");
      if (m === "malam" || m === "siang") setMode(m);
      else if (matchMedia("(prefers-color-scheme: dark)").matches) setMode("malam");
    } catch (_) { /* peramban menolak penyimpanan, abaikan */ }
    setSiap(true);
  }, []);

  useEffect(() => {
    if (!siap) return;
    document.documentElement.setAttribute("data-mode", mode);
    try { localStorage.setItem("sigap-mode", mode); } catch (_) {}
  }, [mode, siap]);

  return <Konteks.Provider value={{ mode, setMode }}>{children}</Konteks.Provider>;
}

/* --------------------------------------------- tombol terang atau gelap */
export function TombolSetelan() {
  const { mode, setMode } = useSetelan();
  const keGelap = mode === "siang";

  return (
    <button className="tombol-mode"
            onClick={() => setMode(keGelap ? "malam" : "siang")}
            title={keGelap ? "Tampilan gelap" : "Tampilan terang"}
            aria-label={keGelap ? "Beralih ke tampilan gelap" : "Beralih ke tampilan terang"}>
      {keGelap ? "\u263D" : "\u2600"}
    </button>
  );
}
