import { createClient } from "@supabase/supabase-js";

/**
 * Klien Supabase untuk sisi SERVER saja.
 *
 * Memakai kunci service_role, yang dapat membaca dan menulis seluruh tabel
 * tanpa dibatasi Row Level Security. Kunci ini TIDAK BOLEH memakai awalan
 * NEXT_PUBLIC_, karena awalan itu membuat Next.js menyisipkan nilainya ke
 * dalam berkas yang diunduh peramban. Siapa pun yang membuka situs akan
 * dapat membacanya, dan dengan itu membaca seluruh nomor warga.
 *
 * Berkas ini hanya boleh diimpor dari Route Handler atau Server Component.
 */
// Nama SUPABASE_SERVICE_ROLE_KEY adalah yang utama. Namun banyak pemasangan
// terlanjur memakai nama SUPABASE_KEY, karena itulah nama yang dipakai alur
// Python di GitHub Actions. Keduanya diterima agar tidak perlu mengisi nilai
// yang sama dua kali dengan nama berbeda.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

export const serverSiap = Boolean(url && kunci);

/** Keterangan tepat mengenai apa yang belum diisi, agar tidak menebak-nebak. */
export function alasanBelumSiap() {
  const kurang = [];
  if (!url) kurang.push("NEXT_PUBLIC_SUPABASE_URL (atau SUPABASE_URL)");
  if (!kunci) kurang.push("SUPABASE_SERVICE_ROLE_KEY (atau SUPABASE_KEY)");
  if (!kurang.length) return null;
  return "Belum diisi di Vercel: " + kurang.join(" dan ") +
         ". Isi pada Settings \u2192 Environment Variables, lalu terbitkan ulang situs.";
}

export function supabaseServer() {
  if (!serverSiap) {
    throw new Error(alasanBelumSiap());
  }
  return createClient(url, kunci, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sidik nomor, dipakai pada catatan pendaftaran agar nomor asli tidak tersimpan dua kali. */
export async function sidikNomor(nomor) {
  const data = new TextEncoder().encode("sigap:" + nomor);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** Token acak untuk tautan berhenti berlangganan. */
export function buatToken(panjang = 24) {
  const huruf = "abcdefghijkmnopqrstuvwxyz23456789";
  const acak = crypto.getRandomValues(new Uint8Array(panjang));
  return Array.from(acak, (b) => huruf[b % huruf.length]).join("");
}
