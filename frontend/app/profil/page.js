"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, belumDikonfigurasi, ambilProfil, LABEL_PERAN } from "../../lib/supabase";
import Avatar from "../../components/Avatar";

const MAKS_BERKAS = 2 * 1024 * 1024;          // 2 MB
const JENIS_BOLEH = ["image/jpeg", "image/png", "image/webp"];

export default function Profil() {
  const [profil, setProfil] = useState(null);
  const [memeriksa, setMemeriksa] = useState(true);
  const [isian, setIsian] = useState({ nama: "", jabatan: "", wilayah: "", nomor_kontak: "" });
  const [foto, setFoto] = useState(null);
  const [pratinjau, setPratinjau] = useState(null);
  const [berkas, setBerkas] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState(null);
  const pemilih = useRef(null);

  useEffect(() => {
    if (belumDikonfigurasi) { setMemeriksa(false); return; }
    ambilProfil().then((p) => {
      if (p) {
        setProfil(p);
        setIsian({
          nama: p.nama || "", jabatan: p.jabatan || "",
          wilayah: p.wilayah || "", nomor_kontak: p.nomor_kontak || "",
        });
        setFoto(p.foto_url || null);
      }
      setMemeriksa(false);
    });
  }, []);

  function pilihBerkas(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setKabar(null);

    if (!JENIS_BOLEH.includes(f.type)) {
      return setKabar({ jenis: "buruk", teks: "Format harus JPG, PNG, atau WEBP." });
    }
    if (f.size > MAKS_BERKAS) {
      return setKabar({
        jenis: "buruk",
        teks: `Ukuran berkas ${(f.size / 1024 / 1024).toFixed(1)} MB, melebihi batas 2 MB. ` +
              "Kecilkan dulu fotonya.",
      });
    }
    setBerkas(f);
    setPratinjau(URL.createObjectURL(f));
  }

  async function simpan() {
    setKabar(null);
    if (!isian.nama.trim()) {
      return setKabar({ jenis: "buruk", teks: "Nama tidak boleh kosong." });
    }
    setSibuk(true);

    try {
      let urlFoto = foto;

      // Unggah foto lebih dulu, bila ada yang dipilih.
      if (berkas) {
        const akhiran = berkas.name.split(".").pop().toLowerCase();
        // Nama berkas memakai user id sebagai nama folder, karena policy di
        // basis data hanya mengizinkan seseorang menyentuh foldernya sendiri.
        const jalur = `${profil.user_id}/foto.${akhiran}`;

        const { error: galatUnggah } = await supabase.storage
          .from("avatar")
          .upload(jalur, berkas, { upsert: true, cacheControl: "3600" });

        if (galatUnggah) throw new Error("Foto gagal diunggah: " + galatUnggah.message);

        const { data } = supabase.storage.from("avatar").getPublicUrl(jalur);
        // Tambahan penanda waktu memaksa peramban memuat foto baru, bukan
        // menampilkan foto lama yang tersimpan di singgahan.
        urlFoto = `${data.publicUrl}?v=${Date.now()}`;
      }

      const { error } = await supabase.from("profil_admin").update({
        nama: isian.nama.trim(),
        jabatan: isian.jabatan.trim() || null,
        wilayah: isian.wilayah.trim() || null,
        nomor_kontak: isian.nomor_kontak.trim() || null,
        foto_url: urlFoto,
        diperbarui_pada: new Date().toISOString(),
      }).eq("user_id", profil.user_id);

      if (error) throw new Error(error.message);

      setFoto(urlFoto);
      setBerkas(null);
      setPratinjau(null);
      setProfil((p) => ({ ...p, ...isian, foto_url: urlFoto }));
      setKabar({ jenis: "baik", teks: "Profil tersimpan." });
    } catch (e) {
      setKabar({ jenis: "buruk", teks: e.message });
    } finally {
      setSibuk(false);
    }
  }

  async function hapusFoto() {
    setSibuk(true);
    setKabar(null);
    try {
      const { data: daftar } = await supabase.storage.from("avatar").list(profil.user_id);
      if (daftar?.length) {
        await supabase.storage.from("avatar")
          .remove(daftar.map((f) => `${profil.user_id}/${f.name}`));
      }
      await supabase.from("profil_admin")
        .update({ foto_url: null, diperbarui_pada: new Date().toISOString() })
        .eq("user_id", profil.user_id);
      setFoto(null); setPratinjau(null); setBerkas(null);
      setProfil((p) => ({ ...p, foto_url: null }));
      setKabar({ jenis: "baik", teks: "Foto dihapus." });
    } catch (e) {
      setKabar({ jenis: "buruk", teks: e.message });
    } finally {
      setSibuk(false);
    }
  }

  async function gantiSandi() {
    const baru = prompt("Kata sandi baru (minimal 8 karakter):");
    if (!baru) return;
    if (baru.length < 8) {
      return setKabar({ jenis: "buruk", teks: "Kata sandi minimal 8 karakter." });
    }
    setSibuk(true);
    const { error } = await supabase.auth.updateUser({ password: baru });
    setKabar(error
      ? { jenis: "buruk", teks: error.message }
      : { jenis: "baik", teks: "Kata sandi berhasil diganti." });
    setSibuk(false);
  }

  if (memeriksa) {
    return <main><section className="panel"><p className="panel-ket">Memeriksa sesi…</p></section></main>;
  }

  if (!profil) {
    return (
      <main>
        <section className="panel" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h2>Perlu masuk lebih dulu</h2>
          <p className="panel-ket">Halaman profil hanya untuk pengelola yang sudah masuk.</p>
          <a className="tombol" href="/masuk">Masuk</a>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="panel" style={{ maxWidth: 700, margin: "0 auto" }}>
        <h2>Profil Saya</h2>
        <p className="panel-ket">
          Nama dan foto di sini tampil pada catatan verifikasi lapangan serta pada laporan
          warga yang Anda tangani, sehingga rekan lain tahu siapa yang mengerjakan apa.
        </p>

        {/* ------------------------------ foto ------------------------------ */}
        <div className="profil-foto">
          <Avatar nama={isian.nama || profil.nama} foto={pratinjau || foto} ukuran={96} />
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="tombol tombol-halus" onClick={() => pemilih.current?.click()}
                      disabled={sibuk}>
                {foto || pratinjau ? "Ganti foto" : "Unggah foto"}
              </button>
              {(foto || pratinjau) && (
                <button className="tombol tombol-halus" onClick={hapusFoto} disabled={sibuk}>
                  Hapus foto
                </button>
              )}
            </div>
            <input ref={pemilih} type="file" accept="image/jpeg,image/png,image/webp"
                   onChange={pilihBerkas} style={{ display: "none" }} />
            <small>
              JPG, PNG, atau WEBP. Paling besar 2 MB. Foto berbentuk persegi akan terlihat
              paling rapi.
              {berkas && <><br /><b>Foto baru dipilih. Tekan Simpan agar tersimpan.</b></>}
            </small>
          </div>
        </div>

        {/* ----------------------------- isian ----------------------------- */}
        <div className="formulir" style={{ marginTop: 22 }}>
          <div className="baris">
            <label htmlFor="nama">Nama lengkap *</label>
            <input id="nama" value={isian.nama}
                   onChange={(e) => setIsian((s) => ({ ...s, nama: e.target.value }))} />
          </div>

          <div className="dua">
            <div className="baris">
              <label htmlFor="jabatan">Jabatan</label>
              <small>Contoh: Ketua Tim, Kader RW 01, Staf BPBD.</small>
              <input id="jabatan" value={isian.jabatan}
                     onChange={(e) => setIsian((s) => ({ ...s, jabatan: e.target.value }))} />
            </div>
            <div className="baris">
              <label htmlFor="wilayah">Wilayah</label>
              <small>RT atau RW yang Anda dampingi.</small>
              <input id="wilayah" value={isian.wilayah}
                     onChange={(e) => setIsian((s) => ({ ...s, wilayah: e.target.value }))} />
            </div>
          </div>

          <div className="baris">
            <label htmlFor="kontak">Nomor yang bisa dihubungi</label>
            <small>Hanya terlihat oleh sesama pengelola, tidak ditampilkan kepada warga.</small>
            <input id="kontak" value={isian.nomor_kontak}
                   onChange={(e) => setIsian((s) => ({ ...s, nomor_kontak: e.target.value }))} />
          </div>

          {kabar && (
            <div className={`kabar kabar-${kabar.jenis === "baik" ? "baik" : "buruk"}`}>
              {kabar.teks}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="tombol" onClick={simpan} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan perubahan"}
            </button>
            <button className="tombol tombol-halus" onClick={gantiSandi} disabled={sibuk}>
              Ganti kata sandi
            </button>
          </div>
        </div>

        {/* ------------------------- tidak bisa diubah ---------------------- */}
        <div style={{ marginTop: 26, borderTop: "1px solid var(--tepi)", paddingTop: 18 }}>
          <h2 style={{ fontSize: ".95rem" }}>Yang tidak dapat Anda ubah sendiri</h2>
          <table className="tabel" style={{ marginTop: 10 }}>
            <tbody>
              <tr><td style={{ width: 170 }}>Surel</td><td>{profil.email}</td></tr>
              <tr><td>Peran</td><td>{LABEL_PERAN[profil.peran] || profil.peran}</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: ".82rem", color: "var(--redup)", marginTop: 12, lineHeight: 1.65 }}>
            Peran hanya dapat diubah oleh administrator. Pembatasan ini disengaja: bila setiap
            orang bisa menaikkan perannya sendiri, seorang kader dapat menjadikan dirinya
            administrator lalu membuka seluruh nomor warga.
          </p>
        </div>
      </section>
    </main>
  );
}
