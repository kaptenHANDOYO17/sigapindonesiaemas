/**
 * Pemeriksaan dan perapian nomor telepon Indonesia.
 *
 * Dipakai bersama oleh halaman pendaftaran dan Route Handler di server.
 * Pemeriksaan di peramban hanya untuk memberi tahu pengguna lebih cepat;
 * pemeriksaan yang benar-benar menentukan tetap dilakukan di server, karena
 * apa pun yang berjalan di peramban dapat dilewati.
 */

export function rapikanNomor(mentah) {
  const angka = String(mentah || "").replace(/[^0-9+]/g, "").replace(/\+/g, "");
  if (!angka) return "";
  if (angka.startsWith("62")) return angka;
  if (angka.startsWith("0")) return "62" + angka.slice(1);
  if (angka.startsWith("8")) return "62" + angka;
  return angka;
}

export function periksaNomor(mentah) {
  const nomor = rapikanNomor(mentah);
  if (!nomor) return { sah: false, pesan: "Nomor belum diisi." };
  if (!nomor.startsWith("628")) {
    return { sah: false, pesan: "Masukkan nomor ponsel Indonesia, contoh 0812xxxxxxx." };
  }
  if (nomor.length < 11 || nomor.length > 15) {
    return { sah: false, pesan: "Panjang nomor tidak wajar. Periksa kembali." };
  }
  return { sah: true, nomor };
}

/** Tampilkan sebagian saja, untuk ditampilkan kembali tanpa membuka nomor penuh. */
export function samarkanNomor(nomor) {
  const n = rapikanNomor(nomor);
  if (n.length < 8) return n;
  return n.slice(0, 5) + "\u2022".repeat(Math.max(0, n.length - 8)) + n.slice(-3);
}
