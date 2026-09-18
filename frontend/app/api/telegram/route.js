import { NextResponse } from "next/server";
import { supabaseServer, serverSiap, alasanBelumSiap } from "../../../lib/supabaseServer";

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

// Dipakai pada perintah yang menyebut tautan situs. Diambil dari Environment
// Variable agar tidak perlu mengubah kode ketika alamatnya berganti.
const SITUS = (process.env.NEXT_PUBLIC_SITUS_URL ||
               "https://sigapindonesiaemas.vercel.app").replace(/\/$/, "");

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
  const arg = String(argumen || "").trim();
  const peran = arg.toLowerCase().startsWith("bpbd") ? "bpbd" : "warga";

  // Bila argumennya berupa kode enam huruf, berarti orang ini datang dari
  // tautan yang muncul setelah mengisi formulir di situs. Cocokkan kodenya,
  // lalu tempelkan chat_id pada baris yang sudah ada.
  //
  // Langkah ini diperlukan karena bot Telegram TIDAK DAPAT menghubungi
  // siapa pun hanya berbekal nomor telepon. Telegram baru mengizinkan bot
  // mengirim pesan setelah orang yang bersangkutan memulai percakapan, dan
  // yang dipakai untuk mengirim adalah chat_id, bukan nomor.
  const kode = /^[A-Za-z0-9]{6}$/.test(arg) ? arg.toUpperCase() : null;
  if (kode) {
    const { data: cocok } = await db.from("kontak_stakeholder")
      .select("id, nama, nomor_kontak")
      .eq("kode_konfirmasi", kode)
      .maybeSingle();

    if (cocok) {
      await db.from("kontak_stakeholder").update({
        chat_id: String(chatId),
        kanal: "telegram",
        aktif: true,
        terkonfirmasi: true,
        dikonfirmasi_pada: new Date().toISOString(),
        dikonfirmasi_oleh: "tautan pendaftaran situs",
      }).eq("id", cocok.id);

      return kirim(chatId,
        `Halo <b>${cocok.nama || nama}</b>, pendaftaran Anda sudah lengkap.\n\n` +
        "Nomor Anda kini tersambung dengan bot ini dan aktif menerima peringatan dini " +
        "genangan di Kelurahan Meteseh.\n\n" +
        "Ketik /bantuan untuk melihat apa saja yang bisa saya lakukan, atau tanyakan " +
        "apa saja dengan bahasa biasa.");
    }
  }

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
    "Nomor Anda sudah aktif menerima peringatan dini genangan di Kelurahan Meteseh.\n\n" +
    "Sensor memantau saluran sepanjang hari. Anda dihubungi otomatis begitu terdeteksi " +
    `${IKON.WASPADA} Waspada, ${IKON.SIAGA} Siaga, atau ${IKON.KRITIS} Kritis. ` +
    "Saat kondisi aman, bot ini diam supaya tidak mengganggu.\n\n" +
    "Perintah yang bisa dipakai kapan saja:\n" +
    "/status \u2014 kondisi saluran sekarang\n" +
    "/prediksi \u2014 ramalan muka air 12 jam\n" +
    "/riwayat \u2014 kejadian tujuh hari terakhir\n" +
    "/lapor \u2014 laporkan sampah atau genangan\n" +
    "/mitigasi \u2014 langkah pencegahan genangan\n" +
    "/lokasi \u2014 titik sensor dan ukuran saluran\n" +
    "/dashboard \u2014 buka situs SIGAP\n" +
    "/berhenti \u2014 berhenti menerima peringatan\n\n" +
    "Anda juga boleh langsung bertanya dengan bahasa biasa. Saya bisa diajak " +
    "mengobrol soal saluran, kebersihan lingkungan, dan menjaga kesehatan " +
    "setelah genangan surut.");
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
    "/riwayat \u2014 kejadian tujuh hari terakhir\n" +
    "/lapor \u2014 laporkan sampah atau genangan\n" +
    "/mitigasi \u2014 langkah pencegahan genangan\n" +
    "/lokasi \u2014 titik sensor dan ukuran saluran\n" +
    "/daftar \u2014 mulai terima peringatan\n" +
    "/berhenti \u2014 berhenti terima peringatan\n" +
    "/dashboard \u2014 buka situs SIGAP\n" +
    "/lupakan \u2014 hapus ingatan obrolan kita\n\n" +
    "Anda juga bisa langsung mengetik pertanyaan dengan bahasa biasa, tanpa perintah. " +
    "Contohnya: <i>saluran depan rumah saya gimana ya?</i>\n\n" +
    "Peringatan dikirim otomatis hanya saat status Waspada ke atas.");
}



async function cmdRiwayat(db, chatId) {
  const sejak = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data } = await db.from("status_ai")
    .select("status, timestamp, rasio_endapan, estimasi_volume_m3")
    .gte("timestamp", sejak)
    .order("timestamp", { ascending: false })
    .limit(400);

  if (!data?.length) {
    return kirim(chatId, "Belum ada catatan tujuh hari terakhir. Sensor kemungkinan " +
                         "belum terpasang, atau sistem baru mulai berjalan.");
  }

  // Ringkas menjadi per hari, dan sebutkan status terparah pada hari itu.
  const urut = { AMAN: 0, WASPADA: 1, SIAGA: 2, KRITIS: 3 };
  const perHari = new Map();
  for (const b of data) {
    const hari = new Date(b.timestamp).toLocaleDateString("id-ID",
      { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
    const lama = perHari.get(hari);
    if (!lama || urut[b.status] > urut[lama.status]) {
      perHari.set(hari, { status: b.status, endapan: b.rasio_endapan });
    }
  }

  const baris = ["\u{1F4C5} <b>Kejadian tujuh hari terakhir</b>", "",
                 "Yang ditampilkan adalah status terparah pada setiap hari.", ""];
  for (const [hari, d] of perHari) {
    baris.push(`${IKON[d.status] || "\u26AA"} <b>${hari}</b> \u2014 ${d.status}` +
               (d.endapan != null ? ` (endapan ${Math.round(d.endapan * 100)}%)` : ""));
  }

  const berbahaya = [...perHari.values()].filter((d) => d.status === "SIAGA" || d.status === "KRITIS").length;
  baris.push("", berbahaya
    ? `Ada <b>${berbahaya} hari</b> berstatus Siaga atau Kritis dalam sepekan ini.`
    : "Tidak ada hari berstatus Siaga maupun Kritis dalam sepekan ini.");
  baris.push("", `Selengkapnya di dasbor: ${SITUS}`);
  return kirim(chatId, baris.join("\n"));
}


async function cmdLokasi(db, chatId) {
  const { data } = await db.from("peta_sensor")
    .select("kode, nama, alamat, lat, lon, terpasang, status, kedalaman_saluran_mm")
    .order("kode");

  if (!data?.length) {
    return kirim(chatId, "Data titik sensor belum diisi. Hubungi pengelola.");
  }

  const baris = ["\u{1F4CD} <b>Titik pantau SIGAP Drainase</b>", ""];
  for (const t of data) {
    baris.push(`${IKON[t.status] || "\u26AA"} <b>${t.kode} \u2014 ${t.nama}</b>`);
    if (t.alamat) baris.push(`   ${t.alamat}`);
    baris.push(`   Kedalaman saluran: ${t.kedalaman_saluran_mm} mm`);
    baris.push(`   Status: ${t.status || "belum ada data"}` +
               (t.terpasang ? "" : " \u00b7 <i>alat belum terpasang</i>"));
    baris.push(`   Peta: https://www.google.com/maps?q=${t.lat},${t.lon}`);
    baris.push("");
  }
  baris.push(`Peta lengkap beserta statusnya: ${SITUS}/peta`);
  return kirim(chatId, baris.join("\n"));
}


async function cmdDashboard(chatId) {
  return kirim(chatId,
    "\u{1F5A5}\uFE0F <b>Situs SIGAP Drainase</b>\n\n" +
    `Dasbor kondisi saluran:\n${SITUS}\n\n` +
    `Peta titik sensor:\n${SITUS}/peta\n\n` +
    `Laporkan sampah atau genangan:\n${SITUS}/lapor\n\n` +
    `Cara kerja dan hasil pengujian:\n${SITUS}/tentang`);
}

/* ------------------------------------------------------------- obrolan */

/**
 * Menjawab pesan biasa dengan bahasa santai, memakai Grok.
 *
 * PAGAR PENGAMAN YANG DIPASANG DI SINI
 * ------------------------------------
 * Kondisi saluran terkini diambil lebih dulu dari basis data, lalu
 * disisipkan ke dalam arahan. Model tidak diminta menebak apa pun; ia hanya
 * boleh menyampaikan ulang angka yang sudah diberikan. Tanpa ini, model akan
 * mengarang angka endapan ketika ditanya, dan warga akan memercayainya.
 *
 * Model juga dilarang memberi keputusan evakuasi. Untuk keadaan darurat, ia
 * diarahkan menyebut nomor 112. Menyerahkan keputusan semacam itu kepada
 * model bahasa bukanlah risiko yang pantas diambil demi bahasa yang lebih
 * luwes.
 *
 * Bila XAI_API_KEY belum diisi, bot menjawab dengan petunjuk perintah biasa.
 * Tidak ada bagian lain yang bergantung pada fitur ini.
 */
function penyediaObrolan() {
  // Groq didahulukan karena gratis pada tingkat pemakaian wajar, dan
  // jawabannya cepat. xAI dipakai bila Groq tidak diisi.
  if (process.env.GROQ_API_KEY) {
    return {
      nama: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      kunci: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    };
  }
  if (process.env.XAI_API_KEY) {
    return {
      nama: "xai",
      url: "https://api.x.ai/v1/chat/completions",
      kunci: process.env.XAI_API_KEY,
      model: process.env.XAI_MODEL || "grok-4.6",
    };
  }
  return null;
}


async function cmdObrol(db, chatId, nama, teks) {
  const penyedia = penyediaObrolan();
  if (!penyedia) {
    return kirim(chatId,
      "Saya belum bisa mengobrol bebas. Yang bisa saya bantu sekarang:\n\n" +
      "/status \u2014 kondisi saluran sekarang\n" +
      "/prediksi \u2014 ramalan muka air 12 jam\n" +
      "/lapor \u2014 laporkan sampah atau genangan\n" +
      "/mitigasi \u2014 langkah pencegahan");
  }

  // Ambil kondisi sungguhan, agar model punya angka dan tidak perlu menebak.
  const { data } = await db.from("status_ai")
    .select("status, alasan, rasio_endapan, rasio_debit, estimasi_volume_m3, hujan_mm, timestamp")
    .order("timestamp", { ascending: false }).limit(1);
  const d = data?.[0];

  const kondisi = d
    ? `Status: ${d.status}\n` +
      `Endapan: ${Math.round((d.rasio_endapan || 0) * 100)} persen kedalaman saluran\n` +
      `Aliran: ${Math.round((d.rasio_debit || 0) * 100)} persen dari seharusnya\n` +
      `Perkiraan material: ${d.estimasi_volume_m3 ?? "tidak diketahui"} meter kubik\n` +
      `Curah hujan: ${d.hujan_mm ?? 0} mm per jam\n` +
      `Alasan penilaian: ${d.alasan}\n` +
      `Diperbarui: ${waktuLokal(d.timestamp)}`
    : "Belum ada data penilaian tersimpan. Sensor kemungkinan belum terpasang.";

  // Ambil percakapan sebelumnya, supaya bot tidak memperlakukan setiap
  // pesan sebagai perkenalan baru. Sepuluh giliran terakhir sudah cukup:
  // lebih dari itu hanya menambah biaya tanpa membuat jawabannya lebih baik.
  const { data: riwayat } = await db.from("riwayat_obrolan")
    .select("peran, isi")
    .eq("chat_id", String(chatId))
    .order("waktu", { ascending: false })
    .limit(10);

  const percakapan = (riwayat || []).reverse().map((r) => ({
    role: r.peran, content: r.isi,
  }));

  const ARAHAN =
    `Kamu asisten SIGAP Drainase, sistem pemantauan saluran drainase di Kelurahan ` +
    `Meteseh, Kecamatan Tembalang, Kota Semarang. Kamu lagi ngobrol sama warga ` +
    `bernama ${nama} lewat Telegram.\n\n` +

    `GAYA NGOBROL\n` +
    `Santai dan akrab, kayak tetangga yang enak diajak ngobrol. Pakai Bahasa ` +
    `Indonesia sehari-hari, boleh sesekali nyelipin kata Jawa yang lazim di ` +
    `Semarang. Jangan kaku, jangan sok formal, tapi juga jangan berlebihan ` +
    `pakai singkatan sampai susah dibaca. Jawaban pendek saja, paling banyak ` +
    `empat kalimat, kecuali memang diminta rinci. Sesekali boleh pakai emoji, ` +
    `tapi jangan tiap kalimat.\n\n` +

    `KAMU BOLEH NGOBROL SOAL\n` +
    `1. Sistem ini sendiri: cara kerjanya, arti tiap status, kenapa pakai sensor ` +
    `radar, kenapa AI-nya cuma boleh menaikkan kewaspadaan, dan apa saja batasnya.\n` +
    `2. Kondisi saluran sekarang, tapi HANYA dari data yang diberikan di bawah.\n` +
    `3. Semarang: cuaca, daerah rawan genangan, transportasi, tempat umum, ` +
    `kebiasaan warga. Kalau tidak yakin, bilang tidak yakin.\n` +
    `4. Kesehatan lingkungan dan kebersihan: memilah sampah, minyak jelantah, ` +
    `jentik nyamuk DBD setelah genangan surut, leptospirosis dari air genangan, ` +
    `cuci tangan, menjaga air minum tetap bersih, pentingnya sepatu bot.\n` +
    `5. Keselamatan: listrik saat banjir, apa yang disiapkan sebelum musim hujan, ` +
    `nomor darurat.\n` +
    `6. Curhat dan obrolan ringan. Kalau warga cerita capek, kesal, cemas, atau ` +
    `sedih, dengarkan dulu. Jangan buru-buru memberi solusi atau menceramahi. ` +
    `Akui perasaannya, tanya seperlunya, baru bantu kalau memang diminta.\n` +
    `7. Mengingatkan sesuatu. Kalau warga minta diingatkan, katakan kamu belum ` +
    `bisa mengirim pengingat otomatis, tapi tawarkan menuliskan daftarnya ` +
    `sekarang supaya mereka bisa menyimpan pesannya.\n\n` +

    `ATURAN YANG TIDAK BOLEH DILANGGAR\n` +
    `1. Jangan pernah mengarang angka kondisi saluran. Kalau ditanya hal yang ` +
    `tidak ada di data di bawah, bilang terus terang tidak tahu.\n` +
    `2. Jangan bikin ramalan sendiri. Kalau ditanya beberapa jam ke depan, ` +
    `arahkan ke /prediksi.\n` +
    `3. Jangan memutuskan apakah warga harus mengungsi. Untuk keadaan darurat, ` +
    `sebutkan 112 dan arahkan mengikuti aparat setempat.\n` +
    `4. Jangan mendiagnosis penyakit dan jangan menyebut nama obat atau dosis. ` +
    `Kalau ada keluhan sakit, arahkan ke puskesmas atau bidan terdekat.\n` +
    `5. Kalau warga bicara soal menyakiti diri sendiri atau terdengar sangat ` +
    `tertekan, jangan dianggap bercanda. Dengarkan dengan serius, sampaikan ` +
    `kamu peduli, dan sarankan bicara dengan orang yang dipercaya, puskesmas, ` +
    `atau layanan 119 ekstensi 8.\n` +
    `6. Jangan menjanjikan kapan petugas datang.\n` +
    `7. Kalau warga melaporkan sampah atau genangan, ajak ketik /lapor diikuti ` +
    `keterangannya, supaya tercatat dan sampai ke petugas.\n\n` +

    `KONDISI SALURAN SAAT INI (satu-satunya data yang boleh kamu pakai):\n${kondisi}\n\n` +

    `Kamu ingat percakapan sebelumnya di bawah ini. Pakai untuk menyambung ` +
    `obrolan dengan wajar, jangan mengulang perkenalan tiap kali.`;

  try {
    const r = await fetch(penyedia.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${penyedia.kunci}`,
      },
      body: JSON.stringify({
        model: penyedia.model,
        temperature: 0.6,
        max_tokens: 400,
        messages: [
          { role: "system", content: ARAHAN },
          ...percakapan,
          { role: "user", content: teks.slice(0, 900) },
        ],
      }),
    });
    const hasil = await r.json();

    if (!r.ok) {
      const sebab = hasil?.error?.message || hasil?.error || `HTTP ${r.status}`;
      console.error(penyedia.nama + ":", sebab);
      return kirim(chatId,
        "Maaf, saya sedang tidak bisa mengobrol. Tetapi perintah biasa tetap jalan:\n" +
        "/status, /prediksi, /lapor, /mitigasi");
    }

    const jawab = hasil?.choices?.[0]?.message?.content?.trim();
    if (!jawab) return kirim(chatId, "Maaf, saya belum menangkap maksudnya. Coba tanyakan lagi?");

    // Lolos-kan tanda kurung siku agar Telegram tidak menolak seluruh pesan
    // bila model kebetulan menuliskannya.
    // Simpan giliran ini supaya percakapan berikutnya nyambung.
    // Kegagalan menyimpan tidak boleh membatalkan jawaban yang sudah siap.
    db.from("riwayat_obrolan").insert([
      { chat_id: String(chatId), peran: "user", isi: teks.slice(0, 900) },
      { chat_id: String(chatId), peran: "assistant", isi: jawab.slice(0, 1500) },
    ]).then(() => {}, () => {});

    const aman = jawab.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return kirim(chatId, aman);
  } catch (e) {
    console.error("obrol:", e);
    return kirim(chatId,
      "Maaf, sambungan sedang terganggu. Coba /status untuk melihat kondisi saluran.");
  }
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
      await cmdObrol(db, chatId, nama, teks);
      return NextResponse.json({ ok: true });
    }

    const [kepala, ...sisa] = teks.split(/\s+/);
    const perintah = kepala.slice(1).split("@")[0].toLowerCase();
    const argumen = sisa.join(" ");

    switch (perintah) {
      case "start":    await cmdStart(db, chatId, nama, argumen); break;
      case "daftar":   await cmdStart(db, chatId, nama, ""); break;
      case "status":   await cmdStatus(db, chatId); break;
      case "riwayat":  await cmdRiwayat(db, chatId); break;
      case "lokasi":   await cmdLokasi(db, chatId); break;
      case "dashboard":
      case "situs":    await cmdDashboard(chatId); break;
      case "prediksi": await cmdPrediksi(db, chatId); break;
      case "mitigasi": await cmdMitigasi(chatId); break;
      case "lapor":    await cmdLapor(db, chatId, nama, argumen); break;
      case "berhenti":
      case "stop":     await cmdBerhenti(db, chatId); break;
      case "tanya":    await cmdObrol(db, chatId, nama, argumen || "Halo"); break;
      case "lupakan":
      case "reset":
        await db.from("riwayat_obrolan").delete().eq("chat_id", String(chatId));
        await kirim(chatId, "Oke, obrolan kita sebelumnya sudah saya lupakan. "
                          + "Kita mulai dari awal lagi ya \u{1F642}");
        break;
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

/**
 * Halaman diagnosa.
 *
 * Buka https://ALAMAT-SITUS/api/telegram di peramban untuk memeriksa apakah
 * server sudah punya semua yang dibutuhkan. Nilai aslinya tidak pernah
 * ditampilkan, hanya ada atau tidaknya, sehingga aman dibuka siapa pun.
 */
export async function GET() {
  const ada = (n) => Boolean(process.env[n]);
  const periksa = {
    TELEGRAM_BOT_TOKEN: ada("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_WEBHOOK_SECRET: ada("TELEGRAM_WEBHOOK_SECRET"),
    TELEGRAM_ADMIN_CHAT_ID: ada("TELEGRAM_ADMIN_CHAT_ID"),
    SUPABASE_URL: ada("NEXT_PUBLIC_SUPABASE_URL") || ada("SUPABASE_URL"),
    SUPABASE_SERVICE_KEY: ada("SUPABASE_SERVICE_ROLE_KEY") || ada("SUPABASE_KEY"),
    XAI_API_KEY: ada("XAI_API_KEY"),
  };

  const wajib = ["TELEGRAM_BOT_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"];
  const kurang = wajib.filter((k) => !periksa[k]);

  // Tanyakan langsung ke Telegram, karena di sanalah letak kesalahan yang
  // paling sering: webhook belum terpasang, atau kata sandinya berbeda.
  let webhook = null;
  if (periksa.TELEGRAM_BOT_TOKEN) {
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      const d = await r.json();
      webhook = {
        terpasang_di: d?.result?.url || "(belum dipasang)",
        memakai_kata_sandi: Boolean(d?.result?.has_custom_certificate) ||
                            d?.result?.url?.length > 0,
        pesan_menunggu: d?.result?.pending_update_count ?? 0,
        galat_terakhir: d?.result?.last_error_message || "(tidak ada)",
        waktu_galat: d?.result?.last_error_date
          ? new Date(d.result.last_error_date * 1000).toISOString() : null,
      };
    } catch (e) {
      webhook = { galat: "Tidak dapat menghubungi Telegram: " + e.message };
    }
  }

  const saran = [];
  if (kurang.length) {
    saran.push(`Belum diisi di Vercel: ${kurang.join(", ")}. ` +
               "Isi lalu Redeploy, karena nilai baru hanya terbaca pada penerbitan berikutnya.");
  }
  if (webhook?.terpasang_di === "(belum dipasang)") {
    saran.push("Webhook belum dipasang. Buka tautan setWebhook di peramban.");
  }
  if (webhook?.galat_terakhir?.includes("401")) {
    saran.push("Galat 401 berarti TELEGRAM_WEBHOOK_SECRET di Vercel berbeda dengan " +
               "secret_token yang dipakai saat memasang webhook. Samakan keduanya, " +
               "lalu pasang ulang webhook.");
  }
  if (webhook?.galat_terakhir?.includes("404")) {
    saran.push("Galat 404 berarti alamat webhook salah. Pastikan berakhiran /api/telegram.");
  }
  if (!periksa.TELEGRAM_WEBHOOK_SECRET && webhook?.terpasang_di !== "(belum dipasang)") {
    saran.push("TELEGRAM_WEBHOOK_SECRET kosong di Vercel. Bila saat memasang webhook Anda " +
               "menyertakan secret_token, setiap pesan akan ditolak. Pasang ulang webhook " +
               "TANPA secret_token, atau isi variabelnya di Vercel.");
  }
  if (!saran.length) saran.push("Semua sudah terisi. Bila bot masih diam, kirim /start lalu " +
                                "muat ulang halaman ini untuk melihat galat terakhir.");

  return NextResponse.json({
    keterangan: "Diagnosa bot Telegram SIGAP Drainase",
    siap: kurang.length === 0,
    variabel: periksa,
    webhook,
    saran,
  }, { headers: { "Cache-Control": "no-store" } });
}
