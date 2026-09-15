"use client";

/**
 * Gambar potongan melintang saluran.
 *
 * Inilah elemen utama halaman. Alih-alih menampilkan angka "endapan 42
 * persen" yang harus diterjemahkan sendiri oleh pembaca, gambar ini
 * langsung menunjukkan berapa bagian saluran sudah terisi material dan
 * berapa ruang yang tersisa untuk air. Seorang warga yang tidak terbiasa
 * membaca angka pun bisa langsung memahaminya.
 */
export default function Penampang({ rasioEndapan = 0, rasioAir = 0, warna = "#5c7180" }) {
  const L = 300, T = 200;           // ukuran gambar
  const dinding = 18, bibir = 22;   // ketebalan dinding dan tinggi bibir
  const dalam = T - bibir - 14;     // tinggi rongga saluran

  const e = Math.max(0, Math.min(1, rasioEndapan));
  const a = Math.max(0, Math.min(1.05, rasioAir));

  const tinggiEndapan = dalam * e;
  const tinggiTotal = dalam * Math.max(a, e);
  const tinggiAir = Math.max(0, tinggiTotal - tinggiEndapan);

  const dasarY = bibir + dalam;
  const dalamKiri = dinding;
  const lebarDalam = L - dinding * 2;

  return (
    <div className="penampang">
      <svg viewBox={`0 0 ${L} ${T}`} role="img"
           aria-label={`Potongan saluran: endapan mengisi ${Math.round(e * 100)} persen kedalaman, air mencapai ${Math.round(a * 100)} persen.`}>
        {/* tanah di kiri dan kanan */}
        <rect x="0" y={bibir} width={dinding} height={dalam + 14} fill="#d9e2e7" />
        <rect x={L - dinding} y={bibir} width={dinding} height={dalam + 14} fill="#d9e2e7" />
        <rect x="0" y={dasarY} width={L} height="14" fill="#c8d4da" />

        {/* rongga saluran */}
        <rect x={dalamKiri} y={bibir} width={lebarDalam} height={dalam} fill="#eef3f5" />

        {/* air */}
        {tinggiAir > 0.5 && (
          <rect x={dalamKiri} y={dasarY - tinggiEndapan - tinggiAir}
                width={lebarDalam} height={tinggiAir}
                fill={warna} opacity="0.42" />
        )}

        {/* endapan */}
        {tinggiEndapan > 0.5 && (
          <rect x={dalamKiri} y={dasarY - tinggiEndapan}
                width={lebarDalam} height={tinggiEndapan}
                fill="#7a6a55" />
        )}

        {/* garis bibir saluran */}
        <line x1={dalamKiri} y1={bibir} x2={L - dinding} y2={bibir}
              stroke="#9fb0b9" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={L - dinding - 4} y={bibir - 6} textAnchor="end"
              fontSize="10" fill="#5c7180">bibir saluran</text>

        {/* penunjuk tinggi endapan */}
        {e > 0.04 && (
          <text x={dalamKiri + 8} y={dasarY - tinggiEndapan / 2 + 4}
                fontSize="12" fontWeight="700" fill="#ffffff">
            {Math.round(e * 100)}%
          </text>
        )}
      </svg>

      <div className="penampang-ket">
        <span><i style={{ background: "#7a6a55" }} />endapan &amp; sampah</span>
        <span><i style={{ background: warna, opacity: 0.42 }} />air</span>
        <span><i style={{ background: "#eef3f5", border: "1px solid #cfd9de" }} />ruang tersisa</span>
      </div>
    </div>
  );
}
