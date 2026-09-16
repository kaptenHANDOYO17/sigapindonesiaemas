"use client";

/**
 * Ikon profil pengelola.
 *
 * Bila foto belum diunggah, ditampilkan huruf awal namanya di atas warna
 * yang dipilih dari namanya sendiri. Dengan begitu setiap orang punya warna
 * tetap yang mudah dikenali, dan halaman tidak terlihat kosong pada akun
 * yang belum sempat mengunggah foto.
 */
const WARNA = ["#1F4E79", "#1C7293", "#2E7D5B", "#8A6F47", "#7A4E7E", "#A65B3A"];

export default function Avatar({ nama = "", foto = null, ukuran = 34, cincin = false }) {
  const huruf = (nama || "?").trim().charAt(0).toUpperCase();
  let jumlah = 0;
  for (let i = 0; i < nama.length; i++) jumlah += nama.charCodeAt(i);
  const warna = WARNA[jumlah % WARNA.length];

  const gaya = {
    width: ukuran, height: ukuran, borderRadius: "50%",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    flex: "none", overflow: "hidden", userSelect: "none",
    boxShadow: cincin ? "0 0 0 2px #fff, 0 0 0 3.5px " + warna : "none",
  };

  if (foto) {
    return (
      <span style={gaya}>
        <img src={foto} alt={nama}
             style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </span>
    );
  }

  return (
    <span style={{ ...gaya, background: warna, color: "#fff",
                   fontWeight: 700, fontSize: ukuran * 0.42 }}>
      {huruf}
    </span>
  );
}
