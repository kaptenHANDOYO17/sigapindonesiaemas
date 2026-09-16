-- ===========================================================================
--  SIGAP DRAINASE — Migrasi Peta Sensor dan Media Laporan
--  Jalankan setelah migrasi_profil_konfirmasi.sql. Aman diulang.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Titik sensor
--
--    Sebelumnya lokasi sensor tertanam di berkas konfigurasi, sehingga
--    menambah titik berarti mengubah kode. Sekarang disimpan di basis data,
--    supaya pengelola dapat menambah, memindahkan, dan menonaktifkan titik
--    lewat halaman admin tanpa menyentuh kode sama sekali.
-- ---------------------------------------------------------------------------
create table if not exists public.titik_sensor (
    id              bigint generated always as identity primary key,
    kode            text not null unique,          -- dipakai kolom saluran_id
    nama            text not null,
    alamat          text,
    lat             double precision not null,
    lon             double precision not null,

    -- Geometri saluran, wajib diukur langsung di lapangan
    tinggi_pasang_mm     integer not null default 1200,
    kedalaman_saluran_mm integer not null default 800,
    lebar_saluran_mm     integer not null default 600,
    panjang_segmen_m     integer not null default 50,
    debit_rancangan_lpm  integer not null default 900,

    aktif           boolean not null default true,
    terpasang       boolean not null default false,  -- alat sudah benar-benar ada di lapangan
    keterangan      text,
    dibuat_pada     timestamptz not null default now(),
    diperbarui_pada timestamptz
);

create index if not exists idx_titik_aktif on public.titik_sensor (aktif);

alter table public.titik_sensor enable row level security;

-- Siapa pun boleh melihat letak sensor. Tidak ada yang rahasia dari sebuah
-- titik pantau di ruang publik, dan warga justru perlu tahu.
drop policy if exists "titik sensor boleh dibaca umum" on public.titik_sensor;
create policy "titik sensor boleh dibaca umum" on public.titik_sensor
    for select to anon, authenticated using (true);

drop policy if exists "pengelola kelola titik" on public.titik_sensor;
create policy "pengelola kelola titik" on public.titik_sensor
    for all to authenticated
    using (public.adalah_pengelola()) with check (public.adalah_pengelola());

-- ---------------------------------------------------------------------------
-- 2. Tiga titik awal di Meteseh
--
--    PERHATIAN: koordinat di bawah ini adalah PERKIRAAN dari peta, bukan
--    hasil pengukuran di lapangan. Wajib diperbaiki lewat halaman admin
--    setelah survei, karena seluruh tautan peta dan arahan petugas
--    bergantung padanya.
-- ---------------------------------------------------------------------------
insert into public.titik_sensor
    (kode, nama, alamat, lat, lon, tinggi_pasang_mm, kedalaman_saluran_mm,
     lebar_saluran_mm, panjang_segmen_m, debit_rancangan_lpm, terpasang, keterangan)
values
('MTS-01', 'Drainase Meteseh Raya',
 'Jl. Meteseh Raya, Kelurahan Meteseh, Kecamatan Tembalang, Kota Semarang',
 -7.06620, 110.47180, 1200, 800, 600, 50, 900, false,
 'Titik percontohan utama. Koordinat masih perkiraan, perbaiki setelah survei.'),
('MTS-02', 'Drainase Bukit Kencana',
 'Kawasan Bukit Kencana Jaya, Kelurahan Meteseh, Kecamatan Tembalang',
 -7.07150, 110.47620, 1150, 750, 550, 45, 780, false,
 'Rencana perluasan tahap dua. Koordinat masih perkiraan.'),
('MTS-03', 'Drainase Kali Pengkol',
 'Sekitar aliran Kali Pengkol, Kelurahan Meteseh, Kecamatan Tembalang',
 -7.06110, 110.48050, 1300, 870, 680, 55, 1050, false,
 'Rencana perluasan tahap dua. Koordinat masih perkiraan.')
on conflict (kode) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Kolom tambahan pada laporan warga
-- ---------------------------------------------------------------------------
alter table public.laporan_warga
    add column if not exists lat           double precision,
    add column if not exists lon           double precision,
    add column if not exists akurasi_m     double precision,
    add column if not exists media_url     text,
    add column if not exists media_jenis   text;   -- 'foto' atau 'video'

-- ---------------------------------------------------------------------------
-- 4. Tempat penyimpanan foto dan video laporan
--
--    Dibuat publik untuk dibaca, karena tautannya ditampilkan di halaman
--    pengelola. Yang dibatasi adalah ukuran dan jenis berkasnya. Penulisan
--    tidak dibuka untuk umum; unggahan berjalan lewat Route Handler di
--    server agar dapat disaring dan dibatasi lajunya lebih dulu.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('laporan', 'laporan', true, 15728640,
        array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update
    set public = true,
        file_size_limit = 15728640,
        allowed_mime_types = array['image/jpeg','image/png','image/webp',
                                   'video/mp4','video/quicktime','video/webm'];

drop policy if exists "media laporan boleh dibaca" on storage.objects;
create policy "media laporan boleh dibaca" on storage.objects
    for select to public using (bucket_id = 'laporan');

drop policy if exists "pengelola hapus media laporan" on storage.objects;
create policy "pengelola hapus media laporan" on storage.objects
    for delete to authenticated
    using (bucket_id = 'laporan' and public.adalah_pengelola());

-- ---------------------------------------------------------------------------
-- 5. Tampilan gabungan titik dan status terkini, untuk peta
-- ---------------------------------------------------------------------------
create or replace view public.peta_sensor as
select
    t.kode, t.nama, t.alamat, t.lat, t.lon, t.aktif, t.terpasang,
    t.kedalaman_saluran_mm, t.keterangan,
    s.status, s.rasio_endapan, s.rasio_debit, s.rasio_air,
    s.estimasi_volume_m3, s.timestamp as diperbarui
from public.titik_sensor t
left join lateral (
    select * from public.status_ai a
    where a.saluran_id = t.kode
    order by a.timestamp desc limit 1
) s on true
where t.aktif;

grant select on public.peta_sensor to anon, authenticated;

-- Selesai.
