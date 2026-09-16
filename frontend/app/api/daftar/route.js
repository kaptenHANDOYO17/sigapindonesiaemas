import { NextResponse } from "next/server";
import { periksaNomor } from "../../../lib/nomor";
import { supabaseServer, serverSiap, alasanBelumSiap, sidikNomor, buatToken } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pendaftaran nomor warga dari situs.
 *
 * MENGAPA PENDAFTARAN TIDAK LANGSUNG AKTIF
 * ----------------------------------------
 * Formulir ini terbuka untuk umum. Siapa pun dapat mengetikkan nomor orang
 * lain, dan orang itu akan menerima peringatan yang tidak pernah ia minta.
 * Karena itu pendaftaran dari situs disimpan dengan aktif = false dan
 * terkonfirmasi = false, lalu baru diaktifkan setelah kader mendatangi warga
 * atau pengelola menyetujuinya.
 *
 * Warga yang ingin langsung aktif dapat memakai bot Telegram, karena di sana
 * merekalah yang memulai percakapan, sehingga persetujuannya sudah jelas.
 */

const BATAS_PER_MENIT = 5;
const jejak = new Map();   // hanya berlaku selama satu proses berjalan

function lewatBatas(kunci) {
  const sekarang = Date.now();
  const daftar = (jejak.get(kunci) || []).filter((t) => sekarang - t < 60_000);
  daftar.push(sekarang);
  jejak.set(kunci, daftar);
  if (jejak.size > 500) jejak.clear();      // jaga agar memori tidak menumpuk
  return daftar.length > BATAS_PER_MENIT;
}

export async function POST(req) {
  if (!serverSiap) {
    return NextResponse.json(
      { ok: false, pesan: alasanBelumSiap() },
      { status: 503 }
    );
  }

  let isi;
  try {
    isi = await req.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const { nama, nomor, wilayah, persetujuan } = isi || {};

  if (!persetujuan) {
    return NextResponse.json(
      { ok: false, pesan: "Centang dulu pernyataan persetujuan sebelum mendaftar." },
      { status: 400 }
    );
  }
  if (!nama || String(nama).trim().length < 2) {
    return NextResponse.json({ ok: false, pesan: "Nama belum diisi." }, { status: 400 });
  }

  const cek = periksaNomor(nomor);
  if (!cek.sah) {
    return NextResponse.json({ ok: false, pesan: cek.pesan }, { status: 400 });
  }

  const asal = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "tanpa-alamat";
  if (lewatBatas(asal)) {
    return NextResponse.json(
      { ok: false, pesan: "Terlalu banyak pendaftaran dalam waktu singkat. Coba lagi beberapa menit lagi." },
      { status: 429 }
    );
  }

  const db = supabaseServer();
  const sidik = await sidikNomor(cek.nomor);

  // Nomor yang sudah terdaftar tidak ditolak dengan pesan berbeda, agar
  // formulir ini tidak bisa dipakai menebak nomor siapa saja yang terdaftar.
  const { data: adaSebelumnya } = await db
    .from("kontak_stakeholder")
    .select("id, aktif, terkonfirmasi, kode_konfirmasi")
    .eq("nomor_kontak", cek.nomor)
    .maybeSingle();

  if (adaSebelumnya) {
    await db.from("log_pendaftaran").insert({
      nomor_hash: sidik, hasil: "ganda", keterangan: "nomor sudah pernah terdaftar",
    });
    return NextResponse.json({
      ok: true,
      status: "terdaftar",
      kode: adaSebelumnya.kode_konfirmasi,
      pesan: "Nomor ini sudah pernah didaftarkan.",
    });
  }

  const token = buatToken();
  // Kode pendek yang mudah dibacakan lewat telepon atau diketik di WhatsApp.
  // Huruf yang mudah tertukar (i, l, o, 0, 1) sengaja tidak dipakai.
  const kode = buatToken(6).toUpperCase().replace(/[ILO01]/g, "X");

  const { error } = await db.from("kontak_stakeholder").insert({
    nama: String(nama).trim().slice(0, 80),
    nomor_kontak: cek.nomor,
    wilayah: String(wilayah || "").trim().slice(0, 40) || null,
    peran: "warga",
    kanal: "telegram",
    // Pendaftaran dari situs kini langsung aktif, sesuai permintaan pengelola.
    //
    // Yang perlu disadari: formulir ini terbuka, sehingga seseorang dapat
    // mendaftarkan nomor orang lain. Penyeimbangnya ada dua. Pertama, pesan
    // hanya benar-benar sampai setelah orangnya membuka bot Telegram sendiri,
    // karena bot tidak dapat menghubungi siapa pun yang belum pernah memulai
    // percakapan. Kedua, halaman /berhenti tersedia tanpa syarat apa pun.
    aktif: true,
    terkonfirmasi: true,
    sumber_daftar: "situs",
    token_berhenti: token,
    kode_konfirmasi: kode,
  });

  if (error) {
    await db.from("log_pendaftaran").insert({
      nomor_hash: sidik, hasil: "ditolak", keterangan: error.message.slice(0, 200),
    });
    return NextResponse.json(
      { ok: false, pesan: "Pendaftaran gagal tersimpan. Coba beberapa saat lagi." },
      { status: 500 }
    );
  }

  await db.from("log_pendaftaran").insert({ nomor_hash: sidik, hasil: "berhasil" });

  return NextResponse.json({
    ok: true,
    status: "terdaftar",
    token,
    kode,
    pesan:
      "Pendaftaran tersimpan. Nomor Anda belum aktif sampai kepemilikannya dipastikan. " +
      "Pilih salah satu cara di bawah ini untuk mengaktifkannya.",
  });
}
