"use client";

import { useCallback, useEffect, useState } from "react";
import {
  supabase, belumDikonfigurasi, ambilProfil, jam, selisih,
  LABEL_PERAN, LABEL_STATUS_LAPORAN, WARNA_STATUS_LAPORAN, STATUS,
} from "../../lib/supabase";
import { samarkanNomor } from "../../lib/nomor";

/**
 * Dasbor pengelola.
 *
 * Seluruh pembacaan di halaman ini memakai sesi pengguna, bukan kunci
 * rahasia. Yang menentukan boleh atau tidaknya adalah policy di basis data,
 * bukan pemeriksaan di peramban. Dengan begitu, seseorang yang membuka alat
 * pengembang peramban tetap tidak bisa melihat apa pun yang tidak menjadi
 * haknya.
 */
const TAB = [
  ["ringkasan", "Ringkasan"],
  ["laporan", "Laporan Warga"],
  ["pendaftaran", "Pendaftaran Nomor"],
  ["verifikasi", "Verifikasi Lapangan"],
];

export default function Admin() {
  const [profil, setProfil] = useState(null);
  const [memeriksa, setMemeriksa] = useState(true);
  const [tab, setTab] = useState("ringkasan");
  const [kabar, setKabar] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  const [laporan, setLaporan] = useState([]);
  const [tertunda, setTertunda] = useState([]);
  const [kontakAktif, setKontakAktif] = useState(0);
  const [verifikasi, setVerifikasi] = useState([]);
  const [statusTerkini, setStatusTerkini] = useState(null);
  const [saringLaporan, setSaringLaporan] = useState("baru");
  const [ringkasan, setRingkasan] = useState(null);
  const [meringkas, setMeringkas] = useState(false);

  useEffect(() => {
    if (belumDikonfigurasi) { setMemeriksa(false); return; }
    ambilProfil().then((p) => { setProfil(p); setMemeriksa(false); });
  }, []);

  const muat = useCallback(async () => {
    if (!profil) return;
    setSibuk(true);
    try {
      const [l, k, v, s] = await Promise.all([
        supabase.from("laporan_warga").select("*")
          .order("waktu", { ascending: false }).limit(200),
        supabase.from("kontak_stakeholder")
          .select("id, nama, nomor_kontak, wilayah, tanggal_daftar, aktif, terkonfirmasi, sumber_daftar, peran, kode_konfirmasi")
          .order("tanggal_daftar", { ascending: false }).limit(300),
        supabase.from("verifikasi_lapangan").select("*")
          .order("waktu_periksa", { ascending: false }).limit(50),
        supabase.from("status_ai").select("*")
          .order("timestamp", { ascending: false }).limit(1),
      ]);
      setLaporan(l.data ?? []);
      setTertunda((k.data ?? []).filter((x) => !x.terkonfirmasi && x.peran === "warga"));
      setKontakAktif((k.data ?? []).filter((x) => x.aktif && x.terkonfirmasi).length);
      setVerifikasi(v.data ?? []);
      setStatusTerkini(s.data?.[0] ?? null);
    } catch (e) {
      setKabar({ jenis: "buruk", teks: "Gagal memuat data. Coba muat ulang." });
    } finally {
      setSibuk(false);
    }
  }, [profil]);

  useEffect(() => { muat(); }, [muat]);

  async function ubahLaporan(id, status) {
    setSibuk(true);
    const { error } = await supabase.from("laporan_warga").update({
      status,
      ditangani_oleh: profil.nama,
      ditangani_pada: new Date().toISOString(),
    }).eq("id", id);
    setKabar(error
      ? { jenis: "buruk", teks: error.message }
      : { jenis: "baik", teks: `Laporan #${id} ditandai ${LABEL_STATUS_LAPORAN[status]}.` });
    if (!error) {
      setLaporan((s) => s.map((x) => x.id === id
        ? { ...x, status, ditangani_oleh: profil.nama, ditangani_pada: new Date().toISOString() }
        : x));
    }
    setSibuk(false);
  }

  async function putuskanKontak(id, aktifkan) {
    setSibuk(true);
    const { error } = aktifkan
      ? await supabase.from("kontak_stakeholder").update({
          aktif: true, terkonfirmasi: true,
          dikonfirmasi_pada: new Date().toISOString(), dikonfirmasi_oleh: profil.nama,
        }).eq("id", id)
      : await supabase.from("kontak_stakeholder").delete().eq("id", id);
    setKabar(error
      ? { jenis: "buruk", teks: error.message }
      : { jenis: "baik", teks: aktifkan ? "Nomor diaktifkan." : "Pendaftaran dihapus." });
    if (!error) {
      setTertunda((s) => s.filter((x) => x.id !== id));
      if (aktifkan) setKontakAktif((n) => n + 1);
    }
    setSibuk(false);
  }

  async function mintaRingkasan() {
    setMeringkas(true);
    setRingkasan(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/ringkas", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const d = await r.json();
      setRingkasan(d.ok
        ? { teks: d.ringkasan, jumlah: d.jumlah_laporan, model: d.model }
        : { galat: d.pesan });
    } catch {
      setRingkasan({ galat: "Tidak dapat menghubungi server." });
    } finally {
      setMeringkas(false);
    }
  }

  /* ------------------------------------------------------------ tampilan */
  if (memeriksa) {
    return <main><section className="panel"><p className="panel-ket">Memeriksa sesi…</p></section></main>;
  }

  if (!profil) {
    return (
      <main>
        <section className="panel" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h2>Perlu masuk sebagai pengelola</h2>
          <p className="panel-ket">
            Halaman ini memuat nomor kontak warga dan laporan yang masuk, sehingga hanya
            dapat dibuka oleh kader, petugas BPBD, atau perangkat kelurahan yang terdaftar.
          </p>
          <a className="tombol" href="/masuk">Masuk</a>
        </section>
      </main>
    );
  }

  const laporanTersaring = saringLaporan === "semua"
    ? laporan : laporan.filter((x) => x.status === saringLaporan);
  const hitung = (s) => laporan.filter((x) => x.status === s).length;

  return (
    <main>
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2>Dasbor Pengelola</h2>
            <p className="panel-ket" style={{ marginBottom: 0 }}>
              {profil.nama} &middot; {LABEL_PERAN[profil.peran] || profil.peran}
              {profil.wilayah ? ` · ${profil.wilayah}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="tombol tombol-halus" onClick={muat} disabled={sibuk}>
              {sibuk ? "Memuat…" : "Muat ulang"}
            </button>
            <button className="tombol tombol-halus"
                    onClick={async () => { await supabase.auth.signOut(); location.href = "/"; }}>
              Keluar
            </button>
          </div>
        </div>

        <nav className="tab-baris">
          {TAB.map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? "tab-aktif" : ""}`}
                    onClick={() => setTab(k)}>
              {l}
              {k === "laporan" && hitung("baru") > 0 && (
                <span className="lencana-angka">{hitung("baru")}</span>
              )}
              {k === "pendaftaran" && tertunda.length > 0 && (
                <span className="lencana-angka">{tertunda.length}</span>
              )}
            </button>
          ))}
        </nav>

        {kabar && (
          <div className={`kabar kabar-${kabar.jenis === "baik" ? "baik" : "buruk"}`}
               style={{ marginTop: 16 }}>{kabar.teks}</div>
        )}
      </section>

      {/* ------------------------------ RINGKASAN ------------------------------ */}
      {tab === "ringkasan" && (
        <>
          <section className="panel">
            <h2>Kondisi saluran terkini</h2>
            {statusTerkini ? (
              <div style={{ display: "flex", alignItems: "center", gap: 14,
                            flexWrap: "wrap", marginTop: 12 }}>
                <span className="pil" style={{ background: STATUS[statusTerkini.status]?.warna }}>
                  {statusTerkini.status}
                </span>
                <span style={{ fontSize: ".92rem" }}>
                  Endapan {Math.round((statusTerkini.rasio_endapan ?? 0) * 100)}% &middot;{" "}
                  Aliran {Math.round((statusTerkini.rasio_debit ?? 0) * 100)}% &middot;{" "}
                  Perkiraan {statusTerkini.estimasi_volume_m3 ?? "—"} m³
                </span>
                <span style={{ fontSize: ".84rem", color: "var(--redup)" }}>
                  {selisih(statusTerkini.timestamp)}
                </span>
              </div>
            ) : (
              <p className="panel-ket">
                Belum ada penilaian tersimpan. Sensor kemungkinan belum terpasang, atau alur
                otomatis belum pernah berjalan.
              </p>
            )}
          </section>

          <section className="ringkas-angka">
            {[
              ["Laporan baru", hitung("baru"), "perlu ditindaklanjuti"],
              ["Sedang ditangani", hitung("diproses"), "laporan"],
              ["Pendaftaran menunggu", tertunda.length, "perlu dikonfirmasi"],
              ["Warga aktif", kontakAktif, "menerima peringatan"],
              ["Verifikasi lapangan", verifikasi.length, "tercatat"],
            ].map(([judul, angka, ket]) => (
              <div key={judul} className="kartu-angka">
                <div className="kartu-angka-judul">{judul}</div>
                <div className="kartu-angka-nilai">{angka}</div>
                <div className="kartu-angka-ket">{ket}</div>
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>Yang perlu dikerjakan</h2>
            <ol className="tindakan">
              {hitung("baru") > 0 && <li>Ada {hitung("baru")} laporan warga yang belum ditindaklanjuti.</li>}
              {tertunda.length > 0 && <li>Ada {tertunda.length} pendaftaran nomor yang menunggu konfirmasi kader.</li>}
              {verifikasi.length < 5 && (
                <li>
                  Baru ada {verifikasi.length} verifikasi lapangan. Sistem membutuhkan minimal lima
                  catatan sebelum ambang batas peringatan dapat dikalibrasi dari kenyataan.
                </li>
              )}
              {hitung("baru") === 0 && tertunda.length === 0 && verifikasi.length >= 5 && (
                <li>Tidak ada yang tertunda. Sistem berjalan normal.</li>
              )}
            </ol>
          </section>
        </>
      )}

      {/* ------------------------------ LAPORAN ------------------------------ */}
      {tab === "laporan" && (
        <section className="panel">
          <h2>Laporan Warga</h2>
          <p className="panel-ket">
            Laporan dari situs dan bot Telegram. Sensor hanya memantau satu titik, sehingga
            laporan warga kerap menemukan sumbatan yang tidak terlihat alat.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0 4px" }}>
            <button className="tombol tombol-halus" onClick={mintaRingkasan} disabled={meringkas}>
              {meringkas ? "Meringkas\u2026" : "Ringkas laporan dengan AI"}
            </button>
          </div>

          {ringkasan && (
            <div className={ringkasan.galat ? "kabar kabar-buruk" : "kotak-ringkasan"}
                 style={{ marginTop: 12 }}>
              {ringkasan.galat ? ringkasan.galat : (
                <>
                  <div className="kotak-ringkasan-kepala">
                    Ringkasan {ringkasan.jumlah} laporan terbaru
                    <span>dibuat oleh {ringkasan.model}</span>
                  </div>
                  <pre>{ringkasan.teks}</pre>
                  <small>
                    Ringkasan ini dibuat model bahasa dan dapat keliru. Ia tidak menilai tingkat
                    bahaya saluran, dan tidak menggantikan pembacaan laporan aslinya. Penilaian
                    status tetap dikerjakan matriks aturan memakai data sensor.
                  </small>
                </>
              )}
            </div>
          )}

          <div className="saring-baris">
            {[["baru", "Baru"], ["diproses", "Ditangani"], ["selesai", "Selesai"],
              ["bukan_masalah", "Bukan masalah"], ["semua", "Semua"]].map(([k, l]) => (
              <button key={k} className={`saring ${saringLaporan === k ? "saring-aktif" : ""}`}
                      onClick={() => setSaringLaporan(k)}>
                {l}{k !== "semua" && ` (${hitung(k)})`}
              </button>
            ))}
          </div>

          {laporanTersaring.length === 0 ? (
            <p className="panel-ket" style={{ marginTop: 16 }}>Tidak ada laporan pada saringan ini.</p>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 6 }}>
              {laporanTersaring.map((l) => (
                <article key={l.id} className="kartu-laporan">
                  <div className="kartu-laporan-kepala">
                    <span className="pil" style={{ background: WARNA_STATUS_LAPORAN[l.status] }}>
                      {LABEL_STATUS_LAPORAN[l.status]}
                    </span>
                    <b>#{l.id}</b>
                    <span className="kartu-laporan-meta">
                      {l.jenis} &middot; {l.wilayah || "lokasi tidak disebut"} &middot; {jam(l.waktu)}
                      {l.sumber === "telegram" ? " · via Telegram" : ""}
                    </span>
                  </div>
                  <p className="kartu-laporan-isi">{l.isi}</p>
                  <div className="kartu-laporan-kaki">
                    <span>
                      Pelapor: {l.nama_pelapor || "anonim"}
                      {l.kontak ? ` · ${l.kontak}` : ""}
                      {l.ditangani_oleh ? ` · ditangani ${l.ditangani_oleh}` : ""}
                    </span>
                    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {l.status !== "diproses" && (
                        <button className="tombol-kecil" disabled={sibuk}
                                onClick={() => ubahLaporan(l.id, "diproses")}>Tangani</button>
                      )}
                      {l.status !== "selesai" && (
                        <button className="tombol-kecil" disabled={sibuk}
                                onClick={() => ubahLaporan(l.id, "selesai")}>Selesai</button>
                      )}
                      {l.status !== "bukan_masalah" && (
                        <button className="tombol-kecil tombol-kecil-halus" disabled={sibuk}
                                onClick={() => ubahLaporan(l.id, "bukan_masalah")}>Bukan masalah</button>
                      )}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------------------------- PENDAFTARAN ---------------------------- */}
      {tab === "pendaftaran" && (
        <section className="panel">
          <h2>Pendaftaran Nomor Menunggu Konfirmasi</h2>
          <p className="panel-ket">
            Nomor di bawah ini didaftarkan melalui situs dan belum menerima peringatan apa pun.
            Aktifkan hanya setelah Anda memastikan nomor tersebut benar milik yang bersangkutan,
            misalnya saat kunjungan kader.
          </p>

          {tertunda.length === 0 ? (
            <p className="panel-ket">Tidak ada pendaftaran yang menunggu.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="tabel">
                <thead>
                  <tr><th>Nama</th><th>Nomor</th><th>Kode</th><th>RT / RW</th><th>Didaftarkan</th><th>Tindakan</th></tr>
                </thead>
                <tbody>
                  {tertunda.map((k) => (
                    <tr key={k.id}>
                      <td>{k.nama || "—"}</td>
                      <td>{samarkanNomor(k.nomor_kontak)}</td>
                      <td><code style={{ fontWeight: 700, letterSpacing: ".08em" }}>
                        {k.kode_konfirmasi || "—"}</code></td>
                      <td>{k.wilayah || "—"}</td>
                      <td>{jam(k.tanggal_daftar)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="tombol-kecil" disabled={sibuk}
                                onClick={() => putuskanKontak(k.id, true)}>Aktifkan</button>
                        <button className="tombol-kecil tombol-kecil-halus" disabled={sibuk}
                                style={{ marginLeft: 8 }}
                                onClick={() => putuskanKontak(k.id, false)}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="kabar kabar-info" style={{ marginTop: 20 }}>
            <b>Cara memastikan nomor benar milik pendaftar.</b> Warga diminta mengirim kode di
            kolom Kode dari WhatsApp mereka sendiri ke nomor pengelola. Begitu pesan berisi kode
            itu masuk, cocokkan dengan baris di tabel ini lalu tekan Aktifkan. Karena pesan
            datang dari nomor yang bersangkutan, kepemilikannya terbukti. Bila warga tidak
            mengirim apa pun, pastikan langsung saat kunjungan kader.
            <br /><br />
            Nomor sengaja ditampilkan sebagian saja. Bila Anda perlu nomor lengkap untuk
            menghubungi warga, bukalah melalui Supabase, agar akses itu meninggalkan jejak yang
            dapat ditelusuri.
          </div>
        </section>
      )}

      {/* ---------------------------- VERIFIKASI ---------------------------- */}
      {tab === "verifikasi" && (
        <section className="panel">
          <h2>Verifikasi Lapangan</h2>
          <p className="panel-ket">
            Hasil pemeriksaan petugas. Inilah satu-satunya sumber kebenaran yang membuat sistem
            memperbaiki diri; tanpa isian ini, ambang batas peringatan hanya menebak.
          </p>
          <a className="tombol" href="/verifikasi">Isi verifikasi baru</a>

          {verifikasi.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 20 }}>
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Waktu</th><th>Petugas</th><th>Kondisi nyata</th>
                    <th>Endapan</th><th>Volume</th><th>Penilaian AI</th>
                  </tr>
                </thead>
                <tbody>
                  {verifikasi.map((r) => (
                    <tr key={r.id}>
                      <td>{jam(r.waktu_periksa)}</td>
                      <td>{r.petugas ?? "—"}</td>
                      <td>
                        <span className="pil" style={{ background: STATUS[r.kondisi_sebenarnya]?.warna ?? "#5c7180" }}>
                          {r.kondisi_sebenarnya ?? "—"}
                        </span>
                      </td>
                      <td>{r.tinggi_endapan_cm != null ? `${r.tinggi_endapan_cm} cm` : "—"}</td>
                      <td>{r.volume_terangkut_m3 != null ? `${r.volume_terangkut_m3} m³` : "—"}</td>
                      <td>{r.peringatan_tepat === null ? "—" : r.peringatan_tepat ? "tepat" : "keliru"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
