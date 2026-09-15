export const metadata = {
  title: "Tentang Sistem — SIGAP Drainase",
  description:
    "Cara kerja, hasil pengujian, dan keterbatasan sistem pemantauan drainase SIGAP " +
    "di Kelurahan Mangunharjo, Kecamatan Tugu, Kota Semarang.",
};

const UKURAN = [
  ["Penilaian tepat", "92,3 %", "Status yang ditetapkan sama dengan kondisi sebenarnya."],
  ["Kondisi berbahaya tertangkap", "96,2 %", "Kondisi Siaga atau Kritis yang berhasil ditandai. Inilah ukuran yang paling menyangkut keselamatan."],
  ["Alarm palsu", "5,3 %", "Kondisi tidak berbahaya yang salah ditandai."],
  ["Kondisi Kritis terbaca Aman", "0,00 %", "Kesalahan paling berbahaya. Tidak satu pun dari 972 baris kritis yang terlewat."],
  ["Kurang waspada", "1,1 %", "Sistem meremehkan keadaan."],
];

const RAMALAN = [
  ["3 jam pertama", "27,9 mm", "Sekitar 3,4 persen kedalaman saluran. Bagian yang paling dapat dipercaya."],
  ["Jam ke-12", "65,1 mm", "Layak sebagai isyarat kasar, bukan dasar keputusan evakuasi."],
  ["Pembanding: tebakan naif", "75,1 mm", "Model mengungguli pembanding ini sebesar 28,5 persen."],
];

const BATAS = [
  ["Radar tidak dapat melihat menembus air",
   "Tinggi endapan tidak diukur langsung, melainkan disimpulkan dari permukaan terendah selama saluran kering. Pada musim hujan panjang tanpa periode kering, taksiran berhenti diperbarui."],
  ["Satu sensor hanya mewakili satu titik",
   "Endapan di saluran tidak pernah rata. Sumbatan yang berada puluhan meter dari sensor dapat lolos. Karena itu laporan warga tetap diperlakukan sebagai sumber yang setara."],
  ["Dugaan jenis sampah dari pH sangat lemah",
   "pH air saluran juga dipengaruhi limbah rumah tangga, air sabun, dan intrusi air laut. Keyakinan keluarannya sengaja dibatasi maksimal 45 persen."],
  ["Ambang batas masih berupa perkiraan",
   "Angka yang benar hanya dapat ditemukan dengan membandingkan penilaian sistem terhadap temuan petugas di lapangan, berulang kali, selama beberapa bulan."],
];

export default function Tentang() {
  return (
    <main>
      <section className="panel">
        <h2>Tentang Sistem</h2>
        <p className="panel-ket" style={{ maxWidth: "78ch" }}>
          SIGAP Drainase memantau kapasitas saluran drainase permukiman di Kelurahan
          Mangunharjo secara terus-menerus, lalu menerjemahkannya menjadi empat status yang
          dapat dimengerti warga maupun petugas.
        </p>

        <div className="kabar kabar-info" style={{ maxWidth: "80ch" }}>
          <b>Apa yang program ini tidak kerjakan.</b> Banjir besar di Mangunharjo dipicu luapan
          Sungai Plumbon dan tanggul Kali Babon yang jebol. Sistem ini tidak mencegah keduanya.
          Yang dijawabnya adalah kapasitas saluran drainase permukiman, yang menentukan seberapa
          parah genangan akibat hujan biasa dan seberapa cepat air surut setelah luapan. Batas
          ini disampaikan sendiri agar tidak ada harapan yang keliru.
        </div>
      </section>

      <section className="panel">
        <h2>Cara kerja</h2>
        <ol className="tindakan">
          <li>
            <b>Sensor membaca.</b> Radar level Holykell HR2000 mengukur jarak ke permukaan di
            dalam saluran. Sensor debit YF-B10 dan modul pH analog DFRobot melengkapinya.
            Ketiganya dibaca mikrokontroler ESP32 setiap lima belas menit.
          </li>
          <li>
            <b>Data terkumpul.</b> Seluruh pembacaan tersimpan di Supabase, digabung dengan data
            curah hujan agar debit rendah saat kemarau tidak salah dibaca sebagai penyumbatan.
          </li>
          <li>
            <b>Penilaian dijalankan tiap 30 menit.</b> Matriks aturan yang dapat dibaca manusia
            menentukan status. Model terawasi hanya berwenang menaikkan kewaspadaan, dan tidak
            pernah boleh menyatakan keadaan aman.
          </li>
          <li>
            <b>Pesan dikirim berbeda.</b> Warga menerima kalimat sehari-hari beserta langkah
            persiapan. Petugas menerima laporan teknis berisi titik lokasi, tingkat penyumbatan,
            perkiraan volume material, dan saran penanganan.
          </li>
          <li>
            <b>Sistem belajar.</b> Setiap hasil pemeriksaan petugas dicatat, lalu dipakai
            menggeser ambang batas pada pelatihan ulang bulan berikutnya.
          </li>
        </ol>
      </section>

      <section className="panel">
        <h2>Hasil pengujian</h2>
        <p className="panel-ket" style={{ maxWidth: "78ch" }}>
          Diuji dengan protokol latih, validasi, dan uji pada 18 saluran simulasi bergeometri
          berbeda. Pemilihan model dan penyetelan ambang seluruhnya memakai data validasi;
          data uji dibuka satu kali di akhir, dan memuat 1.159 baris berbahaya.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table className="tabel">
            <thead><tr><th>Ukuran</th><th>Hasil</th><th>Arti</th></tr></thead>
            <tbody>
              {UKURAN.map(([a, b, c]) => (
                <tr key={a}><td>{a}</td><td><b>{b}</b></td><td>{c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={{ fontSize: ".98rem", marginTop: 26 }}>Model peramalan muka air</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="tabel">
            <thead><tr><th>Rentang</th><th>Galat rerata</th><th>Arti</th></tr></thead>
            <tbody>
              {RAMALAN.map(([a, b, c]) => (
                <tr key={a}><td>{a}</td><td><b>{b}</b></td><td>{c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="kabar kabar-buruk" style={{ marginTop: 20, maxWidth: "80ch" }}>
          <b>Seluruh angka di atas berasal dari data simulasi, bukan dari saluran Mangunharjo.</b>{" "}
          Tidak ada dataset publik berisi tinggi endapan dan label tersumbat untuk saluran
          permukiman di Indonesia; satu-satunya sumbernya adalah petugas yang mengisi formulir
          verifikasi. Ketepatan yang sebenarnya baru dapat diketahui setelah sistem melewati satu
          musim hujan penuh. Angka ini disampaikan apa adanya, bukan sebagai capaian lapangan.
        </div>
      </section>

      <section className="panel">
        <h2>Keterbatasan yang kami sadari</h2>
        <p className="panel-ket" style={{ maxWidth: "78ch" }}>
          Disampaikan sendiri, bukan disembunyikan, karena keterbatasan yang ditutupi akan tetap
          muncul pada tahap survei lapangan.
        </p>
        <div style={{ display: "grid", gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {BATAS.map(([judul, isi]) => (
            <div key={judul} className="kartu-angka">
              <div style={{ fontWeight: 600, fontSize: ".9rem", marginBottom: 6 }}>{judul}</div>
              <div style={{ fontSize: ".84rem", color: "var(--redup)", lineHeight: 1.6 }}>{isi}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Program</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="tabel">
            <tbody>
              <tr><td>Lokasi</td><td>Kelurahan Mangunharjo, Kecamatan Tugu, Kota Semarang</td></tr>
              <tr><td>Penerima manfaat</td><td>2.406 kepala keluarga / 7.177 jiwa di 5 RW dan 30 RT</td></tr>
              <tr><td>Durasi</td><td>12 bulan, satu titik pantau percontohan</td></tr>
              <tr><td>Anggaran tahun pertama</td><td>Rp 13.269.000</td></tr>
              <tr><td>Biaya perangkat lunak</td><td>Rp 0 — basis data, situs, dan otomasi berjalan pada paket gratis</td></tr>
              <tr><td>Pelaksana</td><td>Tim SIGAP Drainase, Teknik Komputer, Fakultas Teknik, Universitas Diponegoro</td></tr>
              <tr><td>Program induk</td><td>PLN SustainAction 2026</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
