"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, belumDikonfigurasi, STATUS, selisih } from "../../lib/supabase";

/**
 * Peta persebaran titik sensor.
 *
 * Memakai Leaflet dengan petak peta dari OpenStreetMap. Dipilih karena tidak
 * memerlukan kunci API maupun kartu kredit, berbeda dengan Google Maps. Untuk
 * menandai beberapa titik di satu kelurahan, keduanya sama saja hasilnya.
 *
 * Berkas Leaflet dimuat dari CDN ketika halaman dibuka, bukan ikut dibundel,
 * supaya halaman lain tidak ikut membesar hanya karena ada satu halaman peta.
 */

const WARNA_BELUM = "#9A9A9A";

export default function Peta() {
  const wadah = useRef(null);
  const peta = useRef(null);
  const penanda = useRef({});
  const [titik, setTitik] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState(null);
  const [pilih, setPilih] = useState(null);

  /* ----------------------------------------------------- muat pustaka peta */
  useEffect(() => {
    let batal = false;

    async function siapkan() {
      // Sisipkan gaya dan skrip Leaflet sekali saja.
      if (!document.getElementById("leaflet-css")) {
        const l = document.createElement("link");
        l.id = "leaflet-css";
        l.rel = "stylesheet";
        l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(l);
      }
      if (!window.L) {
        await new Promise((selesai, gagal) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload = selesai;
          s.onerror = () => gagal(new Error("Peta gagal dimuat"));
          document.head.appendChild(s);
        });
      }
      if (batal || !wadah.current || peta.current) return;

      const L = window.L;
      peta.current = L.map(wadah.current, { scrollWheelZoom: false })
        .setView([-7.0662, 110.4718], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; Kontributor OpenStreetMap",
      }).addTo(peta.current);
    }

    siapkan().catch((e) => setGalat(e.message));
    return () => { batal = true; };
  }, []);

  /* ----------------------------------------------------------- ambil data */
  useEffect(() => {
    if (belumDikonfigurasi) {
      setGalat("Situs belum tersambung ke basis data.");
      setMemuat(false);
      return;
    }

    async function ambil() {
      const { data, error } = await supabase.from("peta_sensor").select("*").order("kode");
      if (error) {
        setGalat("Data titik sensor tidak dapat dimuat.");
      } else {
        setTitik(data ?? []);
        setGalat(null);
      }
      setMemuat(false);
    }

    ambil();

    // Ikut berubah begitu ada penilaian baru masuk.
    const saluran = supabase
      .channel("peta-status")
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "status_ai" }, ambil)
      .subscribe();
    return () => { supabase.removeChannel(saluran); };
  }, []);

  /* ------------------------------------------------------- gambar penanda */
  useEffect(() => {
    if (!peta.current || !window.L || !titik.length) return;
    const L = window.L;

    for (const t of titik) {
      const warna = t.terpasang && t.status ? (STATUS[t.status]?.warna ?? WARNA_BELUM) : WARNA_BELUM;
      const isi =
        `<div style="min-width:190px">
           <b>${t.kode} — ${t.nama}</b><br/>
           <span style="color:#5c7180;font-size:.82rem">${t.alamat || ""}</span>
           <hr style="border:0;border-top:1px solid #e3e9ec;margin:7px 0"/>
           ${t.terpasang
             ? `Status: <b style="color:${warna}">${t.status || "belum ada data"}</b><br/>
                Endapan: ${t.rasio_endapan != null ? Math.round(t.rasio_endapan * 100) + "%" : "—"}<br/>
                Aliran: ${t.rasio_debit != null ? Math.round(t.rasio_debit * 100) + "%" : "—"}`
             : `<i style="color:#5c7180">Alat belum terpasang di lokasi ini.</i>`}
         </div>`;

      if (penanda.current[t.kode]) {
        penanda.current[t.kode].setPopupContent(isi);
        penanda.current[t.kode].setStyle({ fillColor: warna });
      } else {
        penanda.current[t.kode] = L.circleMarker([t.lat, t.lon], {
          radius: 11, color: "#fff", weight: 2.5,
          fillColor: warna, fillOpacity: 0.95,
        }).addTo(peta.current).bindPopup(isi);
      }
    }

    // Atur pandangan agar seluruh titik terlihat.
    const batas = L.latLngBounds(titik.map((t) => [t.lat, t.lon]));
    peta.current.fitBounds(batas, { padding: [50, 50], maxZoom: 15 });
  }, [titik]);

  return (
    <main>
      <section className="panel">
        <h2>Peta Titik Sensor</h2>
        <p className="panel-ket" style={{ maxWidth: "78ch" }}>
          Letak seluruh titik pantau beserta kondisi salurannya. Warna penanda mengikuti status
          terkini, dan berubah dengan sendirinya begitu ada penilaian baru.
        </p>

        {galat && <div className="kabar kabar-buruk">{galat}</div>}

        <div className="legenda-peta">
          {Object.entries(STATUS).map(([k, v]) => (
            <span key={k}><i style={{ background: v.warna }} />{k}</span>
          ))}
          <span><i style={{ background: WARNA_BELUM }} />belum terpasang</span>
        </div>

        <div ref={wadah} className="wadah-peta" />

        <p style={{ fontSize: ".8rem", color: "var(--redup)", marginTop: 10 }}>
          Peta dari OpenStreetMap. Gulir untuk menggeser; perbesar dengan tombol di pojok kiri atas.
        </p>
      </section>

      <section className="panel">
        <h2>Daftar Titik</h2>
        {memuat ? (
          <p className="panel-ket">Memuat…</p>
        ) : !titik.length ? (
          <p className="panel-ket">
            Belum ada titik sensor terdaftar. Pengelola dapat menambahkannya melalui halaman admin.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Kode</th><th>Nama</th><th>Status</th><th>Endapan</th>
                  <th>Aliran</th><th>Diperbarui</th><th>Peta</th>
                </tr>
              </thead>
              <tbody>
                {titik.map((t) => (
                  <tr key={t.kode}
                      onClick={() => {
                        setPilih(t.kode);
                        peta.current?.setView([t.lat, t.lon], 17);
                        penanda.current[t.kode]?.openPopup();
                      }}
                      style={{ cursor: "pointer",
                               background: pilih === t.kode ? "#eaf3f7" : undefined }}>
                    <td><b>{t.kode}</b></td>
                    <td>{t.nama}</td>
                    <td>
                      {t.terpasang && t.status ? (
                        <span className="pil" style={{ background: STATUS[t.status]?.warna }}>
                          {t.status}
                        </span>
                      ) : (
                        <span className="pil" style={{ background: WARNA_BELUM }}>belum terpasang</span>
                      )}
                    </td>
                    <td>{t.rasio_endapan != null ? `${Math.round(t.rasio_endapan * 100)}%` : "—"}</td>
                    <td>{t.rasio_debit != null ? `${Math.round(t.rasio_debit * 100)}%` : "—"}</td>
                    <td>{t.diperbarui ? selisih(t.diperbarui) : "—"}</td>
                    <td>
                      <a href={`https://www.google.com/maps?q=${t.lat},${t.lon}`}
                         target="_blank" rel="noopener noreferrer"
                         onClick={(e) => e.stopPropagation()}>buka</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="kabar kabar-info" style={{ marginTop: 18 }}>
          Titik bertanda <b>belum terpasang</b> adalah rencana perluasan; alatnya belum ada di
          lokasi, sehingga belum mengirimkan pembacaan apa pun. Koordinatnya pun masih perkiraan
          dari peta dan akan diperbaiki setelah survei lapangan.
        </div>
      </section>
    </main>
  );
}
