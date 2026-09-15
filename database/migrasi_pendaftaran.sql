-- ===========================================================================
--  SIGAP DRAINASE — Migrasi untuk Pendaftaran Nomor lewat Situs
--  Jalankan di Supabase -> SQL Editor setelah schema.sql.
--  Aman dijalankan berulang kali.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolom tambahan pada tabel kontak
-- ---------------------------------------------------------------------------
alter table public.kontak_stakeholder
    add column if not exists terkonfirmasi   boolean     not null default false,
    add column if not exists sumber_daftar   text        not null default 'telegram',
    add column if not exists token_berhenti  text,
    add column if not exists dikonfirmasi_pada timestamptz,
    add column if not exists dikonfirmasi_oleh text;

-- Nomor kontak tidak boleh ganda. Tanpa ini, satu orang dapat mendaftar
-- berulang kali dan menerima pesan yang sama beberapa kali.
create unique index if not exists idx_kontak_nomor_unik
    on public.kontak_stakeholder (nomor_kontak)
    where nomor_kontak is not null and nomor_kontak <> '';

-- Kontak lama yang sudah aktif dianggap sudah terkonfirmasi, karena mereka
-- mendaftar sendiri lewat bot Telegram.
update public.kontak_stakeholder
   set terkonfirmasi = true
 where aktif = true and terkonfirmasi = false;

-- ---------------------------------------------------------------------------
-- 2. Keamanan baris
--
--    TIDAK ADA policy untuk anon maupun authenticated pada tabel ini.
--    Artinya kunci yang dipakai peramban sama sekali tidak dapat membaca
--    maupun menulis nomor warga. Seluruh pendaftaran dari situs berjalan
--    lewat Route Handler di sisi server, yang memakai kunci service_role
--    dan tidak pernah sampai ke peramban.
-- ---------------------------------------------------------------------------
alter table public.kontak_stakeholder enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Tampilan jumlah pendaftar, aman dibaca publik
--    Hanya berisi ANGKA, tidak memuat satu pun nomor atau nama.
-- ---------------------------------------------------------------------------
create or replace view public.ringkasan_pendaftar
with (security_invoker = off) as
select
    count(*) filter (where peran = 'warga' and aktif and terkonfirmasi) as warga_aktif,
    count(*) filter (where peran = 'warga' and not terkonfirmasi)        as warga_menunggu,
    count(*) filter (where peran = 'bpbd'  and aktif)                    as petugas_aktif
from public.kontak_stakeholder;

grant select on public.ringkasan_pendaftar to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Catatan pendaftaran, untuk menahan penyalahgunaan
-- ---------------------------------------------------------------------------
create table if not exists public.log_pendaftaran (
    id           bigint generated always as identity primary key,
    nomor_hash   text not null,      -- nomor disimpan sebagai sidik, bukan aslinya
    hasil        text not null,      -- berhasil / ganda / ditolak
    keterangan   text,
    waktu        timestamptz not null default now()
);

create index if not exists idx_log_pendaftaran_waktu
    on public.log_pendaftaran (waktu desc);

alter table public.log_pendaftaran enable row level security;

-- Selesai. Periksa di Table Editor: kolom baru muncul pada kontak_stakeholder.
