-- ===========================================================================
--  SIGAP DRAINASE — Skema Database Supabase
--  Cara pakai: Supabase -> SQL Editor -> New query -> tempel semua -> Run.
--  Aman dijalankan berulang kali.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Data mentah sensor
-- ---------------------------------------------------------------------------
create table if not exists public.sensor_drainase (
    id          bigint generated always as identity primary key,
    saluran_id  text        not null default 'MGH-01',
    timestamp   timestamptz not null,

    jarak_mm    numeric(8,1),   -- dari VEGAPULS Air 23 (radar)
    debit_lpm   numeric(9,2),   -- dari sensor debit via ESP32
    ph_air      numeric(4,2),   -- dari modul pH RS485 via ESP32
    hujan_mm    numeric(6,2),   -- dari Open-Meteo, diisi pipeline
    suhu_c      numeric(5,2),
    baterai_v   numeric(4,2),
    sumber      text default 'vega',

    -- Satu saluran hanya boleh punya satu baris per waktu. Tanpa aturan ini,
    -- pipeline yang berjalan dua kali akan menggandakan data dan merusak
    -- perhitungan laju kenaikan air.
    unique (saluran_id, timestamp)
);

create index if not exists idx_sensor_waktu
    on public.sensor_drainase (saluran_id, timestamp desc);

-- ---------------------------------------------------------------------------
-- 2. Riwayat penilaian AI
-- ---------------------------------------------------------------------------
create table if not exists public.status_ai (
    id                  bigint generated always as identity primary key,
    saluran_id          text        not null default 'MGH-01',
    timestamp           timestamptz not null default now(),

    status              text not null check (status in ('AMAN','WASPADA','SIAGA','KRITIS')),
    alasan              text,

    rasio_endapan       numeric(5,4),
    rasio_debit         numeric(6,4),
    rasio_air           numeric(6,4),
    tinggi_air_mm       numeric(8,1),
    dasar_mm            numeric(8,1),
    debit_lpm           numeric(9,2),
    ph_air              numeric(4,2),
    hujan_mm            numeric(6,2),
    laju_naik           numeric(7,3),

    skor_anomali        numeric(8,4),
    anomali_terdeteksi  boolean default false,
    duga_model          text,
    keyakinan_model     numeric(6,4),

    estimasi_volume_m3  numeric(8,3),
    estimasi_karung     integer,
    dugaan_jenis_sampah text,
    keyakinan_jenis     numeric(4,3),

    ramalan             jsonb,
    ringkasan_petugas   text
);

create index if not exists idx_status_waktu
    on public.status_ai (saluran_id, timestamp desc);
create index if not exists idx_status_tingkat
    on public.status_ai (status, timestamp desc);

-- ---------------------------------------------------------------------------
-- 3. Kontak penerima notifikasi
-- ---------------------------------------------------------------------------
create table if not exists public.kontak_stakeholder (
    id            bigint generated always as identity primary key,
    nama          text,
    chat_id       text unique,          -- Telegram
    nomor_kontak  text,                 -- WhatsApp, format 08xx atau 62xx
    peran         text not null default 'warga' check (peran in ('warga','bpbd','kelurahan','admin')),
    kanal         text not null default 'telegram' check (kanal in ('telegram','whatsapp','keduanya')),
    wilayah       text,                 -- RT/RW, untuk penyaringan nanti
    aktif         boolean not null default true,
    tanggal_daftar timestamptz not null default now()
);

create index if not exists idx_kontak_aktif
    on public.kontak_stakeholder (peran, aktif) where aktif = true;

-- ---------------------------------------------------------------------------
-- 4. Riwayat pengiriman notifikasi
-- ---------------------------------------------------------------------------
create table if not exists public.log_notifikasi (
    id           bigint generated always as identity primary key,
    tujuan       text,
    peran        text,
    kanal        text,
    status       text,
    berhasil     boolean default true,
    isi          text,
    dikirim_pada timestamptz not null default now()
);

create index if not exists idx_log_waktu
    on public.log_notifikasi (dikirim_pada desc);

-- ---------------------------------------------------------------------------
-- 5. Verifikasi lapangan oleh petugas
--    Inilah SATU-SATUNYA sumber kebenaran di seluruh sistem. Tanpa tabel ini,
--    model hanya bisa menebak. Dengan tabel ini, model bisa belajar dari
--    kenyataan dan diukur ketepatannya.
-- ---------------------------------------------------------------------------
create table if not exists public.verifikasi_lapangan (
    id                bigint generated always as identity primary key,
    saluran_id        text not null default 'MGH-01',
    status_ai_id      bigint references public.status_ai(id) on delete set null,
    waktu_periksa     timestamptz not null default now(),

    petugas           text,
    instansi          text,

    -- Apa yang benar-benar ditemukan di lapangan
    kondisi_sebenarnya text check (kondisi_sebenarnya in ('AMAN','WASPADA','SIAGA','KRITIS')),
    peringatan_tepat   boolean,        -- apakah penilaian AI sesuai kenyataan
    tinggi_endapan_cm  numeric(6,1),   -- hasil ukur langsung
    volume_terangkut_m3 numeric(8,3),  -- hasil pengerukan sebenarnya
    jenis_sampah_dominan text,         -- organik / plastik / lumpur / campuran
    sudah_dibersihkan  boolean default false,
    durasi_kerja_menit integer,
    catatan            text,
    foto_url           text
);

create index if not exists idx_verifikasi_waktu
    on public.verifikasi_lapangan (waktu_periksa desc);

-- ---------------------------------------------------------------------------
-- 6. Keamanan baris (Row Level Security)
--    Prinsip: publik hanya boleh MEMBACA status dan data sensor.
--    Nomor kontak warga tidak dapat diakses sama sekali dari halaman web.
-- ---------------------------------------------------------------------------
alter table public.sensor_drainase     enable row level security;
alter table public.status_ai           enable row level security;
alter table public.kontak_stakeholder  enable row level security;
alter table public.log_notifikasi      enable row level security;
alter table public.verifikasi_lapangan enable row level security;

drop policy if exists "publik baca sensor" on public.sensor_drainase;
create policy "publik baca sensor" on public.sensor_drainase
    for select to anon, authenticated using (true);

drop policy if exists "publik baca status" on public.status_ai;
create policy "publik baca status" on public.status_ai
    for select to anon, authenticated using (true);

drop policy if exists "publik baca verifikasi" on public.verifikasi_lapangan;
create policy "publik baca verifikasi" on public.verifikasi_lapangan
    for select to anon, authenticated using (true);

-- Petugas yang sudah masuk (login) boleh mengisi verifikasi lewat halaman web.
drop policy if exists "petugas isi verifikasi" on public.verifikasi_lapangan;
create policy "petugas isi verifikasi" on public.verifikasi_lapangan
    for insert to authenticated with check (true);

-- Tidak ada policy untuk kontak_stakeholder dan log_notifikasi.
-- Artinya kunci anon yang dipakai website sama sekali tidak bisa membaca
-- maupun menulis nomor warga. Ini disengaja demi privasi.

-- ---------------------------------------------------------------------------
-- 7. Realtime — supaya dasbor ikut berubah tanpa perlu di-refresh
-- ---------------------------------------------------------------------------
do $$
begin
    alter publication supabase_realtime add table public.status_ai;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.sensor_drainase;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Tampilan ringkas untuk dasbor
-- ---------------------------------------------------------------------------
create or replace view public.dasbor_terkini as
select s.*,
       (select count(*) from public.status_ai x
         where x.saluran_id = s.saluran_id
           and x.status in ('SIAGA','KRITIS')
           and x.timestamp > now() - interval '30 days') as kejadian_30hari
from public.status_ai s
order by s.timestamp desc
limit 1;

create or replace view public.ketepatan_sistem as
select
    date_trunc('month', waktu_periksa) as bulan,
    count(*)                                             as jumlah_pemeriksaan,
    count(*) filter (where peringatan_tepat)             as tepat,
    round(100.0 * count(*) filter (where peringatan_tepat) / nullif(count(*),0), 1) as persen_tepat
from public.verifikasi_lapangan
group by 1 order by 1 desc;

-- ---------------------------------------------------------------------------
-- 9. Pembersihan data lama (hemat kuota gratis)
-- ---------------------------------------------------------------------------
create or replace function public.bersihkan_data_lama()
returns void language sql as $$
    delete from public.sensor_drainase where timestamp    < now() - interval '365 days';
    delete from public.status_ai       where timestamp    < now() - interval '365 days';
    delete from public.log_notifikasi  where dikirim_pada < now() - interval '90 days';
$$;

-- ---------------------------------------------------------------------------
-- 10. Penambahan kolom pada basis data yang sudah terlanjur dibuat
--     Jalankan bagian ini bila tabel status_ai sudah ada sebelum model
--     klasifikasi diperkenalkan. Aman dijalankan berulang kali.
-- ---------------------------------------------------------------------------
alter table public.status_ai add column if not exists duga_model      text;
alter table public.status_ai add column if not exists keyakinan_model numeric(6,4);

-- Selesai. Cek di Table Editor: harus muncul 5 tabel.
