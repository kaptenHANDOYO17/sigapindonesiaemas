export const metadata = {
  title: "AR Lapangan — SIGAP Drainase",
  description:
    "Lihat model alat SIGAP Drainase menempel pada tutup saluran yang sebenarnya, " +
    "lewat kamera ponsel, lengkap dengan simulasi empat tingkat status.",
};

/**
 * Halaman pembuka untuk fitur AR.
 *
 * Halamannya sendiri berupa berkas tersendiri di /ar.html, bukan halaman Next,
 * karena izin kamera dan sensor arah ponsel jauh lebih dapat diandalkan bila
 * diminta dari halaman utuh, bukan dari bingkai di dalam halaman lain.
 */
export default function Ar() {
  return (
    <main>
      <section className="panel">
        <h2>AR Lapangan</h2>
        <p className="panel-ket" style={{ maxWidth: "80ch" }}>
          Arahkan kamera ponsel ke tutup saluran atau gorong-gorong, lalu ketuk layar. Model alat
          SIGAP akan menempel di atas tutup itu, dan bagian dalam salurannya tergambar menembus ke
          bawah tanah, lengkap dengan endapan dan muka air. Empat tingkat status dapat dicoba satu
          per satu untuk melihat bagaimana air naik sampai meluap.
        </p>

        <a className="tombol" href="/ar.html">Buka AR lewat kamera</a>

        <p className="panel-ket" style={{ marginTop: 18, marginBottom: 6 }}>
          <b>Yang perlu disiapkan</b>
        </p>
        <ol className="panel-ket" style={{ paddingLeft: 20, lineHeight: 1.75, maxWidth: "72ch" }}>
          <li>Buka halaman ini dari ponsel, bukan dari komputer.</li>
          <li>Izinkan kamera ketika ponsel bertanya. Gambar kamera tidak dikirim ke mana pun.</li>
          <li>Berdiri di dekat tutup saluran, gorong-gorong, atau lantai datar.</li>
          <li>Pegang ponsel agak menunduk, lalu ketuk layar untuk meletakkan alat.</li>
        </ol>
      </section>

      <div className="susun-dua">
        <section className="panel">
          <h2>Yang dapat diatur</h2>
          <ul className="panel-ket" style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li><b>Empat status</b> — Aman, Waspada, Siaga, dan Kritis. Tinggi endapan dan muka air
                bergerak naik turun mengikuti status yang dipilih.</li>
            <li><b>Bahan tutup</b> — beton atau besi.</li>
            <li><b>Bentuk tutup</b> — datar atau lengkung.</li>
            <li><b>Tutup tembus pandang</b> — agar isi saluran di bawahnya terlihat.</li>
            <li><b>Ukuran dan arah</b> — geser pengatur, atau cubit dua jari di layar.</li>
          </ul>
          <p className="panel-ket">
            Angka endapan dan sisa ruang saluran yang muncul di layar dihitung memakai matriks aturan
            yang sama dengan halaman simulasi dan sistem yang berjalan di lapangan.
          </p>
        </section>

        <section className="panel">
          <h2>Batas yang perlu diketahui</h2>
          <p className="panel-ket">
            Ponsel biasa tidak mengukur jarak ke benda di depannya. Model ditahan pada satu titik
            memakai sensor arah ponsel, sehingga berputar di tempat akan terasa menempel, tetapi
            berjalan menjauh akan menggeser posisinya. Ketuk sekali lagi untuk meletakkannya ulang.
          </p>
          <p className="panel-ket">
            Kamera hanya dapat dinyalakan pada alamat yang diawali <b>https</b>. Bila ponsel menolak
            memberi izin, tersedia mode tanpa kamera yang menampilkan model pada latar polos.
          </p>
          <div className="kabar kabar-info" style={{ maxWidth: "80ch" }}>
            Tampilan ini adalah alat bantu penjelasan, bukan hasil pengukuran. Angka yang sebenarnya
            selalu berasal dari sensor yang terpasang, dan dapat dilihat pada dasbor.
          </div>
        </section>
      </div>
    </main>
  );
}
