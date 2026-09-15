import { NextResponse } from "next/server";
import { supabaseServer, serverSiap } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bot Telegram SIGAP Drainase, berjalan sebagai webhook di Vercel.
 *
 * MENGAPA WEBHOOK, BUKAN LONG POLLING
 * -----------------------------------
 * Berkas Python bot/bot_daftar.py memakai long polling: ia harus terus
 * berjalan di sebuah komputer, menanyai Telegram berulang kali. Itu cocok
 * untuk pengujian di laptop, tetapi berarti bot mati begitu laptop ditutup.
 *
 * Sebagai webhook, Telegram yang menghubungi kita setiap ada pesan masuk.
 * Tidak ada yang perlu terus menyala, dan jawabannya seketika. Karena situs
 * ini sudah berjalan di Vercel, bot menumpang di sana tanpa tambahan biaya
 * maupun tambahan tempat.
 *
 * Google Apps Script TIDAK diperlukan. Seluruh kebutuhannya sudah tercukupi
 * oleh Route Handler ini.
 *
 * CARA MEMASANGNYA
 * ----------------
 * Setelah situs terbit di Vercel, jalankan sekali di peramban atau terminal,
 * ganti bagian yang bertanda kurung siku:
 *
 *   https://api.telegram.org/bot[TOKEN]/setWebhook
 *     ?url=https://[ALAMAT-SITUS]/api/telegram
 *     &secret_token=[TELEGRAM_WEBHOOK_SECRET]
 *
 * Untuk memeriksa apakah sudah terpasang:
 *   https://api.telegram.org/bot[TOKEN]/getWebhookInfo
 */

const API = (metode) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${metode}`;

const IKON = { AMAN: "\u{1F7E2}", WASPADA: "\u{1F7E1}", SIAGA: "\u{1F7E0}", KRITIS: "\u{1F534}" };

async function kirim(chatId, teks, tombol) {
  const muatan = {
    chat_id: chatId, text: teks, parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (tombol) muatan.reply_markup = { inline_keyboard: tombol };
  try {
    await fetch(API("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(muatan),
    });
  } catch { /* kegagalan mengirim tidak boleh menggagalkan webhook */ }
}

function waktuLokal(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

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

/* ------------------------------------------------------------- perintah */

async function cmdStart(db, chatId, nama, argumen) {
  // Tautan untuk petugas berbeda dari tautan untuk warga, sehingga peran
  // tersimpan benar tanpa perlu mengisi apa pun.
  const peran = String(argumen || "").toLowerCase().startsWith("bpbd") ? "bpbd" : "warga";

  await db.from("kontak_stakeholder").upsert({
    chat_id: String(chatId),
    nama,
    peran,
    kanal: "telegram",
    aktif: true,
    // Pendaftaran lewat bot langsung terkonfirmasi, karena wargalah yang
    // memulai percakapan. Persetujuannya sudah jelas dengan sendirinya.
    terkonfirmasi: true,
    sumber_daftar: "telegram",
  }, { onConflict: "chat_id" });

  if (peran === "bpbd") {
    return kirim(chatId,
      `Selamat datang, <b>${nama}</b>.\n\n` +
      "Nomor Anda terdaftar sebagai <b>petugas</b> pada sistem SIGAP Drainase.\n\n" +
      "Anda akan menerima laporan teknis otomatis berisi lokasi, tingkat penyumbatan, " +
      "perkiraan volume material, dan saran penanganan setiap kali status naik ke Waspada " +
      "atau lebih.\n\nSetelah pembersihan, mohon isi formulir verifikasi di dasbor. Data " +
      "itulah yang membuat sistem semakin tepat dari bulan ke bulan.");
  }

  return kirim(chatId,
    `Halo <b>${nama}</b>, selamat datang di <b>SIGAP Drainase</b>.\n\n` +
    "Nomor Anda sudah aktif menerima peringatan dini genangan di Kelurahan Mangunharjo.\n\n" +
    "Sensor memantau saluran sepanjang hari. Anda dihubungi otomatis begitu terdeteksi " +
    `${IKON.WASPADA} Waspada, ${IKON.SIAGA} Siaga, atau ${IKON.KRITIS} Kritis. ` +
    "Saat kondisi aman, bot ini diam supaya tidak mengganggu.\n\n" +
    "Perintah yang bisa dipakai kapan saja:\n" +
    "/status \u2014 kondisi saluran sekarang\n" +
    "/prediksi \u2014 ramalan muka air 12 jam\n" +
    "/lapor \u2014 laporkan sampah atau genangan\n" +
    "/mitigasi \u2014 langkah pencegahan\n" +
    "/berhenti \u2014 berhenti menerima peringatan");
}

async function cmdStatus(db, chatId) {
  const { data } = await db.from("status_ai")
    .select("*").order("timestamp", { ascending: false }).limit(1);
  const d = data?.[0];
  if (!d) {
    return kirim(chatId,
      "Belum ada data penilaian. Sensor kemungkinan belum terpasang, atau alur otomatis " +
      "belum pernah berjalan. Sistem memperbarui setiap 30 menit.");
  }

  const keterangan = {
    AMAN: "Saluran mengalir normal. Tidak ada tindakan khusus yang perlu dilakukan.",
    WASPADA: "Saluran mulai menyempit oleh endapan. Belum berbahaya, tetapi perlu diperhatikan.",
    SIAGA: "Aliran melambat. Genangan berpotensi terjadi bila hujan turun.",
    KRITIS: "Saluran tersumbat parah. Genangan sangat mungkin masuk ke jalan dan rumah.",
  }[d.status] || "";

  return kirim(chatId,
    `${IKON[d.status] || "\u26AA"} <b>${d.status}</b>\n${d.saluran_id}\n\n${keterangan}\n\n` +
    `Endapan   : <b>${Math.round((d.rasio_endapan || 0) * 100)}%</b> kedalaman saluran\n` +
    `Aliran air: <b>${Math.round((d.rasio_debit || 0) * 100)}%</b> dari seharusnya\n` +
    `Perkiraan material: <b>${d.estimasi_volume_m3 ?? "-"} m\u00B3</b>` +
    `${d.estimasi_karung ? ` (sekitar ${d.estimasi_karung} karung)` : ""}\n` +
    `Curah hujan: ${d.hujan_mm ?? 0} mm/jam\n\n` +
    `<i>Diperbarui ${waktuLokal(d.timestamp)}</i>`);
}

async function cmdPrediksi(db, chatId) {
  const { data } = await db.from("status_ai")
    .select("ramalan").order("timestamp", { ascending: false }).limit(1);
  let r = data?.[0]?.ramalan;
  if (typeof r === "string") { try { r = JSON.parse(r); } catch { r = null; } }
  if (!r?.waktu?.length) {
    return kirim(chatId,
      "Ramalan belum tersedia. Model membutuhkan data sensor sekitar satu bulan " +
      "sebelum dapat meramal.");
  }

  const kedalaman = 800;
  const baris = ["\u{1F4C8} <b>Ramalan muka air 12 jam ke depan</b>", ""];
  for (let i = 0; i < r.waktu.length; i += 8) {
    const rasio = r.permukaan_mm[i] / kedalaman;
    const ikon = rasio >= 0.85 ? IKON.KRITIS : rasio >= 0.6 ? IKON.SIAGA : IKON.AMAN;
    const bar = "\u2588".repeat(Math.max(1, Math.min(16, Math.round(rasio * 16))));
    baris.push(`${ikon} ${waktuLokal(r.waktu[i]).slice(0, -4)}  ${bar} ${Math.round(rasio * 100)}%`);
  }
  baris.push("", `Puncak ${Math.round((r.rasio_puncak || 0) * 100)}% kedalaman pada ${waktuLokal(r.waktu_puncak)}`);
  if (r.berpotensi_meluap) baris.push("", "\u26A0\uFE0F <b>Saluran berpotensi meluap.</b>");
  baris.push("", "<i>Perkiraan model, bukan kepastian.</i>");
  return kirim(chatId, baris.join("\n"));
}

async function cmdMitigasi(chatId) {
  const baris = ["\u{1F6DF} <b>Mencegah genangan di lingkungan sendiri</b>", "",
    "<b>Sehari-hari:</b>",
    "\u2022 Jangan membuang sampah, sisa makanan, atau minyak jelantah ke saluran.",
    "\u2022 Bersihkan daun dan plastik di mulut saluran depan rumah.",
    "\u2022 Pasang saringan sederhana di lubang pembuangan halaman.",
    "\u2022 Laporkan saluran tersumbat lewat /lapor sebelum menjadi parah.", ""];
  for (const t of ["WASPADA", "SIAGA", "KRITIS"]) {
    baris.push(`<b>Saat status ${t}:</b>`);
    TINDAKAN[t].forEach((x) => baris.push(`\u2022 ${x}`));
    baris.push("");
  }
  baris.push("Darurat: <b>112</b> \u00B7 Basarnas: <b>115</b>");
  return kirim(chatId, baris.join("\n"));
}

async function cmdLapor(db, chatId, nama, isi) {
  if (!isi.trim()) {
    return kirim(chatId,
      "\u{1F4E2} <b>Melaporkan sampah atau genangan</b>\n\n" +
      "Ketik laporan Anda dalam satu pesan setelah perintah ini, contohnya:\n" +
      "<code>/lapor ada kasur menyumbat saluran depan RT 6</code>\n\n" +
      "Laporan Anda diteruskan ke petugas. Sensor hanya memantau satu titik, sehingga " +
      "mata warga tetap menjadi pelengkap yang tidak tergantikan.");
  }

  const { data, error } = await db.from("laporan_warga").insert({
    nama_pelapor: nama,
    kontak: `telegram:${chatId}`,
    jenis: "lainnya",
    isi: isi.trim().slice(0, 1200),
    sumber: "telegram",
    status: "baru",
  }).select("id").single();

  if (error) {
    return kirim(chatId, "Laporan gagal tersimpan. Coba lagi beberapa saat lagi.");
  }

  // Teruskan ke seluruh petugas yang terdaftar.
  const { data: petugas } = await db.from("kontak_stakeholder")
    .select("chat_id").eq("peran", "bpbd").eq("aktif", true).not("chat_id", "is", null);

  const teruskan =
    `\u{1F4E2} <b>Laporan warga</b> (No. ${data.id})\n\n` +
    `Dari  : ${nama}\n` +
    `Waktu : ${waktuLokal(new Date().toISOString())}\n` +
    `Isi   : ${isi.trim().slice(0, 700)}`;

  let terkirim = 0;
  for (const p of petugas || []) {
    await kirim(p.chat_id, teruskan);
    terkirim += 1;
  }

  return kirim(chatId,
    terkirim
      ? `Terima kasih. Laporan Anda (No. ${data.id}) diteruskan ke ${terkirim} petugas.`
      : `Terima kasih. Laporan Anda tercatat dengan nomor ${data.id}. Belum ada petugas ` +
        "terdaftar di sistem, jadi sampaikan juga langsung ke pengurus RT atau RW.");
}

async function cmdBerhenti(db, chatId) {
  await db.from("kontak_stakeholder").update({ aktif: false }).eq("chat_id", String(chatId));
  return kirim(chatId,
    "Anda berhenti menerima peringatan. Ketik /start kapan saja bila ingin bergabung kembali.");
}

async function cmdBantuan(chatId) {
  return kirim(chatId,
    "<b>Perintah SIGAP Drainase</b>\n\n" +
    "/status \u2014 kondisi saluran terkini\n" +
    "/prediksi \u2014 ramalan muka air 12 jam\n" +
    "/lapor \u2014 laporkan sampah atau genangan\n" +
    "/mitigasi \u2014 langkah pencegahan\n" +
    "/berhenti \u2014 berhenti menerima peringatan\n\n" +
    "Peringatan dikirim otomatis hanya saat status Waspada ke atas.");
}

/* -------------------------------------------------------------- webhook */

export async function POST(req) {
  // Telegram menyertakan secret_token pada setiap permintaan. Tanpa
  // pemeriksaan ini, siapa pun yang tahu alamat webhook dapat mengirim
  // pesan palsu seolah-olah berasal dari Telegram.
  const rahasia = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (rahasia && req.headers.get("x-telegram-bot-api-secret-token") !== rahasia) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!serverSiap || !process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: true });     // jangan biarkan Telegram mengulang terus
  }

  let pembaruan;
  try { pembaruan = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const pesan = pembaruan?.message || pembaruan?.edited_message;
  if (!pesan?.text) return NextResponse.json({ ok: true });

  const chatId = pesan.chat.id;
  const nama = pesan.from?.first_name || "Warga";
  const teks = pesan.text.trim();
  const db = supabaseServer();

  try {
    if (!teks.startsWith("/")) {
      await kirim(chatId,
        "Ketik /bantuan untuk melihat daftar perintah, atau /lapor untuk melaporkan " +
        "sampah dan genangan.");
      return NextResponse.json({ ok: true });
    }

    const [kepala, ...sisa] = teks.split(/\s+/);
    const perintah = kepala.slice(1).split("@")[0].toLowerCase();
    const argumen = sisa.join(" ");

    switch (perintah) {
      case "start":    await cmdStart(db, chatId, nama, argumen); break;
      case "daftar":   await cmdStart(db, chatId, nama, ""); break;
      case "status":   await cmdStatus(db, chatId); break;
      case "prediksi": await cmdPrediksi(db, chatId); break;
      case "mitigasi": await cmdMitigasi(chatId); break;
      case "lapor":    await cmdLapor(db, chatId, nama, argumen); break;
      case "berhenti":
      case "stop":     await cmdBerhenti(db, chatId); break;
      case "bantuan":
      case "help":     await cmdBantuan(chatId); break;
      default:
        await kirim(chatId, `Perintah /${perintah} tidak dikenal. Ketik /bantuan.`);
    }
  } catch (e) {
    console.error("webhook telegram:", e);
    await kirim(chatId, "Terjadi gangguan saat memproses. Coba lagi sebentar lagi.");
  }

  // Telegram selalu diberi jawaban berhasil. Bila kita menjawab gagal, ia akan
  // mengirim ulang pesan yang sama berkali-kali.
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    keterangan: "Webhook bot Telegram SIGAP Drainase. Kirim pembaruan melalui POST.",
  });
}
