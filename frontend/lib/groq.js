/**
 * Penghubung ke Groq untuk obrolan bot.
 *
 * MENGAPA BERKAS TERSENDIRI
 * -------------------------
 * Sebelumnya panggilan ke Groq ditulis langsung di dalam webhook Telegram.
 * Ketika gagal, satu-satunya yang terlihat warga adalah kalimat "maaf, saya
 * sedang tidak bisa mengobrol", sedangkan sebab sesungguhnya hanya tercatat
 * di log Vercel yang jarang dibuka. Akibatnya kerusakan sepele bisa berhari-
 * hari tidak diperbaiki.
 *
 * Berkas ini memisahkan urusan itu, menambahkan dua hal yang dulu tidak ada:
 *
 *   1. Nama model dicoba berurutan. Groq cukup sering memensiunkan model,
 *      dan ketika itu terjadi seluruh obrolan mati meski kunci masih benar.
 *      Bila model yang disetel ditolak, berkas ini menanyakan daftar model
 *      yang tersedia, lalu mencoba lagi.
 *
 *   2. Sebab kegagalan dikembalikan apa adanya, sehingga halaman diagnosa
 *      dapat menampilkannya dan pengelola tahu persis apa yang harus
 *      diperbaiki.
 */

const PANGKALAN = "https://api.groq.com/openai/v1";

// Diurutkan dari yang paling mampu ke yang paling ringan. Bila yang pertama
// sudah dipensiunkan, yang berikutnya dicoba.
const MODEL_CADANGAN = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

export function kunciGroq() {
  return process.env.GROQ_API_KEY || null;
}

/** Daftar model yang benar-benar tersedia pada akun ini. */
export async function daftarModel() {
  const kunci = kunciGroq();
  if (!kunci) return { ok: false, sebab: "GROQ_API_KEY belum diisi." };
  try {
    const r = await fetch(`${PANGKALAN}/models`, {
      headers: { Authorization: `Bearer ${kunci}` },
    });
    const d = await r.json();
    if (!r.ok) {
      return { ok: false, sebab: d?.error?.message || `HTTP ${r.status}` };
    }
    const model = (d?.data || [])
      .map((m) => m.id)
      .filter((id) => !/whisper|tts|guard|vision/i.test(id));
    return { ok: true, model };
  } catch (e) {
    return { ok: false, sebab: "Tidak dapat menghubungi Groq: " + e.message };
  }
}

/**
 * Kirim percakapan ke Groq.
 *
 * Mengembalikan { ok, jawab, model } bila berhasil, atau { ok: false, sebab }
 * yang sudah ditulis dalam kalimat yang dapat dibaca pengelola awam.
 */
export async function obrol(pesan, { suhu = 0.7, maksToken = 500 } = {}) {
  const kunci = kunciGroq();
  if (!kunci) {
    return {
      ok: false,
      sebab: "GROQ_API_KEY belum diisi di Vercel. Isi pada Settings \u2192 "
           + "Environment Variables, lalu terbitkan ulang situs.",
    };
  }

  const disetel = process.env.GROQ_MODEL;
  const urutan = disetel
    ? [disetel, ...MODEL_CADANGAN.filter((m) => m !== disetel)]
    : [...MODEL_CADANGAN];

  let sebabTerakhir = null;

  for (const model of urutan) {
    try {
      const r = await fetch(`${PANGKALAN}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${kunci}`,
        },
        body: JSON.stringify({
          model, temperature: suhu, max_tokens: maksToken, messages: pesan,
        }),
      });

      const d = await r.json();

      if (r.ok) {
        const jawab = d?.choices?.[0]?.message?.content?.trim();
        if (jawab) return { ok: true, jawab, model };
        sebabTerakhir = `Model ${model} membalas kosong.`;
        continue;
      }

      const pesanGalat = String(d?.error?.message || `HTTP ${r.status}`);
      sebabTerakhir = pesanGalat;

      // Kunci salah atau saldo habis tidak akan membaik dengan mengganti
      // model, jadi berhenti di sini daripada mencoba sia-sia tiga kali.
      if (r.status === 401 || r.status === 403) {
        return {
          ok: false,
          sebab: `Groq menolak kunci Anda: ${pesanGalat}. Buat kunci baru di `
               + "console.groq.com, lalu perbarui GROQ_API_KEY di Vercel.",
        };
      }
      if (r.status === 429) {
        return {
          ok: false,
          sebab: `Groq sedang membatasi permintaan: ${pesanGalat}. Coba lagi `
               + "beberapa saat lagi.",
        };
      }
      // Selain itu, kemungkinan besar nama modelnya bermasalah. Coba berikutnya.
    } catch (e) {
      sebabTerakhir = e.message;
    }
  }

  // Seluruh nama model gagal. Tanyakan mana yang sebenarnya tersedia, supaya
  // pengelola tidak perlu menebak.
  const tersedia = await daftarModel();
  const saran = tersedia.ok && tersedia.model?.length
    ? ` Model yang tersedia pada akun Anda: ${tersedia.model.slice(0, 5).join(", ")}. `
      + "Isikan salah satunya pada GROQ_MODEL di Vercel."
    : "";

  return { ok: false, sebab: `${sebabTerakhir || "Tidak diketahui"}.${saran}` };
}
