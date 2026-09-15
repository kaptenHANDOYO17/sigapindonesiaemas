"use client";

import { useState } from "react";
import { periksaNomor } from "../../lib/nomor";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT;

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
    return (
      <main>
        <section className="panel" style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2>Pendaftaran tersimpan</h2>
          <div className="kabar kabar-baik" style={{ marginTop: 12 }}>{hasil.pesan}</div>

          {hasil.status === "menunggu" && (
            <>
              <p className="panel-ket" style={{ marginTop: 18 }}>
                Selama menunggu konfirmasi, nomor Anda belum menerima peringatan. Ada dua cara
                mempercepatnya.
              </p>
              <ol className="tindakan">
                <li>
                  <b>Daftar lewat Telegram.</b> Di sana Anda sendiri yang memulai percakapan,
                  sehingga nomor langsung aktif tanpa menunggu siapa pun.
                </li>
                <li>
                  <b>Tunggu kunjungan kader.</b> Kader siaga drainase berkunjung dua minggu sekali
                  dan dapat mengaktifkan pendaftaran Anda di tempat.
                </li>
              </ol>
              {BOT && (
                <a className="tombol" style={{ marginTop: 14 }}
                   href={`https://t.me/${BOT}?start=warga`} target="_blank" rel="noopener noreferrer">
                  Aktifkan sekarang lewat Telegram
                </a>
              )}
            </>
          )}

          <p style={{ fontSize: ".84rem", color: "var(--redup)", marginTop: 22 }}>
            Anda dapat berhenti menerima peringatan kapan saja melalui halaman{" "}
            <a href="/berhenti">berhenti berlangganan</a>.
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
          Isi nomor Anda untuk menerima peringatan ketika saluran drainase di Mangunharjo mulai
          tersumbat. Gratis, dan dapat dihentikan kapan saja.
        </p>

        <div className="kabar kabar-info" style={{ marginBottom: 22 }}>
          Sistem hanya menghubungi Anda ketika kondisi saluran berstatus Waspada, Siaga, atau
          Kritis. Saat kondisi aman, tidak ada pesan yang dikirim sama sekali.
        </div>

        <div className="formulir">
          <div className="baris">
            <label htmlFor="nama">Nama *</label>
            <input id="nama" value={isian.nama} onChange={ubah("nama")}
                   placeholder="Nama panggilan pun cukup" />
          </div>

          <div className="dua">
            <div className="baris">
              <label htmlFor="nomor">Nomor WhatsApp *</label>
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

        <h2 style={{ fontSize: ".98rem" }}>Ingin langsung aktif?</h2>
        <p className="panel-ket">
          Pendaftaran lewat formulir ini menunggu konfirmasi kader lebih dulu, karena siapa pun bisa
          mengetikkan nomor orang lain di sini. Lewat Telegram, Andalah yang memulai percakapan,
          sehingga nomor langsung aktif.
        </p>
        {BOT ? (
          <a className="tombol tombol-halus" href={`https://t.me/${BOT}?start=warga`}
             target="_blank" rel="noopener noreferrer">
            Daftar lewat Telegram
          </a>
        ) : (
          <p className="panel-ket">Tautan bot Telegram belum diatur oleh pengelola.</p>
        )}
      </section>
    </main>
  );
}
