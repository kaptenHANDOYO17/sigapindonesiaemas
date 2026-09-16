import { NextResponse } from "next/server";
import { supabaseServer, serverSiap, alasanBelumSiap } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penerimaan laporan warga dari situs.
 *
 * Laporan boleh anonim. Sensor hanya memantau satu titik, sedangkan sumbatan
 * bisa berada puluhan meter darinya, sehingga mata warga tetap menjadi
 * pelengkap yang tidak tergantikan. Memaksa orang menuliskan identitas hanya
 * akan mengurangi jumlah laporan yang masuk.
 */

const BATAS_PER_MENIT = 4;
const jejak = new Map();

function lewatBatas(kunci) {
  const kini = Date.now();
  const daftar = (jejak.get(kunci) || []).filter((t) => kini - t < 60_000);
  daftar.push(kini);
  jejak.set(kunci, daftar);
  if (jejak.size > 500) jejak.clear();
  return daftar.length > BATAS_PER_MENIT;
}

const JENIS = ["sampah", "genangan", "sumbatan", "perangkat", "lainnya"];

export async function POST(req) {
  if (!serverSiap) {
    return NextResponse.json(
      { ok: false, pesan: alasanBelumSiap() },
      { status: 503 });
  }

  let isi;
  try { isi = await req.json(); } catch {
    return NextResponse.json({ ok: false, pesan: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const teks = String(isi?.isi || "").trim();
  if (teks.length < 10) {
    return NextResponse.json(
      { ok: false, pesan: "Tuliskan laporan sedikit lebih rinci, minimal sepuluh huruf." },
      { status: 400 });
  }
  if (teks.length > 1200) {
    return NextResponse.json(
      { ok: false, pesan: "Laporan terlalu panjang. Ringkas menjadi paling banyak 1.200 huruf." },
      { status: 400 });
  }

  const asal = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "tanpa-alamat";
  if (lewatBatas(asal)) {
    return NextResponse.json(
      { ok: false, pesan: "Terlalu banyak laporan dalam waktu singkat. Coba lagi beberapa menit lagi." },
      { status: 429 });
  }

  const jenis = JENIS.includes(isi?.jenis) ? isi.jenis : "lainnya";

  // Koordinat hanya diterima bila masuk akal. Nilai di luar wilayah Indonesia
  // hampir pasti salah kirim, dan menyimpannya hanya akan menyesatkan petugas.
  const angka = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  let lat = angka(isi?.lat), lon = angka(isi?.lon);
  if (lat === null || lon === null ||
      lat < -11 || lat > 6 || lon < 95 || lon > 141) {
    lat = null; lon = null;
  }

  const db = supabaseServer();
  const { data, error } = await db.from("laporan_warga").insert({
    nama_pelapor: String(isi?.nama || "").trim().slice(0, 80) || null,
    kontak: String(isi?.kontak || "").trim().slice(0, 40) || null,
    wilayah: String(isi?.wilayah || "").trim().slice(0, 40) || null,
    jenis,
    isi: teks,
    sumber: "situs",
    status: "baru",
    lat,
    lon,
    akurasi_m: angka(isi?.akurasi) ,
    media_url: typeof isi?.media_url === "string" ? isi.media_url.slice(0, 500) : null,
    media_jenis: ["foto", "video"].includes(isi?.media_jenis) ? isi.media_jenis : null,
  }).select("id").single();

  if (error) {
    return NextResponse.json(
      { ok: false, pesan: "Laporan gagal tersimpan. Coba beberapa saat lagi." }, { status: 500 });
  }

  // Beri tahu pengelola lewat Telegram bila token tersedia. Kegagalan di sini
  // tidak boleh membatalkan laporan yang sudah tersimpan.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (token && admin) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: admin,
          parse_mode: "HTML",
          text:
            `\u{1F4E2} <b>Laporan warga baru</b> (No. ${data.id})\n\n` +
            `Jenis  : ${jenis}\n` +
            `Wilayah: ${isi?.wilayah || "-"}\n` +
            `Pelapor: ${isi?.nama || "tidak disebutkan"}\n` +
            (lat !== null
              ? `Lokasi : https://www.google.com/maps?q=${lat},${lon}\n` : "") +
            (isi?.media_url ? `Media  : ${isi.media_url}\n` : "") +
            `\n` + teks.slice(0, 700),
        }),
      });
    } catch { /* diabaikan dengan sengaja */ }
  }

  return NextResponse.json({
    ok: true,
    nomor: data.id,
    pesan: "Laporan Anda tersimpan dan diteruskan kepada pengelola. Terima kasih.",
  });
}
