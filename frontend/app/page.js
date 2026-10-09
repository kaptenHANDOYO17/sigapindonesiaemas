"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ComposedChart, Legend, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Penampang from "../components/Penampang";
import {
  KETERANGAN, STATUS, belumDikonfigurasi, jam, keArray, keObjek, selisih, supabase,
} from "../lib/supabase";
import { riwayatContoh, sensorContoh, statusContoh } from "../lib/contoh";

const TINDAKAN = {
  AMAN: [],
  WASPADA: [
    "Jangan membuang sampah, sisa makanan, atau minyak jelantah ke saluran.",
    "Bersihkan daun dan plastik di mulut saluran depan rumah.",
    "Periksa apakah selokan halaman masih mengalir lancar.",
  ],
  SIAGA: [
    "Naikkan barang berharga dan dokumen penting ke tempat yang lebih tinggi.",
    "Pindahkan kendaraan ke lokasi yang tidak tergenang.",
    "Siapkan tas berisi obat, senter, dan dokumen dalam plastik kedap air.",
  ],
  KRITIS: [
    "Utamakan keselamatan jiwa, bukan barang.",
    "Matikan aliran listrik dari MCB utama sebelum air masuk rumah.",
    "Jangan menerjang genangan yang mengalir deras atau lebih tinggi dari lutut.",
    "Dahulukan lansia, anak kecil, dan penyandang disabilitas menuju tempat aman.",
  ],
};

export default function Dasbor() {
  const [status, setStatus] = useState(null);
  const [sensor, setSensor] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [hidup, setHidup] = useState(false);
  const [galat, setGalat] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [peragaan, setPeragaan] = useState(false);

  // Dipakai HANYA bila basis data benar-benar kosong, dan selalu disertai
  // spanduk peringatan di bagian atas halaman. Begitu satu baris data
  // sungguhan masuk, seluruh angka peragaan berhenti dipakai.
  function pakaiPeragaan() {
    setStatus(statusContoh());
    setSensor(sensorContoh());
    setRiwayat(riwayatContoh());
    setPeragaan(true);
    setHidup(false);
  }

  const muat = useCallback(async () => {
    if (belumDikonfigurasi) {
      pakaiPeragaan();
      setMemuat(false);
      return;
    }
    try {
      const sejak = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const [s, d, r] = await Promise.all([
        supabase.from("status_ai").select("*").order("timestamp", { ascending: false }).limit(1),
        supabase.from("sensor_drainase").select("timestamp,jarak_mm,debit_lpm,ph_air,hujan_mm")
          .gte("timestamp", sejak).order("timestamp", { ascending: true }).limit(2000),
        supabase.from("status_ai").select("timestamp,status,rasio_endapan,rasio_debit,estimasi_volume_m3")
          .gte("timestamp", sejak).order("timestamp", { ascending: true }).limit(2000),
      ]);
      if (s.error) throw s.error;

      if (!s.data?.length) {
        // Sensor belum terpasang, atau pipeline belum pernah berjalan.
        pakaiPeragaan();
      } else {
        setStatus(s.data[0]);
        setSensor(d.data ?? []);
        setRiwayat(r.data ?? []);
        setPeragaan(false);
        setHidup(true);
      }
      setGalat(null);
    } catch (e) {
      console.error(e);
      pakaiPeragaan();
      setGalat("Data langsung tidak dapat dimuat, sehingga yang ditampilkan adalah contoh.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    muat();
    if (belumDikonfigurasi) return;

    // Dasbor ikut berubah begitu pipeline menulis status baru.
    const kanal = supabase
      .channel("status-langsung")
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "status_ai" },
          (p) => { setStatus(p.new); setHidup(true); })
      .subscribe();

    // Cadangan bila Realtime terhalang jaringan.
    const jeda = setInterval(muat, 3 * 60 * 1000);
    return () => { supabase.removeChannel(kanal); clearInterval(jeda); };
  }, [muat]);

  const st = status?.status ?? "AMAN";
  const warna = STATUS[st]?.warna ?? "#5c7180";
  const ramalan = keObjek(status?.ramalan);
  const kedalaman = 800; // mm, dipakai untuk mengubah ramalan menjadi persen

  const dataSensor = sensor.map((b) => ({
    waktu: new Date(b.timestamp).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit" }),
    debit: b.debit_lpm == null ? null : Number(b.debit_lpm),
    hujan: b.hujan_mm == null ? null : Number(b.hujan_mm),
    ph: b.ph_air == null ? null : Number(b.ph_air),
  }));

  const dataRiwayat = riwayat.map((b) => ({
    waktu: new Date(b.timestamp).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit" }),
    endapan: Math.round((b.rasio_endapan ?? 0) * 100),
    aliran: Math.round((b.rasio_debit ?? 0) * 100),
  }));

  const dataRamalan = ramalan
    ? keArray(ramalan.waktu).map((w, i) => ({
        waktu: new Date(w).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        tinggi: Math.round((keArray(ramalan.permukaan_mm)[i] / kedalaman) * 100),
      }))
    : [];

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <span className="denyut" data-hidup={hidup ? "true" : "false"}
              style={{ fontSize: ".82rem", color: "var(--redup)" }}>
          <i />{hidup ? "data langsung" : memuat ? "memuat"
                 : peragaan ? "data contoh" : "terputus"}
        </span>
      </div>

      {peragaan && (
        <div className="spanduk-peragaan">
          <div className="spanduk-judul">MODE PERAGAAN &mdash; angka di halaman ini adalah contoh</div>
          <p>
            Sensor belum terpasang di lapangan, sehingga basis data masih kosong. Seluruh angka,
            grafik, dan ramalan yang Anda lihat berasal dari data simulasi, dan ditampilkan agar
            tampilan sistem dapat dinilai apa adanya. Begitu sensor terpasang dan mengirim
            pembacaan pertama, halaman ini beralih sendiri ke data sungguhan dan spanduk ini hilang.
          </p>
          <a href="/tentang">Baca cara kerja sistem dan hasil pengujiannya</a>
        </div>
      )}

      {galat && <div className="kabar kabar-buruk" style={{ marginBottom: 16 }}>{galat}</div>}

      {/* ---------------------- Penampang saluran ---------------------- */}
      <section className="utama" data-status={st}>
        <Penampang
          rasioEndapan={Number(status?.rasio_endapan ?? 0)}
          rasioAir={Number(status?.rasio_air ?? 0)}
          warna={warna}
        />
        <div className="utama-teks">
          <span className="lencana">{STATUS[st]?.label ?? st}</span>
          <h1 className="judul-status">
            {st === "AMAN" ? "Saluran mengalir normal" :
             st === "WASPADA" ? "Saluran mulai menyempit" :
             st === "SIAGA" ? "Aliran melambat, waspada genangan" :
             "Saluran tersumbat parah"}
          </h1>
          <p className="alasan">{status?.alasan || KETERANGAN[st]}</p>

          <dl className="angka-baris">
            <div>
              <dt>Endapan</dt>
              <dd>{Math.round((status?.rasio_endapan ?? 0) * 100)}<small>% kedalaman</small></dd>
            </div>
            <div>
              <dt>Aliran air</dt>
              <dd>{Math.round((status?.rasio_debit ?? 0) * 100)}<small>% seharusnya</small></dd>
            </div>
            <div>
              <dt>Perkiraan material</dt>
              <dd>{status?.estimasi_volume_m3 ?? "—"}<small>m³</small></dd>
            </div>
            <div>
              <dt>Diperbarui</dt>
              <dd style={{ fontSize: "1rem", fontWeight: 500 }}>{selisih(status?.timestamp)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ------------------------- Tindakan ---------------------------- */}
      {TINDAKAN[st]?.length > 0 && (
        <section className="panel">
          <h2>Yang perlu dilakukan warga sekarang</h2>
          <p className="panel-ket">Langkah ini dikirim juga lewat Telegram saat status berubah.</p>
          <ol className="tindakan">
            {TINDAKAN[st].map((t, i) => <li key={i}>{t}</li>)}
          </ol>
          {st === "KRITIS" && (
            <p style={{ marginTop: 16, marginBottom: 0, fontWeight: 600 }}>
              Darurat: 112 · Basarnas: 115 · BPBD Kota Semarang
            </p>
          )}
        </section>
      )}

      {/* --------------------- Endapan vs aliran ----------------------- */}
      {/* Jalan pintas, supaya pengunjung baru tahu apa yang bisa dilakukan
          tanpa harus membaca seluruh halaman lebih dulu. */}
      <section className="jalan-pintas">
        {[
          ["/daftar", "1", "Daftar peringatan",
           "Dapatkan pesan di ponsel sebelum genangan terjadi. Gratis."],
          ["/lapor", "2", "Laporkan yang Anda lihat",
           "Sampah atau genangan yang tidak terlihat alat. Boleh anonim."],
          ["/peta", "3", "Lihat peta titik pantau",
           "Letak setiap alat dan kondisi salurannya."],
          ["/tentang", "4", "Pahami cara kerjanya",
           "Cara kerja, hasil pengujian, dan keterbatasannya."],
        ].map(([alamat, no, judul, ket]) => (
          <a key={alamat} href={alamat} className="pintas">
            <span className="pintas-ikon">{no}</span>
            <b>{judul}</b>
            <small>{ket}</small>
          </a>
        ))}
      </section>

      <section className="panel">
        <h2>Endapan dan aliran, 48 jam terakhir</h2>
        <p className="panel-ket">
          Perhatikan saat kedua garis bergerak berlawanan. Endapan naik sementara
          aliran turun adalah tanda khas saluran mulai tersumbat.
        </p>
        <div className="grafik">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dataRiwayat}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6ebee" />
              <XAxis dataKey="waktu" tick={{ fontSize: 11, fill: "#5c7180" }} minTickGap={40} />
              <YAxis tick={{ fontSize: 11, fill: "#5c7180" }} unit="%" domain={[0, 120]} />
              <Tooltip formatter={(v, n) => [`${v}%`, n === "endapan" ? "Endapan" : "Aliran"]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={30} stroke="#ffb020" strokeDasharray="5 4"
                             label={{ value: "batas waspada", fontSize: 10, fill: "#ffb020", position: "insideTopRight" }} />
              <ReferenceLine y={55} stroke="#ff4a5f" strokeDasharray="5 4"
                             label={{ value: "batas kritis", fontSize: 10, fill: "#ff4a5f", position: "insideTopRight" }} />
              <Area type="monotone" dataKey="endapan" name="Endapan"
                    stroke="#7a6a55" fill="#7a6a55" fillOpacity={0.18} strokeWidth={2} />
              <Line type="monotone" dataKey="aliran" name="Aliran air"
                    stroke="#1b7fa8" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ------------------------- Ramalan ----------------------------- */}
      {dataRamalan.length > 0 && (
        <section className="panel">
          <h2>Ramalan muka air 12 jam ke depan</h2>
          <p className="panel-ket">
            Puncak {Math.round((ramalan.rasio_puncak ?? 0) * 100)} persen kedalaman pada{" "}
            {jam(ramalan.waktu_puncak)}.
            {ramalan.berpotensi_meluap ? " Saluran berpotensi meluap." : ""}
          </p>
          <div className="grafik-kecil">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataRamalan}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6ebee" />
                <XAxis dataKey="waktu" tick={{ fontSize: 11, fill: "#5c7180" }} minTickGap={30} />
                <YAxis tick={{ fontSize: 11, fill: "#5c7180" }} unit="%" domain={[0, 120]} />
                <Tooltip formatter={(v) => [`${v}% kedalaman`, "Muka air"]} />
                <ReferenceLine y={85} stroke="#ff4a5f" strokeDasharray="5 4"
                               label={{ value: "meluap", fontSize: 10, fill: "#ff4a5f", position: "insideTopRight" }} />
                <Area type="monotone" dataKey="tinggi" stroke={warna}
                      fill={warna} fillOpacity={0.22} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ------------------ Debit, hujan, dan pH ----------------------- */}
      <section className="panel">
        <h2>Pembacaan sensor mentah</h2>
        <p className="panel-ket">
          Debit air dan curah hujan harus dibaca bersama. Debit rendah saat tidak
          hujan adalah hal wajar; debit rendah saat hujan deras adalah tanda bahaya.
        </p>
        <div className="grafik-kecil">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dataSensor}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6ebee" />
              <XAxis dataKey="waktu" tick={{ fontSize: 11, fill: "#5c7180" }} minTickGap={40} />
              <YAxis yAxisId="kiri" tick={{ fontSize: 11, fill: "#5c7180" }} />
              <YAxis yAxisId="kanan" orientation="right" tick={{ fontSize: 11, fill: "#5c7180" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="kanan" type="monotone" dataKey="hujan" name="Hujan (mm/jam)"
                    stroke="#9db9c7" fill="#9db9c7" fillOpacity={0.35} />
              <Line yAxisId="kiri" type="monotone" dataKey="debit" name="Debit (L/menit)"
                    stroke="#1b7fa8" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ------------------------ Langganan ---------------------------- */}
      <section className="ajakan">
        <div>
          <h2>Dapatkan peringatan langsung di ponsel</h2>
          <p>
            Bot Telegram menghubungi Anda hanya ketika saluran mulai bermasalah,
            lengkap dengan langkah persiapan. Saat kondisi aman, bot tidak mengirim
            apa pun. Anda juga bisa melaporkan sampah yang menyumbat lewat bot yang sama.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a className="tombol" href="/daftar">Daftarkan nomor saya</a>
            <a className="tombol tombol-halus"
               href={process.env.NEXT_PUBLIC_TELEGRAM_BOT
                 ? `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT}?start=warga`
                 : "/daftar"}
               target="_blank" rel="noopener noreferrer">
              Lewat Telegram
            </a>
          </div>
          <p style={{ fontSize: ".8rem", marginTop: 12, marginBottom: 0 }}>
            Gratis. Bisa dihentikan kapan saja lewat halaman{" "}
            <a href="/berhenti">berhenti berlangganan</a>.
          </p>
        </div>
        <ul className="perintah">
          <li><code>/status</code> kondisi saluran</li>
          <li><code>/prediksi</code> ramalan 12 jam</li>
          <li><code>/lapor</code> laporkan sampah</li>
          <li><code>/mitigasi</code> langkah pencegahan</li>
        </ul>
      </section>

      {/* ------------------------ Cara kerja --------------------------- */}
      <section className="panel">
        <h2>Empat keadaan yang perlu Anda kenali</h2>
        <p className="panel-ket">
          Sistem hanya menghubungi Anda ketika keadaan naik ke Waspada, Siaga, atau Kritis.
          Saat aman, tidak ada pesan yang dikirim sama sekali.
        </p>
        <div className="tangga-status">
          {[
            ["AMAN", "Saluran bersih, air mengalir lancar.", "Tidak perlu tindakan apa pun."],
            ["WASPADA", "Ada endapan, aliran masih lancar.", "Jangan buang sampah ke saluran."],
            ["SIAGA", "Endapan banyak, aliran melambat.", "Naikkan barang, siapkan tas darurat."],
            ["KRITIS", "Tersumbat parah, air hampir tidak mengalir.", "Utamakan keselamatan, matikan MCB."],
          ].map(([nama, arti, tindak]) => (
            <div key={nama} className={`tangga ${st === nama ? "tangga-kini" : ""}`}>
              <span className="pil" style={{ background: STATUS[nama]?.warna }}>{nama}</span>
              <b>{arti}</b>
              <small>{tindak}</small>
              {st === nama && <em>keadaan sekarang</em>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Bagaimana angka ini dihasilkan</h2>
        <ol className="tindakan">
          <li>
            <b>Sensor radar mengukur permukaan.</b> Radar level Holykell HR2000
            memantulkan gelombang ke permukaan di dalam saluran, lalu dibaca
            mikrokontroler ESP32 melalui jalur RS485 setiap lima belas menit.
          </li>
          <li>
            <b>Endapan disimpulkan saat kering.</b> Radar tidak bisa melihat menembus
            air, sehingga tinggi endapan dihitung dari permukaan terendah yang terbaca
            selama saluran tidak berair.
          </li>
          <li>
            <b>Debit dan pH dibaca bersamaan.</b> Sensor debit YF-B10 dan modul pH
            analog DFRobot terhubung ke papan ESP32 yang sama, lalu seluruh
            pembacaan dikirim sekaligus ke basis data.
          </li>
          <li>
            <b>Aturan menilai, model memberi pendapat kedua.</b> Status ditentukan
            matriks aturan yang dapat diperiksa manusia. Model anomali hanya berwenang
            menaikkan status, tidak pernah menyatakan aman.
          </li>
          <li>
            <b>Sistem belajar dari petugas.</b> Setiap hasil pemeriksaan lapangan
            dipakai untuk memperbaiki ambang batas pada pelatihan ulang bulanan.
          </li>
        </ol>
      </section>
    </main>
  );
}
