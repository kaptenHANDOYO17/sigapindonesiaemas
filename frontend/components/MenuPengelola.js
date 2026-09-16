"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, belumDikonfigurasi, ambilProfil, LABEL_PERAN } from "../lib/supabase";
import Avatar from "./Avatar";

/**
 * Ikon profil di pojok kanan atas.
 *
 * Saat belum masuk, yang tampil hanya tautan "Masuk Pengelola". Setelah masuk,
 * berubah menjadi ikon nama yang dapat diklik untuk membuka menu.
 */
export default function MenuPengelola() {
  const [profil, setProfil] = useState(null);
  const [buka, setBuka] = useState(false);
  const wadah = useRef(null);

  useEffect(() => {
    if (belumDikonfigurasi) return;
    let hidup = true;
    ambilProfil().then((p) => hidup && setProfil(p));

    // Ikut berubah saat pengguna masuk atau keluar di tab lain.
    const { data: langganan } = supabase.auth.onAuthStateChange(() => {
      ambilProfil().then((p) => hidup && setProfil(p));
    });
    return () => { hidup = false; langganan?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    function klikLuar(e) {
      if (wadah.current && !wadah.current.contains(e.target)) setBuka(false);
    }
    document.addEventListener("mousedown", klikLuar);
    return () => document.removeEventListener("mousedown", klikLuar);
  }, []);

  if (!profil) {
    return <a href="/masuk" className="tautan-pengelola">Masuk Pengelola</a>;
  }

  return (
    <div className="menu-profil" ref={wadah}>
      <button className="menu-profil-tombol" onClick={() => setBuka((b) => !b)}
              aria-label="Menu pengelola">
        <Avatar nama={profil.nama} foto={profil.foto_url} ukuran={32} />
        <span className="menu-profil-nama">{profil.nama.split(" ")[0]}</span>
      </button>

      {buka && (
        <div className="menu-profil-isi">
          <div className="menu-profil-kepala">
            <Avatar nama={profil.nama} foto={profil.foto_url} ukuran={42} />
            <div>
              <b>{profil.nama}</b>
              <span>{LABEL_PERAN[profil.peran] || profil.peran}</span>
              {profil.wilayah && <span>{profil.wilayah}</span>}
            </div>
          </div>
          <a href="/admin">Dasbor Pengelola</a>
          <a href="/simulasi">Simulasi</a>
          <a href="/verifikasi">Isi Verifikasi</a>
          <a href="/profil">Ubah Profil</a>
          <button onClick={async () => {
            await supabase.auth.signOut();
            location.href = "/";
          }}>Keluar</button>
        </div>
      )}
    </div>
  );
}
