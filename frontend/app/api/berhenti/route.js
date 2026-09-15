import { NextResponse } from "next/server";
import { periksaNomor } from "../../../lib/nomor";
import { supabaseServer, serverSiap } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Berhenti menerima peringatan.
 *
 * Sengaja dibuat semudah mungkin dan tidak meminta konfirmasi berlapis.
 * Menyulitkan orang berhenti dari layanan peringatan adalah praktik yang
 * buruk, dan pada akhirnya membuat mereka memblokir pesan sepenuhnya.
 */
export async function POST(req) {
  if (!serverSiap) {
    return NextResponse.json(
      { ok: false, pesan: "Server belum dikonfigurasi." }, { status: 503 });
  }

  let isi;
  try { isi = await req.json(); } catch {
    return NextResponse.json({ ok: false, pesan: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const cek = periksaNomor(isi?.nomor);
  if (!cek.sah) {
    return NextResponse.json({ ok: false, pesan: cek.pesan }, { status: 400 });
  }

  const db = supabaseServer();
  await db.from("kontak_stakeholder")
    .update({ aktif: false })
    .eq("nomor_kontak", cek.nomor);

  // Jawaban dibuat sama untuk nomor yang terdaftar maupun tidak, supaya
  // halaman ini tidak bisa dipakai memeriksa nomor siapa saja yang terdaftar.
  return NextResponse.json({
    ok: true,
    pesan:
      "Permintaan diterima. Bila nomor tersebut terdaftar, ia tidak akan lagi menerima " +
      "peringatan. Anda dapat mendaftar kembali kapan saja.",
  });
}
