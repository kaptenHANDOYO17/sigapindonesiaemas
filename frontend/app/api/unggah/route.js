import { NextResponse } from "next/server";
import { supabaseServer, serverSiap, alasanBelumSiap } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penerima unggahan foto dan video laporan warga.
 *
 * Unggahan tidak dilakukan langsung dari peramban ke Supabase Storage,
 * melainkan melewati sini lebih dulu. Dengan begitu jenis berkas, ukuran,
 * dan laju pengiriman dapat diperiksa di sisi server. Membuka penulisan
 * Storage untuk umum berarti siapa pun dapat mengisi penyimpanan Anda
 * sampai penuh.
 */

const MAKS = 15 * 1024 * 1024;               // 15 MB
const JENIS = {
  "image/jpeg": ["foto", "jpg"],
  "image/png": ["foto", "png"],
  "image/webp": ["foto", "webp"],
  "video/mp4": ["video", "mp4"],
  "video/quicktime": ["video", "mov"],
  "video/webm": ["video", "webm"],
};

const BATAS_PER_MENIT = 6;
const jejak = new Map();

function lewatBatas(kunci) {
  const kini = Date.now();
  const daftar = (jejak.get(kunci) || []).filter((t) => kini - t < 60_000);
  daftar.push(kini);
  jejak.set(kunci, daftar);
  if (jejak.size > 500) jejak.clear();
  return daftar.length > BATAS_PER_MENIT;
}

export async function POST(req) {
  if (!serverSiap) {
    return NextResponse.json({ ok: false, pesan: alasanBelumSiap() }, { status: 503 });
  }

  const asal = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "tanpa-alamat";
  if (lewatBatas(asal)) {
    return NextResponse.json(
      { ok: false, pesan: "Terlalu banyak unggahan dalam waktu singkat. Coba lagi sebentar lagi." },
      { status: 429 });
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, pesan: "Berkas tidak terbaca." }, { status: 400 });
  }

  const berkas = form.get("berkas");
  if (!berkas || typeof berkas === "string") {
    return NextResponse.json({ ok: false, pesan: "Tidak ada berkas yang dikirim." }, { status: 400 });
  }

  const cocok = JENIS[berkas.type];
  if (!cocok) {
    return NextResponse.json({
      ok: false,
      pesan: "Jenis berkas tidak didukung. Pakai foto JPG, PNG, WEBP, atau video MP4, MOV, WEBM.",
    }, { status: 400 });
  }

  if (berkas.size > MAKS) {
    return NextResponse.json({
      ok: false,
      pesan: `Ukuran berkas ${(berkas.size / 1024 / 1024).toFixed(1)} MB, melebihi batas 15 MB. ` +
             "Untuk video, rekam lebih pendek atau kecilkan mutunya lebih dulu.",
    }, { status: 400 });
  }

  const [jenis, akhiran] = cocok;
  const acak = Math.random().toString(36).slice(2, 10);
  const nama = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${acak}.${akhiran}`;

  try {
    const db = supabaseServer();
    const { error } = await db.storage.from("laporan").upload(
      nama, Buffer.from(await berkas.arrayBuffer()),
      { contentType: berkas.type, cacheControl: "3600", upsert: false });

    if (error) {
      return NextResponse.json({ ok: false, pesan: "Gagal menyimpan: " + error.message },
                               { status: 500 });
    }

    const { data } = db.storage.from("laporan").getPublicUrl(nama);
    return NextResponse.json({ ok: true, url: data.publicUrl, jenis });
  } catch (e) {
    return NextResponse.json({ ok: false, pesan: "Gagal mengunggah: " + e.message },
                             { status: 500 });
  }
}
