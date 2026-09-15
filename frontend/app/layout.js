import "./globals.css";

const JUDUL = "SIGAP Drainase — Pemantauan Saluran Mangunharjo";
const KETERANGAN =
  "Sistem pemantauan saluran drainase secara terus-menerus dengan sensor radar " +
  "dan kecerdasan buatan. Peringatan dini penyumbatan dan genangan untuk warga " +
  "Kelurahan Mangunharjo, Kecamatan Tugu, Kota Semarang.";

export const metadata = {
  title: JUDUL,
  description: KETERANGAN,
  applicationName: "SIGAP Drainase",
  keywords: ["drainase", "banjir", "Mangunharjo", "Semarang", "IoT", "peringatan dini"],
  openGraph: {
    title: JUDUL,
    description: KETERANGAN,
    locale: "id_ID",
    type: "website",
    siteName: "SIGAP Drainase",
  },
  twitter: { card: "summary_large_image", title: JUDUL, description: KETERANGAN },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#1b7fa8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <header className="kepala">
          <div className="kepala-isi">
            <a className="merek" href="/" style={{ textDecoration: "none", color: "inherit" }}>
              <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 6v14a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4V6" />
                <path d="M4 19c4 0 4-3 8-3s4 3 8 3 4-3 8-3" />
                <path d="M16 3v6M13 6l3 3 3-3" />
              </svg>
              <span>SIGAP Drainase</span>
            </a>
            <nav className="kepala-kanan">
              <a href="/">Dasbor</a>
              <a href="/daftar">Daftar Peringatan</a>
              <a href="/lapor">Lapor</a>
              <a href="/tentang">Tentang Sistem</a>
              <a href="/simulasi">Simulasi</a>
              <a href="/masuk" className="tautan-pengelola">Masuk Pengelola</a>
            </nav>
          </div>
        </header>

        {children}

        <footer className="kaki">
          <p>
            <b>Angka pada halaman ini berasal dari sensor dan perkiraan model, bukan kepastian.</b>{" "}
            Untuk keputusan penanganan dan evakuasi, ikuti arahan resmi BPBD Kota Semarang
            dan aparat kelurahan.
          </p>
          <p style={{ marginBottom: 0 }}>
            Sensor: radar level Holykell HR2000, sensor debit YF-B10, dan modul pH analog
            DFRobot, dibaca mikrokontroler ESP32. Curah hujan dari Open-Meteo.
            Penilaian diperbarui otomatis setiap 30 menit.
          </p>
        </footer>
      </body>
    </html>
  );
}
