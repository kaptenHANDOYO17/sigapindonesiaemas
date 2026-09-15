"use client";

import { useState } from "react";

export default function Berhenti() {
  const [nomor, setNomor] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [kabar, setKabar] = useState(null);

  async function kirim() {
    setKabar(null);
    setMengirim(true);
    try {
      const r = await fetch("/api/berhenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomor }),
      });
      const d = await r.json();
      setKabar({ jenis: d.ok ? "baik" : "buruk", teks: d.pesan });
    } catch {
      setKabar({ jenis: "buruk", teks: "Tidak dapat menghubungi server." });
    } finally {
      setMengirim(false);
    }
  }

  return (
    <main>
      <section className="panel" style={{ maxWidth: 620, margin: "0 auto" }}>
        <h2>Berhenti Menerima Peringatan</h2>
        <p className="panel-ket">
          Masukkan nomor yang ingin dihentikan. Tidak ada pertanyaan lanjutan dan tidak ada
          langkah tambahan.
        </p>

        <div className="formulir">
          <div className="baris">
            <label htmlFor="nomor">Nomor WhatsApp</label>
            <input id="nomor" inputMode="numeric" value={nomor}
                   onChange={(e) => setNomor(e.target.value)} placeholder="08.........." />
          </div>

          {kabar && (
            <div className={`kabar kabar-${kabar.jenis === "baik" ? "baik" : "buruk"}`}>
              {kabar.teks}
            </div>
          )}

          <div>
            <button className="tombol" onClick={kirim} disabled={mengirim || !nomor.trim()}>
              {mengirim ? "Memproses…" : "Berhenti berlangganan"}
            </button>
          </div>
        </div>

        <p style={{ fontSize: ".84rem", color: "var(--redup)", marginTop: 20 }}>
          Bila Anda mendaftar lewat Telegram, cukup ketik <code>/berhenti</code> pada bot.
          Anda dapat <a href="/daftar">mendaftar kembali</a> kapan saja.
        </p>
      </section>
    </main>
  );
}
