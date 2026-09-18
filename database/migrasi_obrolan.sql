-- ===========================================================================
--  SIGAP DRAINASE — Migrasi Ingatan Percakapan Bot
--  Jalankan setelah migrasi_peta_media.sql. Aman diulang.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Riwayat obrolan, supaya bot mengingat percakapan sebelumnya
--
-- Tanpa tabel ini, setiap pesan diperlakukan sebagai percakapan baru. Warga
-- yang bertanya "terus gimana?" akan dijawab seolah pertanyaan itu muncul
-- entah dari mana, dan itu membuat obrolan terasa memuakkan.
--
-- Yang disimpan hanya isi pesan dan waktunya. Tidak ada nomor telepon di
-- sini; chat_id Telegram bukan nomor, dan tidak dapat dipakai menghubungi
-- siapa pun di luar bot ini.
-- ---------------------------------------------------------------------------
create table if not exists public.riwayat_obrolan (
    id        bigint generated always as identity primary key,
    chat_id   text not null,
    peran     text not null check (peran in ('user', 'assistant')),
    isi       text not null,
    waktu     timestamptz not null default now()
);

create index if not exists idx_obrolan_chat
    on public.riwayat_obrolan (chat_id, waktu desc);

alter table public.riwayat_obrolan enable row level security;

-- Tidak ada policy untuk anon maupun authenticated. Tabel ini hanya disentuh
-- oleh webhook bot di sisi server, yang memakai kunci service_role.

-- ---------------------------------------------------------------------------
-- Pembersihan otomatis
--
-- Percakapan lebih lama dari 30 hari dihapus. Menyimpan obrolan warga
-- selamanya tidak ada gunanya bagi sistem, dan hanya menambah risiko bila
-- suatu saat basis data bocor.
-- ---------------------------------------------------------------------------
create or replace function public.bersihkan_obrolan_lama()
returns void language sql security definer as $$
    delete from public.riwayat_obrolan where waktu < now() - interval '30 days';
$$;

-- Jalankan sekali sekarang.
select public.bersihkan_obrolan_lama();

-- Selesai.
