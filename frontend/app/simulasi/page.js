"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, belumDikonfigurasi, ambilProfil, STATUS, LABEL_PERAN } from "../../lib/supabase";
import { nilaiStatus, estimasiVolume, AMBANG } from "../../lib/aturan";
import Penampang from "../../components/Penampang";

const KEDALAMAN = 800;   // milimeter, sesuai geometri contoh

export default function Simulasi() {
  const [profil, setProfil] = useState(null);
  const [memeriksa, setMemeriksa] = useState(true);

  const [endapan, setEndapan] = useState(20);      // persen kedalaman
  const [debit, setDebit] = useState(85);          // persen dari debit rancangan
  const [air, setAir] = useState(35);              // persen kedalaman
  const [lajuNaik, setLajuNaik] = useState(0);     // mm per menit
  const [lonjakan, setLonjakan] = useState(0);     // kelipatan laju wajar

  const [sasaran, setSasaran] = useState("petugas");
  const [mengirim, setMengirim] = useState(false);
  const [kabar, setKabar] = useState(null);
  const [minta, setMinta] = useState(false);
  const [tampilan, setTampilan] = useState("3d");   // "3d" atau "penampang"
  const [siap3d, setSiap3d] = useState(false);
  const bingkai = useRef(null);

  useEffect(() => {
    if (belumDikonfigurasi) { setMemeriksa(false); return; }
    ambilProfil().then((p) => { setProfil(p); setMemeriksa(false); });
  }, []);

  // Dengarkan kabar dari bingkai 3D bahwa ia sudah siap menerima nilai.
  useEffect(() => {
    function dengar(e) {
      if (e.data?.jenis === "sigap-3d-siap") setSiap3d(true);
    }
    addEventListener("message", dengar);
    return () => removeEventListener("message", dengar);
  }, []);

  // Kirim nilai pengatur ke bingkai setiap kali berubah.
  //
  // Penilaian status TIDAK ikut dikirim. Bingkai hanya menggambar bentuknya;
  // status tetap dihitung di halaman ini memakai satu mesin aturan, supaya
  // tidak pernah ada dua jawaban berbeda untuk angka yang sama.
  useEffect(() => {
    if (!siap3d || !bingkai.current) return;
    bingkai.current.contentWindow?.postMessage({
      jenis: "sigap-3d", endapan, air, debit,
    }, "*");
  }, [siap3d, endapan, air, debit]);

  const hasil = useMemo(() => {
    const r = nilaiStatus({
      rEndapan: endapan / 100, rDebit: debit / 100, rAir: air / 100,
      lajuNaik, lonjakanDasar: lonjakan,
    });
    return { ...r, volume: estimasiVolume(endapan / 100) };
  }, [endapan, debit, air, lajuNaik, lonjakan]);

  async function kirim() {
    setKabar(null);
    setMengirim(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/simulasi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          sasaran,
          hasil: {
            saluran_id: "MGH-01",
            status: hasil.status,
            alasan: hasil.alasan,
            rasio_endapan: endapan / 100,
            rasio_debit: debit / 100,
            rasio_air: air / 100,
            volume: hasil.volume,
          },
        }),
      });
      const d = await r.json();
      setKabar({ jenis: d.ok ? "baik" : "buruk", teks: d.pesan });
    } catch {
      setKabar({ jenis: "buruk", teks: "Tidak dapat menghubungi server." });
    } finally {
      setMengirim(false);
      setMinta(false);
    }
  }

  if (memeriksa) {
    return <main><section className="panel"><p className="panel-ket">Memeriksa sesi…</p></section></main>;
  }

  if (!profil) {
    return (
      <main>
        <section className="panel" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2>Halaman simulasi tertutup untuk umum</h2>
          <p className="panel-ket">
            Halaman ini dapat mengirim pesan sungguhan ke nomor warga yang terdaftar, sehingga
            hanya boleh dibuka kader, petugas BPBD, atau perangkat kelurahan yang sudah masuk.
          </p>
          <a className="tombol" href="/masuk">Masuk sebagai pengelola</a>
        </section>
      </main>
    );
  }

  const warna = STATUS[hasil.status]?.warna;
  const berbahaya = hasil.status !== "AMAN";

  return (
    <main>
      <section className="panel">
        <h2>Simulasi Penilaian Status</h2>
        <p className="panel-ket" style={{ maxWidth: "80ch" }}>
          Geser ketiga pengatur di bawah untuk melihat bagaimana sistem menilai kondisi saluran.
          Perhitungannya memakai matriks aturan yang sama persis dengan yang berjalan di lapangan,
          bukan tiruan yang disederhanakan.
        </p>
        <p className="panel-ket" style={{ marginBottom: 0 }}>
          {profil.nama} &middot; {LABEL_PERAN[profil.peran] || profil.peran}
        </p>
      </section>

      <div className="susun-dua">
        {/* ---------------------------- pengatur ---------------------------- */}
        <section className="panel">
          <h2>Pengatur</h2>

          <Geser label="Tinggi endapan" nilai={endapan} set={setEndapan}
                 satuan="% kedalaman" maks={90}
                 ket={`${Math.round(endapan / 100 * KEDALAMAN)} mm dari ${KEDALAMAN} mm. ` +
                      `Ambang: tinggi ${AMBANG.endapanTinggi * 100}%, sangat tinggi ${AMBANG.endapanSangatTinggi * 100}%.`} />

          <Geser label="Debit aliran" nilai={debit} set={setDebit}
                 satuan="% dari seharusnya" maks={120}
                 ket={`Dibandingkan debit yang wajar untuk curah hujan saat itu. ` +
                      `Ambang: menurun di bawah ${AMBANG.debitMenurun * 100}%, sangat rendah di bawah ${AMBANG.debitSangatRendah * 100}%.`} />

          <Geser label="Muka air" nilai={air} set={setAir}
                 satuan="% kedalaman" maks={100}
                 ket={`Di atas ${AMBANG.airMeluap * 100}% dinilai Kritis, karena air sudah mendekati bibir saluran.`} />

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: ".86rem", color: "var(--redup)" }}>
              Pemicu lanjutan
            </summary>
            <div style={{ marginTop: 14 }}>
              <Geser label="Laju kenaikan muka air" nilai={lajuNaik} set={setLajuNaik}
                     satuan="mm/menit" maks={20}
                     ket={`Di atas ${AMBANG.lajuNaikMendadak} mm/menit dinilai Siaga, karena menandakan limpasan besar atau sumbatan baru.`} />
              <Geser label="Kecepatan naiknya dasar saluran" nilai={lonjakan} set={setLonjakan}
                     satuan="kali laju wajar" maks={5} langkah={0.1}
                     ket="Endapan menumpuk 2 sampai 7 mm per hari. Kenaikan jauh lebih cepat berarti air tertahan di belakang sumbatan, bukan endapan." />
            </div>
          </details>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button className="tombol tombol-halus"
                    onClick={() => { setEndapan(18); setDebit(92); setAir(30); setLajuNaik(0); setLonjakan(0); }}>
              Contoh: saluran sehat
            </button>
            <button className="tombol tombol-halus"
                    onClick={() => { setEndapan(38); setDebit(45); setAir(52); setLajuNaik(0); setLonjakan(0); }}>
              Contoh: mulai tersumbat
            </button>
            <button className="tombol tombol-halus"
                    onClick={() => { setEndapan(62); setDebit(18); setAir(74); setLajuNaik(3); setLonjakan(0); }}>
              Contoh: sumbatan parah
            </button>
            <button className="tombol tombol-halus"
                    onClick={() => { setEndapan(12); setDebit(14); setAir(58); setLajuNaik(0); setLonjakan(2.4); }}>
              Contoh: benda besar menyumbat
            </button>
          </div>
        </section>

        {/* ----------------------------- hasil ------------------------------ */}
        <section className="panel">
          <h2>Hasil penilaian</h2>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span className="pil" style={{ background: warna, fontSize: ".9rem", padding: "6px 16px" }}>
              {hasil.status}
            </span>
            <span style={{ fontSize: ".84rem", color: "var(--redup)" }}>
              {berbahaya ? "sistem akan mengirim peringatan" : "sistem diam, tidak ada pesan dikirim"}
            </span>
          </div>

          <p style={{ fontSize: ".92rem", lineHeight: 1.65, marginTop: 0 }}>{hasil.alasan}</p>

          <div className="pilih-tampilan">
            <button className={tampilan === "3d" ? "nyala" : ""}
                    onClick={() => setTampilan("3d")}>Model 3D</button>
            <button className={tampilan === "penampang" ? "nyala" : ""}
                    onClick={() => setTampilan("penampang")}>Penampang</button>
          </div>

          {tampilan === "3d" ? (
            <div className="wadah-3d">
              <iframe ref={bingkai} src="/model3d.html?embed=1"
                      title="Model tiga dimensi pemasangan sistem"
                      loading="lazy" />
              {!siap3d && <div className="tunggu-3d">Menyiapkan model tiga dimensi…</div>}
            </div>
          ) : (
            <Penampang rasioEndapan={endapan / 100} rasioAir={air / 100} warna={warna} />
          )}

          <p className="ket-tampilan">
            {tampilan === "3d"
              ? "Model digambar sebagai potongan; aslinya saluran tertutup rapat dan tertimbun tanah. Geser untuk memutar, gulir untuk memperbesar."
              : "Potongan melintang saluran. Semakin tebal lapisan cokelat, semakin tipis ruang tersisa untuk menampung air hujan."}
          </p>

          <div className="ringkas-angka" style={{ marginTop: 16 }}>
            <div className="kartu-angka">
              <div className="kartu-angka-judul">Perkiraan material</div>
              <div className="kartu-angka-nilai">{hasil.volume.tengah}</div>
              <div className="kartu-angka-ket">
                m³ &middot; rentang {hasil.volume.bawah}–{hasil.volume.atas}
              </div>
            </div>
            <div className="kartu-angka">
              <div className="kartu-angka-judul">Setara karung</div>
              <div className="kartu-angka-nilai">{hasil.volume.karung}</div>
              <div className="kartu-angka-ket">karung ukuran 0,05 m³</div>
            </div>
          </div>

          <h2 style={{ fontSize: ".92rem", marginTop: 22 }}>Aturan yang menyala</h2>
          <ul className="daftar-pemicu">
            {hasil.pemicu.map((p, i) => (
              <li key={i}>
                <span className="pil" style={{ background: STATUS[p.hasil]?.warna, fontSize: ".68rem" }}>
                  {p.hasil}
                </span>
                {p.nama}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: ".8rem", color: "var(--redup)", lineHeight: 1.6 }}>
            Aturan dijalankan berurutan, dan yang belakangan dapat menaikkan hasil yang sebelumnya.
            Tidak ada aturan yang boleh menurunkan status.
          </p>
        </section>
      </div>

      {/* --------------------------- pengiriman uji --------------------------- */}
      <section className="panel">
        <h2>Kirim notifikasi uji coba</h2>
        <p className="panel-ket" style={{ maxWidth: "80ch" }}>
          Mengirim pesan sungguhan melalui bot Telegram kepada nomor yang sudah terdaftar dan
          terkonfirmasi, memakai kondisi simulasi di atas. Berguna untuk memastikan jalur
          notifikasi benar-benar bekerja sebelum musim hujan tiba.
        </p>

        <div className="kabar kabar-info" style={{ maxWidth: "80ch" }}>
          <b>Setiap pesan uji diawali penanda besar</b> yang menyatakan bahwa ini bukan peringatan
          sungguhan dan tidak ada bahaya yang sedang terjadi. Penanda itu ditambahkan di sisi
          server dan tidak dapat dimatikan dari halaman ini. Mengirim peringatan palsu yang
          tampak sungguhan akan membuat warga panik tanpa sebab, dan pada peringatan berikutnya
          mereka tidak akan percaya lagi.
        </div>

        {!berbahaya ? (
          <p className="panel-ket">
            Status saat ini AMAN, sehingga tidak ada yang dikirim. Sistem sungguhan pun berdiam
            diri pada kondisi ini. Naikkan tinggi endapan atau turunkan debit untuk mencoba.
          </p>
        ) : (
          <>
            <div className="formulir" style={{ maxWidth: 460 }}>
              <div className="baris">
                <label htmlFor="sasaran">Kirim kepada</label>
                <select id="sasaran" value={sasaran} onChange={(e) => setSasaran(e.target.value)}>
                  <option value="petugas">Petugas BPBD saja (disarankan)</option>
                  <option value="semua">Semua penerima terdaftar, termasuk warga</option>
                </select>
              </div>
            </div>

            {sasaran === "semua" && (
              <div className="kabar kabar-buruk" style={{ maxWidth: "80ch" }}>
                Pilihan ini mengirim pesan ke seluruh warga yang terdaftar. Meski diberi penanda
                uji coba, sebagian orang tetap akan terkejut. Beri tahu pengurus RT lebih dulu,
                dan jangan lakukan pada malam hari.
              </div>
            )}

            {kabar && (
              <div className={`kabar kabar-${kabar.jenis === "baik" ? "baik" : "buruk"}`}>
                {kabar.teks}
              </div>
            )}

            {!minta ? (
              <button className="tombol" onClick={() => setMinta(true)} disabled={mengirim}>
                Kirim pesan uji coba
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: ".88rem" }}>
                  Kirim pesan <b>{hasil.status}</b> ke{" "}
                  <b>{sasaran === "semua" ? "semua penerima" : "petugas BPBD"}</b>?
                </span>
                <button className="tombol" onClick={kirim} disabled={mengirim}>
                  {mengirim ? "Mengirim…" : "Ya, kirim"}
                </button>
                <button className="tombol tombol-halus" onClick={() => setMinta(false)}
                        disabled={mengirim}>Batal</button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

/* ------------------------------------------------------------- pengatur */
function Geser({ label, nilai, set, satuan, maks = 100, langkah = 1, ket }) {
  return (
    <div className="geser-baris">
      <div className="geser-kepala">
        <label>{label}</label>
        <b>{nilai}{langkah < 1 ? "" : ""} <span>{satuan}</span></b>
      </div>
      <input type="range" min={0} max={maks} step={langkah} value={nilai}
             onChange={(e) => set(parseFloat(e.target.value))} />
      {ket && <small>{ket}</small>}
    </div>
  );
}
