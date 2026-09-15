"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, belumDikonfigurasi, ambilProfil, LABEL_PERAN } from "../../lib/supabase";

export default function Masuk() {
  const router = useRouter();
  const [surel, setSurel] = useState("");
  const [sandi, setSandi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState(null);
  const [profil, setProfil] = useState(null);
  const [memeriksa, setMemeriksa] = useState(true);

  useEffect(() => {
    if (belumDikonfigurasi) { setMemeriksa(false); return; }
    ambilProfil().then((p) => { setProfil(p); setMemeriksa(false); });
  }, []);

  async function masuk() {
    setGalat(null);
    setSibuk(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: surel.trim(), password: sandi,
    });
    if (error) {
      setGalat("Surel atau kata sandi tidak cocok.");
      setSibuk(false);
      return;
    }
    const p = await ambilProfil();
    if (!p) {
      await supabase.auth.signOut();
      setGalat(
        "Akun ini berhasil masuk, tetapi belum terdaftar sebagai pengelola. " +
        "Hubungi administrator untuk didaftarkan pada tabel profil_admin."
      );
      setSibuk(false);
      return;
    }
    router.push("/admin");
  }

  async function keluar() {
    await supabase.auth.signOut();
    setProfil(null);
  }

  if (memeriksa) {
    return <main><section className="panel" style={{ maxWidth: 440, margin: "0 auto" }}>
      <p className="panel-ket">Memeriksa sesi…</p></section></main>;
  }

  if (belumDikonfigurasi) {
    return <main><section className="panel" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h2>Masuk Pengelola</h2>
      <div className="kabar kabar-buruk" style={{ marginTop: 12 }}>
        Situs belum tersambung ke basis data. Isi NEXT_PUBLIC_SUPABASE_URL dan
        NEXT_PUBLIC_SUPABASE_ANON_KEY pada Environment Variables.
      </div></section></main>;
  }

  if (profil) {
    return (
      <main>
        <section className="panel" style={{ maxWidth: 480, margin: "0 auto" }}>
          <h2>Anda sudah masuk</h2>
          <p className="panel-ket">
            {profil.nama} &middot; {LABEL_PERAN[profil.peran] || profil.peran}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
            <a className="tombol" href="/admin">Buka dasbor pengelola</a>
            <button className="tombol tombol-halus" onClick={keluar}>Keluar</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="panel" style={{ maxWidth: 460, margin: "0 auto" }}>
        <h2>Masuk Pengelola</h2>
        <p className="panel-ket">
          Halaman ini untuk kader siaga drainase, petugas BPBD, dan perangkat kelurahan.
          Warga tidak perlu masuk untuk melihat dasbor atau mengirim laporan.
        </p>

        <div className="formulir">
          <div className="baris">
            <label htmlFor="surel">Surel</label>
            <input id="surel" type="email" autoComplete="username"
                   value={surel} onChange={(e) => setSurel(e.target.value)} />
          </div>
          <div className="baris">
            <label htmlFor="sandi">Kata sandi</label>
            <input id="sandi" type="password" autoComplete="current-password"
                   value={sandi} onChange={(e) => setSandi(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && masuk()} />
          </div>

          {galat && <div className="kabar kabar-buruk">{galat}</div>}

          <div>
            <button className="tombol" onClick={masuk} disabled={sibuk || !surel || !sandi}>
              {sibuk ? "Memeriksa…" : "Masuk"}
            </button>
          </div>
        </div>

        <p style={{ fontSize: ".82rem", color: "var(--redup)", marginTop: 20 }}>
          Akun dibuat oleh administrator melalui Supabase, bukan melalui halaman ini.
          Pendaftaran mandiri sengaja tidak dibuka, karena halaman pengelola memuat
          nomor kontak warga.
        </p>
      </section>
    </main>
  );
}
