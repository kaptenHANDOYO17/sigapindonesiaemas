-- ===========================================================================
--  SIGAP DRAINASE — Migrasi Admin dan Laporan Warga
--  Jalankan di Supabase -> SQL Editor setelah schema.sql dan
--  migrasi_pendaftaran.sql. Aman dijalankan berulang kali.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Profil pengelola
--
--    Tabel ini TIDAK menyimpan kata sandi. Kata sandi dikelola Supabase Auth
--    pada tabel auth.users, yang sudah menangani penyandian, pemulihan kata
--    sandi, dan pembatasan percobaan masuk. Membuat sistem kata sandi sendiri
--    hampir selalu berakhir lebih lemah daripada memakai yang sudah teruji.
--
--    Yang disimpan di sini hanya: siapa dia, perannya apa, dan masih aktif
--    atau tidak.
-- ---------------------------------------------------------------------------
create table if not exists public.profil_admin (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    nama       text not null,
    peran      text not null default 'kader'
               check (peran in ('admin', 'kader', 'bpbd', 'kelurahan')),
    wilayah    text,
    aktif      boolean not null default true,
    dibuat_pada timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Fungsi pemeriksa hak akses
--
--    Dipakai oleh seluruh policy di bawah. Dibuat security definer agar dapat
--    membaca profil_admin tanpa terjebak pada policy tabel itu sendiri.
-- ---------------------------------------------------------------------------
create or replace function public.adalah_pengelola()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profil_admin
        where user_id = auth.uid() and aktif
    );
$$;

create or replace function public.adalah_admin_penuh()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profil_admin
        where user_id = auth.uid() and aktif and peran = 'admin'
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Laporan warga
--
--    Warga mengirim lewat situs atau bot Telegram. Tidak ada policy untuk
--    anon; pengiriman dari situs berjalan melalui Route Handler di server
--    agar dapat disaring dan dibatasi lajunya lebih dulu.
-- ---------------------------------------------------------------------------
create table if not exists public.laporan_warga (
    id            bigint generated always as identity primary key,
    saluran_id    text not null default 'MGH-01',
    waktu         timestamptz not null default now(),

    nama_pelapor  text,
    kontak        text,                       -- boleh kosong, laporan anonim diizinkan
    wilayah       text,                       -- RT / RW
    jenis         text not null default 'lainnya'
                  check (jenis in ('sampah', 'genangan', 'sumbatan', 'perangkat', 'lainnya')),
    isi           text not null,
    foto_url      text,
    sumber        text not null default 'situs' check (sumber in ('situs', 'telegram', 'kader')),

    status        text not null default 'baru'
                  check (status in ('baru', 'diproses', 'selesai', 'bukan_masalah')),
    ditangani_oleh text,
    ditangani_pada timestamptz,
    catatan_petugas text
);

create index if not exists idx_laporan_status
    on public.laporan_warga (status, waktu desc);
create index if not exists idx_laporan_waktu
    on public.laporan_warga (waktu desc);

-- ---------------------------------------------------------------------------
-- 4. Keamanan baris
-- ---------------------------------------------------------------------------
alter table public.profil_admin   enable row level security;
alter table public.laporan_warga  enable row level security;

drop policy if exists "pengelola baca profil sendiri" on public.profil_admin;
create policy "pengelola baca profil sendiri" on public.profil_admin
    for select to authenticated using (user_id = auth.uid() or public.adalah_admin_penuh());

drop policy if exists "admin kelola profil" on public.profil_admin;
create policy "admin kelola profil" on public.profil_admin
    for all to authenticated
    using (public.adalah_admin_penuh()) with check (public.adalah_admin_penuh());

drop policy if exists "pengelola baca laporan" on public.laporan_warga;
create policy "pengelola baca laporan" on public.laporan_warga
    for select to authenticated using (public.adalah_pengelola());

drop policy if exists "pengelola ubah laporan" on public.laporan_warga;
create policy "pengelola ubah laporan" on public.laporan_warga
    for update to authenticated
    using (public.adalah_pengelola()) with check (public.adalah_pengelola());

-- Kontak warga: hanya pengelola yang boleh membaca dan mengubah.
-- Tetap tidak ada policy untuk anon, sehingga peramban pengunjung biasa
-- sama sekali tidak dapat menyentuh nomor warga.
drop policy if exists "pengelola baca kontak" on public.kontak_stakeholder;
create policy "pengelola baca kontak" on public.kontak_stakeholder
    for select to authenticated using (public.adalah_pengelola());

drop policy if exists "pengelola ubah kontak" on public.kontak_stakeholder;
create policy "pengelola ubah kontak" on public.kontak_stakeholder
    for update to authenticated
    using (public.adalah_pengelola()) with check (public.adalah_pengelola());

drop policy if exists "pengelola hapus kontak" on public.kontak_stakeholder;
create policy "pengelola hapus kontak" on public.kontak_stakeholder
    for delete to authenticated using (public.adalah_pengelola());

-- Verifikasi lapangan: dibatasi pengelola, bukan seluruh pengguna yang masuk.
drop policy if exists "petugas isi verifikasi" on public.verifikasi_lapangan;
drop policy if exists "pengelola isi verifikasi" on public.verifikasi_lapangan;
create policy "pengelola isi verifikasi" on public.verifikasi_lapangan
    for insert to authenticated with check (public.adalah_pengelola());

-- Riwayat notifikasi: hanya pengelola.
drop policy if exists "pengelola baca log" on public.log_notifikasi;
create policy "pengelola baca log" on public.log_notifikasi
    for select to authenticated using (public.adalah_pengelola());

-- ---------------------------------------------------------------------------
-- 5. Tampilan ringkas untuk dasbor pengelola
-- ---------------------------------------------------------------------------
create or replace view public.ringkasan_laporan as
select
    count(*) filter (where status = 'baru')     as baru,
    count(*) filter (where status = 'diproses') as diproses,
    count(*) filter (where status = 'selesai')  as selesai,
    count(*) filter (where waktu > now() - interval '7 days') as tujuh_hari_terakhir,
    count(*)                                    as total
from public.laporan_warga;

-- ===========================================================================
--  CARA MEMBUAT AKUN PENGELOLA PERTAMA
--
--  1. Buka Supabase -> Authentication -> Users -> Add user.
--     Isi surel dan kata sandi, lalu centang "Auto Confirm User".
--  2. Salin User UID yang muncul.
--  3. Jalankan perintah di bawah ini, ganti UID dan namanya.
--
--     insert into public.profil_admin (user_id, nama, peran)
--     values ('TEMPEL-UID-DI-SINI', 'Handoyo', 'admin');
--
--  4. Masuk ke situs melalui halaman /masuk memakai surel dan kata sandi tadi.
--
--  Untuk menambah kader atau petugas BPBD, ulangi langkah yang sama dengan
--  peran 'kader' atau 'bpbd'. Peran 'admin' adalah satu-satunya yang boleh
--  menambah dan menghapus pengelola lain.
-- ===========================================================================
