import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer, serverSiap, alasanBelumSiap } from "../../../lib/supabaseServer";
import { obrol, kunciGroq } from "../../../lib/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Peringkas laporan warga untuk dibaca pengelola.
 *
 * BATAS PEMAKAIAN YANG DISENGAJA
 * ------------------------------
 * Model bahasa dipakai di sini karena pekerjaannya memang cocok: teksnya
 * banyak, pembacanya manusia yang paham konteks, dan bila ringkasannya kurang
 * tepat, pengelola masih bisa membuka laporan aslinya.
 *
 * Model bahasa TIDAK dipakai untuk menentukan status saluran maupun menyusun
 * kalimat peringatan yang dikirim ke warga. Pesan kebencanaan harus dapat
 * diprediksi dan diaudit, dan bila suatu saat keliru, harus ada aturan yang
 * dapat ditunjuk dan diperbaiki.
 */

const ARAHAN = `Anda membantu pengelola sistem pemantauan drainase di Kelurahan
Meteseh, Semarang. Tugas Anda HANYA meringkas laporan warga yang diberikan.

Aturan yang wajib dipatuhi:
1. Ringkas HANYA dari laporan yang diberikan. Jangan menambahkan kejadian,
   angka, lokasi, atau kesimpulan yang tidak tertulis di sana.
2. Jangan menilai tingkat bahaya saluran. Penilaian itu dikerjakan sistem lain
   yang memakai data sensor, bukan laporan warga.
3. Jangan memberi arahan evakuasi atau imbauan keselamatan.
4. Bila laporan terlalu sedikit untuk disimpulkan, katakan apa adanya.
5. Tulis dalam Bahasa Indonesia yang lugas.

Keluarkan tiga bagian berikut, masing-masing singkat:

POLA YANG TERLIHAT
(2 sampai 4 kalimat: jenis masalah yang paling sering, wilayah yang paling
sering disebut, apakah ada yang berulang)

PERLU DIDAHULUKAN
(daftar berpoin, paling banyak 4 butir, sebutkan nomor laporannya)

CATATAN
(1 sampai 2 kalimat, boleh kosong bila tidak ada)`;

async function periksaPengelola(req) {
  const otorisasi = req.headers.get("authorization") || "";
  const token = otorisasi.startsWith("Bearer ") ? otorisasi.slice(7) : null;
  if (!token) return { ok: false, pesan: "Belum masuk." };

  const publik = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await publik.auth.getUser(token);
  if (error || !user) return { ok: false, pesan: "Sesi tidak sah atau sudah berakhir." };

  const db = supabaseServer();
  const { data: profil } = await db.from("profil_admin")
    .select("nama, peran, aktif").eq("user_id", user.id).maybeSingle();
  if (!profil?.aktif) return { ok: false, pesan: "Akun ini tidak terdaftar sebagai pengelola." };
  return { ok: true, profil, db };
}

export async function POST(req) {
  if (!serverSiap) {
    return NextResponse.json({ ok: false, pesan: alasanBelumSiap() }, { status: 503 });
  }
  if (!kunciGroq()) {
    return NextResponse.json({
      ok: false,
      pesan: "Fitur ringkasan belum aktif. Isi GROQ_API_KEY di Vercel bila ingin "
           + "memakainya. Tanpa itu, seluruh bagian lain sistem tetap berjalan normal.",
    }, { status: 503 });
  }

  const izin = await periksaPengelola(req);
  if (!izin.ok) return NextResponse.json({ ok: false, pesan: izin.pesan }, { status: 401 });
  const { db } = izin;

  const { data: laporan, error } = await db
    .from("laporan_warga")
    .select("id, waktu, jenis, wilayah, isi, status")
    .order("waktu", { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ ok: false, pesan: error.message }, { status: 500 });
  }
  if (!laporan?.length) {
    return NextResponse.json({ ok: true, ringkasan: "Belum ada laporan warga untuk diringkas." });
  }

  const bahan = laporan.map((l) =>
    `#${l.id} | ${new Date(l.waktu).toLocaleDateString("id-ID")} | ${l.jenis} | `
    + `${l.wilayah || "lokasi tidak disebut"} | status ${l.status}\n${l.isi}`
  ).join("\n\n");

  const hasil = await obrol([
    { role: "system", content: ARAHAN },
    { role: "user", content: `Berikut ${laporan.length} laporan terbaru:\n\n${bahan}` },
  ], { suhu: 0.2, maksToken: 700 });

  if (!hasil.ok) {
    return NextResponse.json({ ok: false, pesan: hasil.sebab }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    ringkasan: hasil.jawab,
    jumlah_laporan: laporan.length,
    model: hasil.model,
  });
}
