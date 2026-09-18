"use client";

import { useState } from "react";
import { periksaNomor } from "../../lib/nomor";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT;
const WA_PENGELOLA = process.env.NEXT_PUBLIC_WA_PENGELOLA;

export default function Daftar() {
  const [isian, setIsian] = useState({ nama: "", nomor: "", wilayah: "", persetujuan: false });
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState(null);

  const ubah = (k) => (e) =>
    setIsian((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function kirim() {
    setGalat(null);
    const cek = periksaNomor(isian.nomor);
    if (!isian.nama.trim()) return setGalat("Nama belum diisi.");
    if (!cek.sah) return setGalat(cek.pesan);
    if (!isian.persetujuan) return setGalat("Centang dulu pernyataan persetujuan di bawah.");

    setMengirim(true);
    try {
      const r = await fetch("/api/daftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isian),
      });
      const d = await r.json();
      if (!d.ok) setGalat(d.pesan || "Pendaftaran gagal.");
      else setHasil(d);
    } catch {
      setGalat("Tidak dapat menghubungi server. Periksa sambungan internet Anda.");
    } finally {
      setMengirim(false);
    }
  }

  if (hasil) {
    const tautanBot = BOT && hasil.kode
      ? `https://t.me/${BOT}?start=${hasil.kode}`
      : BOT ? `https://t.me/${BOT}?start=warga` : null;

    return (
      <main>
        <section className="panel" style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2>Pendaftaran tersimpan</h2>
          <div className="kabar kabar-baik" style={{ marginTop: 12 }}>
            Nama dan nomor Anda sudah tercatat. Tinggal satu langkah lagi.
          </div>

          <div className="langkah-akhir">
            <h3>Sambungkan dengan bot Telegram</h3>
            <p>
              Peringatan dikirim lewat Telegram. Bot tidak dapat menghubungi siapa pun
              hanya berbekal nomor telepon; Telegram baru mengizinkannya setelah Anda
              sendiri membuka percakapan. Jadi tekan tombol di bawah sekali saja, lalu
              tekan <b>START</b> di Telegram.
            </p>
            {tautanBot ? (
              <a className="tombol" href={tautanBot} target="_blank" rel="noopener noreferrer">
                Buka bot Telegram sekarang
              </a>
            ) : (
              <p className="panel-ket" style={{ marginBottom: 0 }}>
                Tautan bot belum diatur pengelola. Hubungi kader di lingkungan Anda.
              </p>
            )}
            {hasil.kode && (
              <div className="kotak-kode" style={{ marginTop: 16 }}>
                <span>Kode pendaftaran Anda</span>
                <b>{hasil.kode}</b>
              </div>
            )}
            <small>
              Tanpa langkah ini, nama Anda tetap tercatat di daftar warga, tetapi pesan
              peringatan tidak akan sampai ke ponsel Anda.
            </small>
          </div>

          <p style={{ fontSize: ".84rem", color: "var(--redup)", marginTop: 22 }}>
            Anda dapat berhenti menerima peringatan kapan saja melalui halaman{" "}
            <a href="/berhenti">berhenti berlangganan</a>, tanpa syarat apa pun.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="panel" style={{ maxWidth: 680, margin: "0 auto" }}>
        <h2>Daftar Menerima Peringatan</h2>
        <p className="panel-ket">
          Isi nama dan nomor Anda untuk menerima peringatan ketika saluran drainase di
          Meteseh mulai tersumbat. Gratis, dan dapat dihentikan kapan saja. Setelah ini
          Anda tinggal menekan satu tombol untuk menyambungkannya ke Telegram.
        </p>

        <div className="kabar kabar-info" style={{ marginBottom: 22 }}>
          Sistem hanya menghubungi Anda ketika kondisi saluran berstatus Waspada, Siaga, atau
          Kritis. Saat kondisi aman, tidak ada pesan yang dikirim sama sekali.
        </div>

        <div className="formulir">
          <div className="baris">
            <label htmlFor="nama">Nama lengkap *</label>
            <input id="nama" value={isian.nama} onChange={ubah("nama")}
                   placeholder="Nama sesuai KTP" />
          </div>

          <div className="dua">
            <div className="baris">
              <label htmlFor="nomor">Nomor HP *</label>
              <small>Contoh: 0812xxxxxxx</small>
              <input id="nomor" inputMode="numeric" value={isian.nomor}
                     onChange={ubah("nomor")} placeholder="08.........." />
            </div>
            <div className="baris">
              <label htmlFor="wilayah">RT / RW</label>
              <small>Membantu kader menemukan Anda.</small>
              <input id="wilayah" value={isian.wilayah} onChange={ubah("wilayah")}
                     placeholder="contoh: RT 03 / RW 01" />
            </div>
          </div>

          <div className="baris">
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontWeight: 400 }}>
              <input type="checkbox" checked={isian.persetujuan} onChange={ubah("persetujuan")}
                     style={{ width: 17, height: 17, marginTop: 3, flex: "none" }} />
              <span style={{ fontSize: ".9rem" }}>
                Saya mendaftarkan nomor milik saya sendiri, dan bersedia menerima pesan peringatan
                dari SIGAP Drainase. Nomor saya tidak akan dipakai untuk keperluan lain dan tidak
                dibagikan kepada pihak mana pun.
              </span>
            </label>
          </div>

          {galat && <div className="kabar kabar-buruk">{galat}</div>}

          <div>
            <button className="tombol" onClick={kirim} disabled={mengirim}>
              {mengirim ? "Menyimpan…" : "Daftar"}
            </button>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: "1px solid var(--tepi)", margin: "26px 0 20px" }} />

        <h2 style={{ fontSize: ".98rem" }}>Sudah punya Telegram?</h2>
        <p className="panel-ket">
          Anda boleh langsung membuka botnya tanpa mengisi formulir ini. Hasilnya sama.
        </p>
        {BOT ? (
          <a className="tombol tombol-halus" href={`https://t.me/${BOT}?start=warga`}
             target="_blank" rel="noopener noreferrer">
            Langsung ke bot Telegram
          </a>
        ) : (
          <p className="panel-ket">Tautan bot Telegram belum diatur oleh pengelola.</p>
        )}
      </section>
    </main>
  );
}
