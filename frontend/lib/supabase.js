import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const belumDikonfigurasi = !url || !key || url.includes("xxxx");

// Klien tetap dibuat meski konfigurasi kosong, supaya halaman tidak
// langsung rusak. Pesan yang jelas ditampilkan di antarmuka.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder"
);

export const STATUS = {
  AMAN:    { warna: "#2fd08a", label: "Aman",    urut: 0 },
  WASPADA: { warna: "#ffb020", label: "Waspada", urut: 1 },
  SIAGA:   { warna: "#ff8a3d", label: "Siaga",   urut: 2 },
  KRITIS:  { warna: "#ff4a5f", label: "Kritis",  urut: 3 },
};

export const KETERANGAN = {
  AMAN: "Saluran mengalir normal. Tidak ada tindakan khusus yang perlu dilakukan.",
  WASPADA: "Endapan mulai menyempitkan saluran. Air masih mengalir, tetapi kapasitasnya berkurang.",
  SIAGA: "Aliran melambat karena penyumbatan. Genangan berpotensi terjadi bila hujan turun.",
  KRITIS: "Saluran tersumbat parah dan air nyaris tidak mengalir. Genangan sangat mungkin masuk ke jalan.",
};

export function jam(iso) {
  if (!iso) return "—";
  const t = new Date(iso);
  if (isNaN(t)) return "—";
  return t.toLocaleString("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }) + " WIB";
}

export function selisih(iso) {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (isNaN(m)) return "—";
  if (m < 2) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const j = Math.floor(m / 60);
  return j < 24 ? `${j} jam lalu` : `${Math.floor(j / 24)} hari lalu`;
}

export function keArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
  return [];
}

export function keObjek(v) {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
  return null;
}


/* ------------------------------------------------------------------ sesi */

/**
 * Ambil profil pengelola untuk pengguna yang sedang masuk.
 *
 * Mengembalikan null bila belum masuk, atau bila akunnya ada di Supabase Auth
 * tetapi belum didaftarkan pada tabel profil_admin. Perbedaan itu penting:
 * punya akun tidak sama dengan punya wewenang.
 */
export async function ambilProfil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profil_admin")
    .select("user_id, nama, peran, wilayah, aktif, foto_url, jabatan, nomor_kontak")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error || !data || !data.aktif) return null;
  return { ...data, email: session.user.email };
}

export const LABEL_PERAN = {
  admin: "Administrator",
  kader: "Kader Siaga Drainase",
  bpbd: "Petugas BPBD",
  kelurahan: "Perangkat Kelurahan",
};

export const LABEL_STATUS_LAPORAN = {
  baru: "Baru",
  diproses: "Sedang ditangani",
  selesai: "Selesai",
  bukan_masalah: "Bukan masalah",
};

export const WARNA_STATUS_LAPORAN = {
  baru: "#ff8a3d",
  diproses: "#1b7fa8",
  selesai: "#2fd08a",
  bukan_masalah: "#9a9a9a",
};
