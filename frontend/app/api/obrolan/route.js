import { NextResponse } from "next/server";
import { obrol, daftarModel, kunciGroq } from "../../../lib/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Halaman pemeriksa obrolan bot.
 *
 * Buka https://ALAMAT-SITUS/api/obrolan di peramban. Halaman ini benar-benar
 * memanggil Groq dengan satu pertanyaan pendek, lalu menampilkan hasilnya
 * apa adanya.
 *
 * Bedanya dengan menebak-nebak dari log: di sini Anda langsung melihat apakah
 * kuncinya diterima, model mana yang berhasil dipakai, dan bila gagal, apa
 * kalimat penolakan dari Groq. Nilai kunci tidak pernah ditampilkan, jadi
 * aman dibuka siapa pun.
 */
export async function GET() {
  const ada = Boolean(kunciGroq());

  if (!ada) {
    return NextResponse.json({
      keterangan: "Pemeriksa obrolan bot SIGAP Drainase",
      siap: false,
      GROQ_API_KEY: false,
      saran: [
        "GROQ_API_KEY belum diisi di Vercel.",
        "Buka console.groq.com \u2192 API Keys \u2192 Create API Key.",
        "Salin ke Vercel: Settings \u2192 Environment Variables \u2192 GROQ_API_KEY.",
        "Setelah disimpan, buka tab Deployments lalu tekan Redeploy. " +
        "Nilai baru hanya terbaca pada penerbitan berikutnya.",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const model = await daftarModel();

  const uji = await obrol([
    { role: "system", content: "Jawab sangat singkat, satu kalimat saja, dalam Bahasa Indonesia." },
    { role: "user", content: "Halo, apakah kamu bisa menjawab?" },
  ], { suhu: 0.2, maksToken: 60 });

  const saran = [];
  if (uji.ok) {
    saran.push(`Obrolan berjalan normal memakai model ${uji.model}.`);
    if (process.env.GROQ_MODEL && process.env.GROQ_MODEL !== uji.model) {
      saran.push(
        `GROQ_MODEL Anda disetel "${process.env.GROQ_MODEL}", tetapi yang ` +
        `berhasil dipakai adalah "${uji.model}". Sebaiknya perbarui GROQ_MODEL ` +
        "di Vercel agar tidak perlu mencoba dua kali setiap pesan masuk.");
    }
  } else {
    saran.push(uji.sebab);
    if (model.ok && model.model?.length) {
      saran.push("Model yang tersedia pada akun Anda: " + model.model.slice(0, 8).join(", "));
    }
  }

  return NextResponse.json({
    keterangan: "Pemeriksa obrolan bot SIGAP Drainase",
    siap: uji.ok,
    GROQ_API_KEY: true,
    GROQ_MODEL_disetel: process.env.GROQ_MODEL || "(kosong, memakai bawaan)",
    model_terpakai: uji.ok ? uji.model : null,
    model_tersedia: model.ok ? model.model : model.sebab,
    jawaban_uji: uji.ok ? uji.jawab : null,
    sebab_gagal: uji.ok ? null : uji.sebab,
    saran,
  }, { headers: { "Cache-Control": "no-store" } });
}
