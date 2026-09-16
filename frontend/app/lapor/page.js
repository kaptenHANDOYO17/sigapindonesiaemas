"use client";

import { useRef, useState } from "react";

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

  const [lokasi, setLokasi] = useState(null);
  const [mencariLokasi, setMencariLokasi] = useState(false);
  const [berkas, setBerkas] = useState(null);
  const [pratinjau, setPratinjau] = useState(null);
  const [mengunggah, setMengunggah] = useState(false);
  const pemilih = useRef(null);

  function ambilLokasi() {
    setGalat(null);
    if (!navigator.geolocation) {
      return setGalat("Peramban Anda tidak mendukung berbagi lokasi.");
    }
    setMencariLokasi(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLokasi({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          akurasi: p.coords.accuracy,
        });
        setMencariLokasi(false);
      },
      (e) => {
        setMencariLokasi(false);
        setGalat(
          e.code === 1
            ? "Izin lokasi ditolak. Anda tetap bisa mengirim laporan; tuliskan saja letaknya " +
              "pada kolom lokasi."
            : "Lokasi tidak dapat diambil. Pastikan GPS menyala, lalu coba lagi."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function pilihBerkas(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setGalat(null);
    if (f.size > 15 * 1024 * 1024) {
      return setGalat(
        `Ukuran berkas ${(f.size / 1024 / 1024).toFixed(1)} MB, melebihi batas 15 MB. ` +
        "Untuk video, rekam lebih pendek."
      );
    }
    setBerkas(f);
    setPratinjau({ url: URL.createObjectURL(f), video: f.type.startsWith("video/") });
  }

  const ubah = (k) => (e) => setIsian((s) => ({ ...s, [k]: e.target.value }));

  async function kirim() {
    setGalat(null);
    if (isian.isi.trim().length < 10) {
      return setGalat("Tuliskan laporan sedikit lebih rinci, minimal sepuluh huruf.");
    }
    setMengirim(true);
    try {
      // Unggah media lebih dulu, karena laporan menyimpan tautannya.
      let media = null;
      if (berkas) {
        setMengunggah(true);
        const fd = new FormData();
        fd.append("berkas", berkas);
        const ru = await fetch("/api/unggah", { method: "POST", body: fd });
        const du = await ru.json();
        setMengunggah(false);
        if (!du.ok) {
          setMengirim(false);
          return setGalat(du.pesan);
        }
        media = du;
      }

      const r = await fetch("/api/lapor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...isian,
          lat: lokasi?.lat ?? null,
          lon: lokasi?.lon ?? null,
          akurasi: lokasi?.akurasi ?? null,
          media_url: media?.url ?? null,
          media_jenis: media?.jenis ?? null,
        }),
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

          <div className="baris">
            <label>Bagikan lokasi Anda (boleh dilewati)</label>
            <small>
              Titik koordinat memudahkan petugas menemukan tempatnya, terutama di gang yang
              tidak punya nama jalan.
            </small>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <button type="button" className="tombol tombol-halus"
                      onClick={ambilLokasi} disabled={mencariLokasi}>
                {mencariLokasi ? "Mencari lokasi…" : lokasi ? "Ambil ulang lokasi" : "Bagikan lokasi saya"}
              </button>
              {lokasi && (
                <a className="tombol tombol-halus"
                   href={`https://www.google.com/maps?q=${lokasi.lat},${lokasi.lon}`}
                   target="_blank" rel="noopener noreferrer">Lihat di peta</a>
              )}
            </div>
            {lokasi && (
              <div className="kabar kabar-baik" style={{ marginTop: 10 }}>
                Lokasi tersimpan: {lokasi.lat.toFixed(6)}, {lokasi.lon.toFixed(6)}
                {lokasi.akurasi ? ` (perkiraan ketelitian ${Math.round(lokasi.akurasi)} meter)` : ""}
              </div>
            )}
          </div>

          <div className="baris">
            <label>Foto atau video (boleh dilewati)</label>
            <small>
              JPG, PNG, WEBP, MP4, MOV, atau WEBM. Paling besar 15 MB. Satu foto jelas biasanya
              lebih menolong daripada video panjang.
            </small>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <button type="button" className="tombol tombol-halus"
                      onClick={() => pemilih.current?.click()}>
                {berkas ? "Ganti berkas" : "Pilih foto atau video"}
              </button>
              {berkas && (
                <button type="button" className="tombol tombol-halus"
                        onClick={() => { setBerkas(null); setPratinjau(null); }}>
                  Hapus
                </button>
              )}
            </div>
            <input ref={pemilih} type="file" style={{ display: "none" }}
                   accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                   capture="environment" onChange={pilihBerkas} />
            {pratinjau && (
              <div className="pratinjau-media">
                {pratinjau.video
                  ? <video src={pratinjau.url} controls />
                  : <img src={pratinjau.url} alt="pratinjau" />}
                <span>{berkas.name} · {(berkas.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            )}
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
            Laporan boleh anonim. Nama, nomor, dan titik lokasi hanya dipakai petugas untuk
            menemukan tempatnya, dan tidak ditampilkan kepada umum. Foto atau video yang Anda
            unggah dapat diakses melalui tautannya, jadi hindari memotret wajah orang atau
            bagian dalam rumah.
          </div>

          {galat && <div className="kabar kabar-buruk">{galat}</div>}

          <div>
            <button className="tombol" onClick={kirim} disabled={mengirim}>
              {mengunggah ? "Mengunggah berkas…" : mengirim ? "Mengirim…" : "Kirim laporan"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
