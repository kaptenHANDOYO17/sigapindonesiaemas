"use client";

import { useEffect, useState } from "react";
import { STATUS, belumDikonfigurasi, jam, supabase } from "../../lib/supabase";

/**
 * Halaman verifikasi lapangan untuk petugas.
 *
 * Halaman ini terlihat sederhana, tetapi inilah bagian yang membuat sistem
 * bisa membaik. Tanpa isian di sini, tidak ada seorang pun yang tahu apakah
 * penilaian AI benar, dan pelatihan ulang bulanan hanya akan mengulang
 * kebiasaan lama tanpa pernah mengoreksi kekeliruan.
 *
 * Formulir sengaja dibuat pendek. Petugas mengisinya sambil berdiri di
 * pinggir saluran setelah bekerja, sering kali dengan tangan kotor dan
 * layar yang silau. Formulir panjang tidak akan pernah terisi.
 */
export default function Verifikasi() {
  const [status, setStatus] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [mengirim, setMengirim] = useState(false);
  const [kabar, setKabar] = useState(null);

  const [isian, setIsian] = useState({
    petugas: "",
    instansi: "BPBD Kota Semarang",
    kondisi_sebenarnya: "",
    tinggi_endapan_cm: "",
    volume_terangkut_m3: "",
    jenis_sampah_dominan: "",
    sudah_dibersihkan: true,
    durasi_kerja_menit: "",
    catatan: "",
  });

  useEffect(() => {
    if (belumDikonfigurasi) return;
    (async () => {
      const [s, v] = await Promise.all([
        supabase.from("status_ai").select("*").order("timestamp", { ascending: false }).limit(1),
        supabase.from("verifikasi_lapangan").select("*")
          .order("waktu_periksa", { ascending: false }).limit(12),
      ]);
      setStatus(s.data?.[0] ?? null);
      setRiwayat(v.data ?? []);
    })();
  }, []);

  const ubah = (k) => (e) =>
    setIsian((s) => ({
      ...s,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  async function kirim() {
    if (!isian.petugas.trim() || !isian.kondisi_sebenarnya) {
      setKabar({ jenis: "buruk", teks: "Nama petugas dan kondisi sebenarnya wajib diisi." });
      return;
    }
    setMengirim(true);
    setKabar(null);

    // Ketepatan dihitung otomatis dengan membandingkan penilaian sistem
    // terhadap temuan petugas. Petugas tidak perlu menilai sendiri, karena
    // penilaian sendiri cenderung memihak.
    const tepat = status ? status.status === isian.kondisi_sebenarnya : null;

    const { error } = await supabase.from("verifikasi_lapangan").insert({
      saluran_id: status?.saluran_id ?? "MGH-01",
      status_ai_id: status?.id ?? null,
      petugas: isian.petugas.trim(),
      instansi: isian.instansi.trim(),
      kondisi_sebenarnya: isian.kondisi_sebenarnya,
      peringatan_tepat: tepat,
      tinggi_endapan_cm: isian.tinggi_endapan_cm ? Number(isian.tinggi_endapan_cm) : null,
      volume_terangkut_m3: isian.volume_terangkut_m3 ? Number(isian.volume_terangkut_m3) : null,
      jenis_sampah_dominan: isian.jenis_sampah_dominan || null,
      sudah_dibersihkan: isian.sudah_dibersihkan,
      durasi_kerja_menit: isian.durasi_kerja_menit ? Number(isian.durasi_kerja_menit) : null,
      catatan: isian.catatan.trim() || null,
    });

    setMengirim(false);
    if (error) {
      console.error(error);
      setKabar({
        jenis: "buruk",
        teks: "Gagal menyimpan. Halaman ini memerlukan akun petugas yang sudah masuk. " +
              "Hubungi pengelola sistem bila Anda belum punya akun.",
      });
      return;
    }

    setKabar({
      jenis: "baik",
      teks: tepat === null
        ? "Terima kasih. Data tersimpan."
        : tepat
          ? "Terima kasih. Penilaian sistem ternyata sudah tepat."
          : "Terima kasih. Sistem ternyata keliru menilai, dan koreksi Anda akan " +
            "dipakai untuk memperbaiki ambang batas pada pelatihan ulang bulan depan.",
    });
    setIsian((s) => ({
      ...s, kondisi_sebenarnya: "", tinggi_endapan_cm: "",
      volume_terangkut_m3: "", durasi_kerja_menit: "", catatan: "",
    }));
  }

  const tepatPersen = riwayat.length
    ? Math.round(
        (riwayat.filter((r) => r.peringatan_tepat).length /
          riwayat.filter((r) => r.peringatan_tepat !== null).length) * 100
      )
    : null;

  return (
    <main>
      <section className="panel">
        <h2>Verifikasi Lapangan</h2>
        <p className="panel-ket">
          Halaman untuk petugas BPBD dan kelurahan. Isi setelah memeriksa atau
          membersihkan saluran.
        </p>

        <div className="kabar kabar-info" style={{ marginBottom: 20 }}>
          Isian di halaman ini adalah satu-satunya cara sistem mengetahui apakah
          penilaiannya benar. Setiap bulan, kumpulan data ini dipakai untuk
          menggeser ambang batas ke arah yang lebih tepat. Tanpa isian ini,
          sistem hanya bisa menebak.
        </div>

        {status && (
          <div style={{
            padding: 16, borderRadius: 10, marginBottom: 22,
            background: "#f7fafb", border: "1px solid var(--tepi)",
          }}>
            <div style={{ fontSize: ".78rem", color: "var(--redup)", marginBottom: 6 }}>
              Penilaian sistem saat ini
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span className="pil" style={{ background: STATUS[status.status]?.warna }}>
                {status.status}
              </span>
              <span style={{ fontSize: ".9rem" }}>
                Endapan {Math.round((status.rasio_endapan ?? 0) * 100)}% ·
                Aliran {Math.round((status.rasio_debit ?? 0) * 100)}% ·
                Perkiraan {status.estimasi_volume_m3 ?? "—"} m³
              </span>
              <span style={{ fontSize: ".8rem", color: "var(--redup)" }}>
                {jam(status.timestamp)}
              </span>
            </div>
            {status.ringkasan_petugas && (
              <p style={{ margin: "10px 0 0", fontSize: ".86rem", color: "var(--redup)" }}>
                {status.ringkasan_petugas}
              </p>
            )}
          </div>
        )}

        <div className="formulir">
          <div className="dua">
            <div className="baris">
              <label htmlFor="petugas">Nama petugas *</label>
              <input id="petugas" value={isian.petugas} onChange={ubah("petugas")}
                     placeholder="Nama lengkap" />
            </div>
            <div className="baris">
              <label htmlFor="instansi">Instansi</label>
              <input id="instansi" value={isian.instansi} onChange={ubah("instansi")} />
            </div>
          </div>

          <div className="baris">
            <label htmlFor="kondisi">Kondisi sebenarnya di lapangan *</label>
            <small>
              Nilai berdasarkan apa yang Anda lihat, bukan berdasarkan penilaian
              sistem di atas. Bila keduanya berbeda, justru itu yang paling berguna.
            </small>
            <select id="kondisi" value={isian.kondisi_sebenarnya} onChange={ubah("kondisi_sebenarnya")}>
              <option value="">— pilih —</option>
              <option value="AMAN">Aman — saluran bersih, air mengalir lancar</option>
              <option value="WASPADA">Waspada — ada endapan, aliran masih lancar</option>
              <option value="SIAGA">Siaga — endapan banyak, aliran jelas melambat</option>
              <option value="KRITIS">Kritis — tersumbat, air hampir tidak mengalir</option>
            </select>
          </div>

          <div className="dua">
            <div className="baris">
              <label htmlFor="tinggi">Tinggi endapan terukur (cm)</label>
              <small>Ukur dari dasar saluran ke permukaan endapan.</small>
              <input id="tinggi" type="number" step="0.5" min="0"
                     value={isian.tinggi_endapan_cm} onChange={ubah("tinggi_endapan_cm")} />
            </div>
            <div className="baris">
              <label htmlFor="volume">Volume terangkut (m³)</label>
              <small>Perkiraan kasar juga membantu. Satu karung sekitar 0,05 m³.</small>
              <input id="volume" type="number" step="0.1" min="0"
                     value={isian.volume_terangkut_m3} onChange={ubah("volume_terangkut_m3")} />
            </div>
          </div>

          <div className="dua">
            <div className="baris">
              <label htmlFor="jenis">Jenis material dominan</label>
              <select id="jenis" value={isian.jenis_sampah_dominan} onChange={ubah("jenis_sampah_dominan")}>
                <option value="">— pilih —</option>
                <option value="organik">Organik (daun, sisa makanan)</option>
                <option value="plastik">Plastik dan kemasan</option>
                <option value="lumpur">Lumpur dan pasir</option>
                <option value="campuran">Campuran</option>
                <option value="benda_besar">Benda besar (kasur, dahan, puing)</option>
              </select>
            </div>
            <div className="baris">
              <label htmlFor="durasi">Lama pengerjaan (menit)</label>
              <input id="durasi" type="number" min="0"
                     value={isian.durasi_kerja_menit} onChange={ubah("durasi_kerja_menit")} />
            </div>
          </div>

          <div className="baris">
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 500 }}>
              <input type="checkbox" checked={isian.sudah_dibersihkan}
                     onChange={ubah("sudah_dibersihkan")} style={{ width: 17, height: 17 }} />
              Saluran sudah dibersihkan pada kunjungan ini
            </label>
          </div>

          <div className="baris">
            <label htmlFor="catatan">Catatan</label>
            <small>
              Tulis hal yang tidak tertangkap sensor, misalnya sumbatan berada 20 meter
              dari titik sensor, atau ada pembuangan limbah dari suatu tempat.
            </small>
            <textarea id="catatan" value={isian.catatan} onChange={ubah("catatan")} />
          </div>

          {kabar && (
            <div className={`kabar kabar-${kabar.jenis === "baik" ? "baik" : "buruk"}`}>
              {kabar.teks}
            </div>
          )}

          <div>
            <button className="tombol" onClick={kirim} disabled={mengirim}>
              {mengirim ? "Menyimpan…" : "Simpan verifikasi"}
            </button>
          </div>
        </div>
      </section>

      {/* --------------------- Riwayat verifikasi --------------------- */}
      <section className="panel">
        <h2>Riwayat verifikasi</h2>
        <p className="panel-ket">
          {tepatPersen !== null
            ? `Dari ${riwayat.length} pemeriksaan terakhir, penilaian sistem tepat pada ${tepatPersen} persen kasus.`
            : "Belum ada verifikasi tercatat."}
        </p>

        {riwayat.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Waktu</th><th>Petugas</th><th>Kondisi nyata</th>
                  <th>Endapan</th><th>Volume</th><th>Material</th><th>Penilaian AI</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
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
                    <td>{r.jenis_sampah_dominan ?? "—"}</td>
                    <td>
                      {r.peringatan_tepat === null ? "—" : r.peringatan_tepat ? "tepat" : "keliru"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
