import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer, serverSiap, alasanBelumSiap } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Peringkas laporan warga memakai Grok (xAI).
 *
 * BATAS PEMAKAIAN YANG DISENGAJA
 * ------------------------------
 * Model bahasa dipakai di SATU tempat saja, yaitu meringkas laporan warga
 * untuk dibaca pengelola. Itu pekerjaan yang cocok baginya: teksnya banyak,
 * pembacanya manusia yang paham konteks, dan bila ringkasannya kurang tepat,
 * pengelola masih bisa membuka laporan aslinya.
 *
 * Model bahasa TIDAK dipakai untuk:
 *   - menentukan status saluran, karena itu tugas matriks aturan yang dapat
 *     dibaca dan diperiksa manusia;
 *   - menyusun kalimat peringatan yang dikirim ke warga, karena pesan
 *     kebencanaan harus dapat diprediksi, diaudit, dan tidak boleh mengarang.
 *
 * Bila suatu saat model ini mengarang, akibatnya hanya ringkasan yang keliru
 * di layar pengelola, bukan warga yang mengungsi tanpa sebab.
 *
 * Berkas ini mati dengan sendirinya bila XAI_API_KEY belum diisi. Tidak ada
 * bagian sistem lain yang bergantung padanya.
 */

const API_XAI = "https://api.x.ai/v1/chat/completions";

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

const ARAHAN = `Anda membantu pengelola sistem pemantauan drainase di Kelurahan
Meteseh, Semarang. Tugas Anda HANYA meringkas laporan warga yang diberikan.

Aturan yang wajib dipatuhi:
1. Ringkas HANYA dari laporan yang diberikan. Jangan menambahkan kejadian,
   angka, lokasi, atau kesimpulan yang tidak tertulis di sana.
2. Jangan menilai tingkat bahaya saluran. Penilaian itu dikerjakan sistem lain
   yang memakai data sensor, bukan laporan warga.
3. Jangan memberi arahan evakuasi atau imbauan keselamatan.
4. Bila laporan terlalu sedikit untuk disimpulkan, katakan apa adanya.
5. Tulis dalam Bahasa Indonesia yang lugas, tanpa istilah asing yang tidak perlu.

Keluarkan tiga bagian berikut, masing-masing singkat:

POLA YANG TERLIHAT
(2 sampai 4 kalimat: jenis masalah yang paling sering, wilayah yang paling
sering disebut, apakah ada yang berulang)

PERLU DIDAHULUKAN
(daftar berpoin, paling banyak 4 butir, sebutkan nomor laporannya)

CATATAN
(1 sampai 2 kalimat, boleh kosong bila tidak ada)`;

export async function POST(req) {
  if (!serverSiap) {
    return NextResponse.json({ ok: false, pesan: alasanBelumSiap() }, { status: 503 });
  }
  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({
      ok: false,
      pesan: "Fitur ringkasan belum aktif. Isi XAI_API_KEY di Vercel bila ingin memakainya. " +
             "Tanpa itu, seluruh bagian lain sistem tetap berjalan normal.",
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
    `#${l.id} | ${new Date(l.waktu).toLocaleDateString("id-ID")} | ${l.jenis} | ` +
    `${l.wilayah || "lokasi tidak disebut"} | status ${l.status}\n${l.isi}`
  ).join("\n\n");

  try {
    const r = await fetch(API_XAI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.XAI_MODEL || "grok-4.6",
        temperature: 0.2,          // rendah, karena yang diminta ringkasan setia, bukan karangan
        max_tokens: 700,
        messages: [
          { role: "system", content: ARAHAN },
          { role: "user", content: `Berikut ${laporan.length} laporan terbaru:\n\n${bahan}` },
        ],
      }),
    });

    const hasil = await r.json();

    if (!r.ok) {
      // Kesalahan dari xAI dikembalikan apa adanya, karena biasanya menyebut
      // sebabnya dengan jelas: kunci salah, saldo habis, atau nama model
      // sudah berganti.
      const sebab = hasil?.error?.message || hasil?.error || `HTTP ${r.status}`;
      return NextResponse.json({
        ok: false,
        pesan: `Grok menolak permintaan: ${sebab}. ` +
               "Bila keterangannya menyebut model, periksa nama model terbaru di " +
               "docs.x.ai lalu isikan pada XAI_MODEL di Vercel.",
      }, { status: 502 });
    }

    const teks = hasil?.choices?.[0]?.message?.content?.trim();
    if (!teks) {
      return NextResponse.json({ ok: false, pesan: "Grok membalas kosong." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      ringkasan: teks,
      jumlah_laporan: laporan.length,
      model: hasil?.model || process.env.XAI_MODEL || "grok-4.6",
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      pesan: "Tidak dapat menghubungi Grok: " + e.message,
    }, { status: 502 });
  }
}
