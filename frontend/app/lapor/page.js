"use client";

import { useState } from "react";

const JENIS = [
  ["sampah", "Sampah menumpuk di saluran"],
  ["genangan", "Genangan air di jalan atau halaman"],
  ["sumbatan", "Saluran tersumbat benda besar"],
  ["perangkat", "Alat pemantau rusak atau hilang"],
  ["lainnya", "Lainnya"],
];

export default function Lapor() {
  const [isian, setIsian] = useState({
    jenis: "sampah", wilayah: "", isi: "", nama: "", kontak: "",
  });
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState(null);

  const ubah = (k) => (e) => setIsian((s) => ({ ...s, [k]: e.target.value }));

  async function kirim() {
    setGalat(null);
    if (isian.isi.trim().length < 10) {
      return setGalat("Tuliskan laporan sedikit lebih rinci, minimal sepuluh huruf.");
    }
    setMengirim(true);
    try {
      const r = await fetch("/api/lapor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isian),
      });
      const d = await r.json();
      if (!d.ok) setGalat(d.pesan);
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
        <section className="panel" style={{ maxWidth: 620, margin: "0 auto" }}>
          <h2>Laporan terkirim</h2>
          <div className="kabar kabar-baik" style={{ marginTop: 12 }}>
            {hasil.pesan} Nomor laporan Anda: <b>#{hasil.nomor}</b>.
          </div>
          <p className="panel-ket" style={{ marginTop: 18 }}>
            Simpan nomor itu bila Anda ingin menanyakan tindak lanjutnya kepada pengurus RT
            atau kader siaga drainase.
          </p>
          <a className="tombol" href="/">Kembali ke dasbor</a>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="panel" style={{ maxWidth: 680, margin: "0 auto" }}>
        <h2>Laporkan Kondisi Saluran</h2>
        <p className="panel-ket">
          Sensor hanya memantau satu titik, sedangkan sumbatan bisa berada puluhan meter
          darinya. Laporan Anda melengkapi apa yang tidak terlihat oleh alat.
        </p>

        <div className="formulir">
          <div className="baris">
            <label htmlFor="jenis">Jenis laporan</label>
            <select id="jenis" value={isian.jenis} onChange={ubah("jenis")}>
              {JENIS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
            </select>
          </div>

          <div className="baris">
            <label htmlFor="wilayah">Lokasi (RT / RW atau nama jalan)</label>
            <input id="wilayah" value={isian.wilayah} onChange={ubah("wilayah")}
                   placeholder="contoh: RT 03 / RW 01, dekat musala" />
          </div>

          <div className="baris">
            <label htmlFor="isi">Apa yang Anda lihat? *</label>
            <small>Sebutkan juga sejak kapan, bila Anda tahu.</small>
            <textarea id="isi" value={isian.isi} onChange={ubah("isi")}
                      placeholder="contoh: ada kasur bekas menyumbat saluran depan rumah, sudah dua hari air tidak mengalir" />
          </div>

          <div className="dua">
            <div className="baris">
              <label htmlFor="nama">Nama (boleh dikosongkan)</label>
              <input id="nama" value={isian.nama} onChange={ubah("nama")} />
            </div>
            <div className="baris">
              <label htmlFor="kontak">Nomor yang bisa dihubungi (boleh dikosongkan)</label>
              <input id="kontak" value={isian.kontak} onChange={ubah("kontak")} />
            </div>
          </div>

          <div className="kabar kabar-info">
            Laporan boleh anonim. Nama dan nomor hanya dipakai bila petugas perlu menanyakan
            letak persisnya, dan tidak ditampilkan kepada umum.
          </div>

          {galat && <div className="kabar kabar-buruk">{galat}</div>}

          <div>
            <button className="tombol" onClick={kirim} disabled={mengirim}>
              {mengirim ? "Mengirim…" : "Kirim laporan"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
