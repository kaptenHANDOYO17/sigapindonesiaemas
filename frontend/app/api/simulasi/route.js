import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer, serverSiap } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengiriman notifikasi dari halaman simulasi.
 *
 * DUA HAL YANG DIJAGA KETAT DI SINI
 * ---------------------------------
 * 1. Yang boleh memanggil hanya pengelola yang sudah masuk. Menyembunyikan
 *    tombol di peramban sama sekali bukan pengamanan; siapa pun dapat
 *    memanggil alamat ini langsung. Karena itu sesi pengguna diperiksa di
 *    sisi server, lalu dicocokkan dengan tabel profil_admin.
 *
 * 2. Setiap pesan simulasi WAJIB diawali penanda uji coba. Mengirim peringatan
 *    banjir yang terlihat sungguhan kepada warga, padahal hanya latihan, akan
 *    membuat mereka panik tanpa sebab, dan pada peringatan berikutnya mereka
 *    tidak akan percaya lagi. Penanda itu tidak dapat dimatikan dari antarmuka.
 */

const IKON = { AMAN: "\u{1F7E2}", WASPADA: "\u{1F7E1}", SIAGA: "\u{1F7E0}", KRITIS: "\u{1F534}" };

const TINDAKAN = {
  WASPADA: [
    "Jangan membuang sampah, sisa makanan, atau minyak jelantah ke saluran.",
    "Bersihkan daun dan plastik di mulut saluran depan rumah.",
  ],
  SIAGA: [
    "Naikkan barang berharga dan dokumen penting ke tempat lebih tinggi.",
    "Pindahkan kendaraan ke lokasi yang tidak tergenang.",
    "Siapkan tas berisi obat, senter, dan dokumen dalam plastik kedap air.",
  ],
  KRITIS: [
    "Utamakan keselamatan jiwa, bukan barang.",
    "Matikan aliran listrik dari MCB utama sebelum air masuk rumah.",
    "Jangan menerjang genangan yang mengalir deras atau lebih tinggi dari lutut.",
    "Dahulukan lansia, anak kecil, dan penyandang disabilitas menuju tempat aman.",
  ],
};

const PENANDA =
  "\u{1F9EA} <b>UJI COBA SISTEM \u2014 BUKAN PERINGATAN SUNGGUHAN</b>\n" +
  "<i>Pesan ini dikirim dari halaman simulasi untuk menguji jalur notifikasi. " +
  "Tidak ada kondisi berbahaya yang sedang terjadi. Abaikan isinya.</i>\n" +
  "\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\n\n";

async function periksaPengelola(req) {
  const otorisasi = req.headers.get("authorization") || "";
  const token = otorisasi.startsWith("Bearer ") ? otorisasi.slice(7) : null;
  if (!token) return { ok: false, pesan: "Belum masuk." };

  const publik = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await publik.auth.getUser(token);
  if (error || !user) return { ok: false, pesan: "Sesi tidak sah atau sudah berakhir." };

  const db = supabaseServer();
  const { data: profil } = await db
    .from("profil_admin")
    .select("nama, peran, aktif")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profil || !profil.aktif) {
    return { ok: false, pesan: "Akun ini tidak terdaftar sebagai pengelola." };
  }
  return { ok: true, profil, db };
}

function susunPesanWarga(h) {
  const judul = {
    WASPADA: "SALURAN MULAI MENYEMPIT",
    SIAGA: "SALURAN TERSUMBAT, WASPADA GENANGAN",
    KRITIS: "SALURAN TERSUMBAT PARAH, SIAP-SIAP",
  }[h.status];

  const baris = [
    `${IKON[h.status]} <b>${judul}</b>`,
    `Saluran ${h.saluran_id}`,
    "",
    h.alasan,
    "",
    `Saluran terisi endapan sekitar <b>${Math.round(h.rasio_endapan * 100)} persen</b> ` +
    `dari kedalamannya, dan aliran air tinggal <b>${Math.round(h.rasio_debit * 100)} persen</b> ` +
    "dari yang seharusnya.",
    "",
    "<b>Yang perlu dilakukan sekarang:</b>",
  ];
  TINDAKAN[h.status].forEach((t, i) => baris.push(`${i + 1}. ${t}`));
  baris.push("", "\u26A1 <b>Keselamatan kelistrikan:</b> matikan MCB sebelum air masuk rumah, " +
                 "cabut peralatan dari stop kontak, dan naikkan barang elektronik.");
  baris.push("", "<i>Angka ini perkiraan sistem. Tetap ikuti arahan BPBD dan aparat setempat.</i>");
  return baris.join("\n");
}

function susunPesanPetugas(h) {
  return [
    `${IKON[h.status]} <b>LAPORAN OTOMATIS \u00B7 STATUS ${h.status}</b>`,
    "",
    `Lokasi   : ${h.saluran_id}`,
    `Endapan  : ${Math.round(h.rasio_endapan * 100)}% kedalaman (${Math.round(h.rasio_endapan * 800)} mm dari 800 mm)`,
    `Aliran   : ${Math.round(h.rasio_debit * 100)}% dari yang seharusnya`,
    `Muka air : ${Math.round(h.rasio_air * 100)}% kedalaman`,
    `Material : ${h.volume.tengah} m\u00B3 (rentang ${h.volume.bawah}\u2013${h.volume.atas}), sekitar ${h.volume.karung} karung`,
    "",
    `Alasan   : ${h.alasan}`,
    "",
    "Tindakan : " + (h.status === "KRITIS"
      ? "pengerukan segera, siapkan karung dan angkutan"
      : h.status === "SIAGA"
        ? "jadwalkan pengerukan dalam waktu dekat"
        : "pantau, belum perlu pengerukan"),
    "",
    "<i>Perkiraan dari satu titik sensor. Kondisi sebenarnya dapat berbeda di sepanjang saluran.</i>",
  ].join("\n");
}

export async function POST(req) {
  if (!serverSiap || !process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { ok: false, pesan: "Token bot Telegram atau kunci Supabase belum diatur di server." },
      { status: 503 });
  }

  const izin = await periksaPengelola(req);
  if (!izin.ok) return NextResponse.json({ ok: false, pesan: izin.pesan }, { status: 401 });
  const { db, profil } = izin;

  let isi;
  try { isi = await req.json(); } catch {
    return NextResponse.json({ ok: false, pesan: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const { hasil, sasaran } = isi || {};
  if (!hasil?.status || hasil.status === "AMAN") {
    return NextResponse.json(
      { ok: false, pesan: "Status AMAN tidak mengirim pesan apa pun, sama seperti sistem sungguhan." },
      { status: 400 });
  }
  if (!["petugas", "semua"].includes(sasaran)) {
    return NextResponse.json({ ok: false, pesan: "Sasaran tidak dikenal." }, { status: 400 });
  }

  let kueri = db.from("kontak_stakeholder")
    .select("nama, chat_id, peran")
    .eq("aktif", true).eq("terkonfirmasi", true)
    .not("chat_id", "is", null);
  if (sasaran === "petugas") kueri = kueri.eq("peran", "bpbd");

  const { data: penerima, error } = await kueri;
  if (error) {
    return NextResponse.json({ ok: false, pesan: error.message }, { status: 500 });
  }
  if (!penerima?.length) {
    return NextResponse.json({
      ok: true, terkirim: 0,
      pesan: sasaran === "petugas"
        ? "Belum ada petugas BPBD terdaftar di Telegram, jadi tidak ada yang dikirimi."
        : "Belum ada penerima terdaftar di Telegram, jadi tidak ada yang dikirimi.",
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  let terkirim = 0, gagal = 0;

  for (const p of penerima) {
    const badan = p.peran === "bpbd" ? susunPesanPetugas(hasil) : susunPesanWarga(hasil);
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: p.chat_id,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          text: PENANDA + badan,
        }),
      });
      (r.ok ? terkirim++ : gagal++);
    } catch { gagal++; }
  }

  await db.from("log_notifikasi").insert({
    saluran_id: hasil.saluran_id || "MGH-01",
    status: hasil.status,
    kanal: "telegram",
    jumlah_penerima: terkirim,
    keterangan: `SIMULASI oleh ${profil.nama}, sasaran ${sasaran}` +
                (gagal ? `, ${gagal} gagal terkirim` : ""),
  }).then(() => {}, () => {});   // kegagalan mencatat tidak membatalkan pengiriman

  return NextResponse.json({
    ok: true, terkirim, gagal,
    pesan: `Pesan uji coba terkirim ke ${terkirim} penerima` +
           (gagal ? `, ${gagal} gagal.` : ".") +
           " Setiap pesan diawali penanda bahwa ini bukan peringatan sungguhan.",
  });
}
