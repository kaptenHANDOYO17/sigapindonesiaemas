-- ===========================================================================
--  SIGAP DRAINASE — DATA CONTOH UNTUK SELURUH TABEL
--
--  Cara pakai:
--    1. Buka Supabase -> SQL Editor -> New query
--    2. Salin SELURUH isi berkas ini, tempel, lalu tekan Run
--
--  Jalankan setelah keempat berkas ini sudah dijalankan lebih dulu:
--    schema.sql  ->  migrasi_pendaftaran.sql  ->  migrasi_admin_laporan.sql
--    ->  akun_pengelola.sql
--
--  Aman dijalankan berulang kali. Setiap kali dijalankan, data contoh lama
--  dihapus dulu lalu dibuat ulang, sehingga tidak menumpuk.
--
--  ---------------------------------------------------------------------
--  PENTING
--  Seluruh isi berkas ini adalah DATA BUATAN untuk menguji tampilan, bukan
--  pembacaan sensor sungguhan. Nomor telepon memakai awalan 62811-0000-xxxx
--  yang sengaja dipilih supaya tidak menabrak nomor milik orang lain.
--  HAPUS seluruh data ini sebelum sistem dipakai warga. Perintah
--  penghapusannya ada di bagian paling bawah berkas.
--  ---------------------------------------------------------------------
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Bersihkan data contoh lama
--    Ditandai lewat kolom keterangan, agar data sungguhan tidak ikut terhapus.
-- ---------------------------------------------------------------------------
delete from public.verifikasi_lapangan where catatan like '[CONTOH]%';
delete from public.laporan_warga        where isi like '[CONTOH]%';
delete from public.log_notifikasi       where isi like '[CONTOH]%';
delete from public.log_pendaftaran      where keterangan like '[CONTOH]%';
delete from public.status_ai            where alasan like '[CONTOH]%';
delete from public.sensor_drainase      where sumber in ('contoh-esp32', 'contoh-radar');
delete from public.kontak_stakeholder   where nomor_kontak like '62811000%' or chat_id like 'contoh-%';

-- ===========================================================================
-- 1. SENSOR_DRAINASE — 288 baris, 3 hari terakhir, tiap 15 menit
--
--    Dibangkitkan dengan rumus, bukan diketik satu per satu, supaya polanya
--    masuk akal: endapan menumpuk perlahan, hujan turun pada jam tertentu,
--    dan debit ikut naik saat hujan.
-- ===========================================================================
insert into public.sensor_drainase
    (saluran_id, timestamp, jarak_mm, debit_lpm, ph_air, hujan_mm, suhu_c, baterai_v, sumber)
select
    'MGH-01',
    now() - (n || ' minutes')::interval,

    -- Jarak radar ke permukaan. Makin kecil berarti permukaan makin naik.
    -- Tinggi pasang 1200 mm; endapan menumpuk pelan dari 280 ke 310 mm.
    round((1200
        - (280 + (288 - n / 15.0) * 0.10)                       -- dasar naik perlahan
        - (case when (n / 15) % 96 between 40 and 56             -- periode hujan harian
                then 180 + 90 * sin((n % 240) / 240.0 * pi())
                else 55 + 25 * sin((n % 600) / 600.0 * pi()) end)
        )::numeric, 1),

    -- Debit. Naik tajam saat hujan, rendah saat kering.
    round((case when (n / 15) % 96 between 40 and 56
                then 380 + 140 * sin((n % 240) / 240.0 * pi())
                else 95 + 45 * sin((n % 600) / 600.0 * pi()) end
          + (random() - 0.5) * 18)::numeric, 2),

    -- pH air. Cenderung sedikit asam karena sampah organik.
    round((6.55 + 0.45 * sin(n / 180.0) + (random() - 0.5) * 0.12)::numeric, 2),

    -- Curah hujan per jam.
    round((case when (n / 15) % 96 between 40 and 56
                then 3.5 + 7.5 * sin((n % 240) / 240.0 * pi())
                else greatest(0, (random() - 0.75) * 1.2) end)::numeric, 2),

    round((27.5 + 3.2 * sin(n / 96.0) + (random() - 0.5) * 0.8)::numeric, 2),
    round((4.02 - (n / 15.0) * 0.0009 + (random() - 0.5) * 0.02)::numeric, 2),
    'contoh-esp32'
from generate_series(0, 4305, 15) as n;

-- ===========================================================================
-- 2. STATUS_AI — 144 baris, 3 hari terakhir, tiap 30 menit
--
--    Status mengikuti matriks aturan yang sebenarnya: endapan tinggi dengan
--    debit menurun menjadi SIAGA, endapan melewati separuh kedalaman menjadi
--    KRITIS, dan seterusnya.
-- ===========================================================================
insert into public.status_ai (
    saluran_id, timestamp, status, alasan,
    rasio_endapan, rasio_debit, rasio_air, tinggi_air_mm, dasar_mm,
    debit_lpm, ph_air, hujan_mm, laju_naik,
    skor_anomali, anomali_terdeteksi, duga_model, keyakinan_model,
    estimasi_volume_m3, estimasi_karung, dugaan_jenis_sampah, keyakinan_jenis,
    ramalan, ringkasan_petugas
)
select
    'MGH-01',
    t.waktu,
    t.status,
    '[CONTOH] ' || t.alasan,
    t.r_endapan,
    t.r_debit,
    t.r_air,
    round((t.r_air * 800)::numeric, 1),
    round((t.r_endapan * 800)::numeric, 1),
    round((t.r_debit * 620)::numeric, 2),
    round((6.6 + 0.4 * sin(t.menit / 200.0))::numeric, 2),
    t.hujan,
    round((case when t.hujan > 3 then 2.4 + random() * 3 else random() * 0.6 end)::numeric, 3),
    round((-0.18 - random() * 0.22)::numeric, 4),
    (t.status in ('SIAGA', 'KRITIS') and random() > 0.6),
    t.status,
    round((0.62 + random() * 0.33)::numeric, 4),
    round((t.r_endapan * 800 / 1000.0 * 0.6 * 50)::numeric, 3),
    round(t.r_endapan * 800 / 1000.0 * 0.6 * 50 / 0.05)::int,
    case when t.status = 'AMAN' then null
         when random() > 0.45 then 'cenderung organik'
         else 'campuran, perlu diperiksa langsung' end,
    case when t.status = 'AMAN' then null else round((0.30 + random() * 0.15)::numeric, 3) end,

    -- Ramalan muka air 12 jam ke depan, langkah 30 menit.
    (select jsonb_build_object(
        'waktu',        jsonb_agg(to_char(t.waktu + (g * 30 || ' minutes')::interval,
                                          'YYYY-MM-DD"T"HH24:MI:SSOF') order by g),
        'permukaan_mm', jsonb_agg(round((t.r_air * 800
                                         + 130 * sin(g / 24.0 * pi())
                                         + g * 1.4)::numeric, 1) order by g),
        'puncak_mm',      round((t.r_air * 800 + 130 + 24 * 1.4)::numeric, 1),
        'rasio_puncak',   round(((t.r_air * 800 + 130 + 24 * 1.4) / 800)::numeric, 3),
        'waktu_puncak',   to_char(t.waktu + interval '6 hours', 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'berpotensi_meluap', ((t.r_air * 800 + 154) / 800) >= 0.85,
        'mae_model_mm',   27.9,
        'umur_data_jam',  0.2,
        'data_basi',      false
     ) from generate_series(1, 24) as g),

    case t.status
        when 'AMAN'    then '[CONTOH] Tidak perlu tindakan. Pantau seperti biasa.'
        when 'WASPADA' then '[CONTOH] Jadwalkan pemeriksaan pada kunjungan rutin berikutnya.'
        when 'SIAGA'   then '[CONTOH] Jadwalkan pengerukan dalam waktu dekat. Siapkan karung dan angkutan.'
        else                '[CONTOH] Pengerukan segera. Beri tahu pengurus RT agar warga bersiap.'
    end
from (
    select
        now() - (n || ' minutes')::interval as waktu,
        n as menit,
        -- Endapan menumpuk perlahan dari 28% ke 41% kedalaman
        round((0.28 + (4320 - n) / 4320.0 * 0.13 + (random() - 0.5) * 0.008)::numeric, 4) as r_endapan,
        -- Debit menurun seiring endapan menumpuk
        round((0.92 - (4320 - n) / 4320.0 * 0.45 + (random() - 0.5) * 0.05)::numeric, 4) as r_debit,
        round((0.34 + (4320 - n) / 4320.0 * 0.26 + (random() - 0.5) * 0.03)::numeric, 4) as r_air,
        round((case when (n / 30) % 48 between 20 and 28
                    then 3.5 + random() * 7 else greatest(0, (random() - 0.7)) end)::numeric, 2) as hujan,
        -- Status ditentukan mengikuti matriks aturan yang sebenarnya
        case
            when (0.28 + (4320 - n) / 4320.0 * 0.13) >= 0.55 then 'KRITIS'
            when (0.28 + (4320 - n) / 4320.0 * 0.13) >= 0.30
             and (0.92 - (4320 - n) / 4320.0 * 0.45) <  0.60 then 'SIAGA'
            when (0.28 + (4320 - n) / 4320.0 * 0.13) >= 0.30 then 'WASPADA'
            else 'AMAN'
        end as status,
        case
            when (0.28 + (4320 - n) / 4320.0 * 0.13) >= 0.30
             and (0.92 - (4320 - n) / 4320.0 * 0.45) <  0.60
            then 'Endapan tinggi disertai penurunan debit. Indikasi saluran mulai tersumbat.'
            when (0.28 + (4320 - n) / 4320.0 * 0.13) >= 0.30
            then 'Endapan tinggi namun aliran masih normal. Indikasi penyempitan saluran.'
            else 'Endapan rendah dan aliran normal.'
        end as alasan
    from generate_series(0, 4290, 30) as n
) t;

-- ===========================================================================
-- 3. KONTAK_STAKEHOLDER — 18 kontak
--    Campuran warga aktif, warga menunggu konfirmasi, petugas, dan kelurahan.
-- ===========================================================================
insert into public.kontak_stakeholder
    (nama, chat_id, nomor_kontak, peran, kanal, wilayah, aktif,
     terkonfirmasi, sumber_daftar, tanggal_daftar, dikonfirmasi_oleh, dikonfirmasi_pada)
values
-- Warga aktif, mendaftar lewat bot Telegram (langsung terkonfirmasi)
('Sutrisno',        'contoh-101', '628110000101', 'warga', 'telegram',  'RT 01 / RW 01', true,  true,  'telegram', now() - interval '52 days', null, null),
('Wahyuni',         'contoh-102', '628110000102', 'warga', 'telegram',  'RT 02 / RW 01', true,  true,  'telegram', now() - interval '48 days', null, null),
('Slamet Riyadi',   'contoh-103', '628110000103', 'warga', 'telegram',  'RT 03 / RW 01', true,  true,  'telegram', now() - interval '45 days', null, null),
('Siti Aminah',     'contoh-104', '628110000104', 'warga', 'telegram',  'RT 04 / RW 02', true,  true,  'telegram', now() - interval '41 days', null, null),
('Bambang Purnomo', 'contoh-105', '628110000105', 'warga', 'telegram',  'RT 05 / RW 02', true,  true,  'telegram', now() - interval '38 days', null, null),
('Endang Lestari',  'contoh-106', '628110000106', 'warga', 'telegram',  'RT 06 / RW 02', true,  true,  'telegram', now() - interval '30 days', null, null),

-- Warga yang mendaftar lewat situs, sudah dikonfirmasi kader
('Joko Susilo',     null,         '628110000107', 'warga', 'whatsapp',  'RT 01 / RW 03', true,  true,  'situs',    now() - interval '26 days', 'Kia, kader RW 01', now() - interval '24 days'),
('Rukmini',         null,         '628110000108', 'warga', 'whatsapp',  'RT 02 / RW 03', true,  true,  'situs',    now() - interval '22 days', 'Kia, kader RW 01', now() - interval '20 days'),
('Hartono',         null,         '628110000109', 'warga', 'whatsapp',  'RT 04 / RW 04', true,  true,  'situs',    now() - interval '18 days', 'Verdha, kader RW 02', now() - interval '17 days'),

-- Warga yang mendaftar lewat situs, MASIH MENUNGGU konfirmasi kader
('Tuti Handayani',  null,         '628110000110', 'warga', 'whatsapp',  'RT 03 / RW 04', false, false, 'situs',    now() - interval '5 days',  null, null),
('Agus Setiawan',   null,         '628110000111', 'warga', 'whatsapp',  'RT 05 / RW 05', false, false, 'situs',    now() - interval '3 days',  null, null),
('Nur Hidayah',     null,         '628110000112', 'warga', 'whatsapp',  'RT 06 / RW 05', false, false, 'situs',    now() - interval '2 days',  null, null),
('Maryanto',        null,         '628110000113', 'warga', 'whatsapp',  'RT 01 / RW 05', false, false, 'situs',    now() - interval '1 day',   null, null),

-- Petugas BPBD
('Petugas BPBD 1 (contoh)', 'contoh-201', '628110000201', 'bpbd', 'telegram', null, true, true, 'telegram', now() - interval '55 days', null, null),
('Petugas BPBD 2 (contoh)', 'contoh-202', '628110000202', 'bpbd', 'telegram', null, true, true, 'telegram', now() - interval '55 days', null, null),

-- Perangkat kelurahan dan pengurus RW
('Perangkat Kelurahan (contoh)', 'contoh-301', '628110000301', 'kelurahan', 'telegram', null, true, true, 'telegram', now() - interval '50 days', null, null),
('Ketua RW 01 (contoh)',         'contoh-302', '628110000302', 'warga',     'telegram', 'RW 01', true, true, 'telegram', now() - interval '47 days', null, null),
('Ketua RW 02 (contoh)',         'contoh-303', '628110000303', 'warga',     'telegram', 'RW 02', true, true, 'telegram', now() - interval '47 days', null, null);

-- Kode konfirmasi untuk pendaftaran lewat situs yang belum terkonfirmasi.
-- Kolom ini baru ada setelah migrasi_profil_konfirmasi.sql dijalankan.
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'kontak_stakeholder'
                 and column_name = 'kode_konfirmasi') then
        update public.kontak_stakeholder
           set kode_konfirmasi = upper(substr(md5(id::text), 1, 6))
         where sumber_daftar = 'situs' and not terkonfirmasi
           and nomor_kontak like '62811000%';
    end if;
end $$;

-- ===========================================================================
-- 4. LAPORAN_WARGA — 12 laporan dengan berbagai status
-- ===========================================================================
insert into public.laporan_warga
    (saluran_id, waktu, nama_pelapor, kontak, wilayah, jenis, isi, sumber,
     status, ditangani_oleh, ditangani_pada, catatan_petugas)
values
('MGH-01', now() - interval '4 hours',  'Tuti Handayani', '628110000110', 'RT 03 / RW 04', 'sumbatan',
 '[CONTOH] Ada kasur bekas menyumbat saluran di belakang rumah. Sudah dua hari air tidak mengalir dan mulai bau.',
 'situs', 'baru', null, null, null),

('MGH-01', now() - interval '9 hours',  'Agus Setiawan', 'telegram:contoh-111', 'RT 05 / RW 05', 'sampah',
 '[CONTOH] Sampah plastik menumpuk di mulut saluran depan warung. Setiap hujan airnya naik ke teras.',
 'telegram', 'baru', null, null, null),

('MGH-01', now() - interval '1 day',    null, null, 'RT 02 / RW 01', 'genangan',
 '[CONTOH] Genangan setinggi mata kaki di gang samping musala, belum surut sejak semalam.',
 'situs', 'baru', null, null, null),

('MGH-01', now() - interval '2 days',   'Sutrisno', '628110000101', 'RT 01 / RW 01', 'sampah',
 '[CONTOH] Banyak daun dan ranting menumpuk setelah angin kencang kemarin sore.',
 'telegram', 'diproses', 'Verdha', now() - interval '1 day',
 '[CONTOH] Sudah ditinjau. Dijadwalkan kerja bakti hari Minggu.'),

('MGH-01', now() - interval '3 days',   'Wahyuni', '628110000102', 'RT 02 / RW 01', 'perangkat',
 '[CONTOH] Kotak alat di pinggir saluran terbuka sedikit, kabelnya kelihatan.',
 'situs', 'diproses', 'Ismail', now() - interval '2 days',
 '[CONTOH] Akan dikencangkan dan diberi sil tambahan saat kunjungan pemeliharaan.'),

('MGH-01', now() - interval '5 days',   'Slamet Riyadi', '628110000103', 'RT 03 / RW 01', 'sumbatan',
 '[CONTOH] Saluran dekat jembatan kecil tersumbat lumpur, aliran hampir berhenti.',
 'telegram', 'selesai', 'Petugas BPBD 1', now() - interval '3 days',
 '[CONTOH] Dikeruk pada 3 hari lalu. Terangkut sekitar 6 karung lumpur.'),

('MGH-01', now() - interval '7 days',   'Siti Aminah', '628110000104', 'RT 04 / RW 02', 'genangan',
 '[CONTOH] Air menggenang di depan rumah setiap hujan lebih dari satu jam.',
 'situs', 'selesai', 'Verdha', now() - interval '5 days',
 '[CONTOH] Penyebabnya saluran menyempit oleh akar pohon. Sudah dibersihkan.'),

('MGH-01', now() - interval '9 days',   null, null, 'RT 06 / RW 02', 'sampah',
 '[CONTOH] Ada yang membuang minyak jelantah ke saluran, airnya berminyak.',
 'situs', 'selesai', 'Kia', now() - interval '7 days',
 '[CONTOH] Sudah disampaikan pada pertemuan RT. Dipasang papan imbauan.'),

('MGH-01', now() - interval '12 days',  'Bambang Purnomo', '628110000105', 'RT 05 / RW 02', 'lainnya',
 '[CONTOH] Tutup bak kontrol agak bergeser, khawatir ada anak jatuh.',
 'telegram', 'selesai', 'Verdha', now() - interval '11 days',
 '[CONTOH] Tutup sudah dipasang kembali dan dikunci.'),

('MGH-01', now() - interval '15 days',  'Hartono', '628110000109', 'RT 04 / RW 04', 'genangan',
 '[CONTOH] Genangan di depan gang, tetapi surut sendiri dalam dua jam.',
 'situs', 'bukan_masalah', 'Ismail', now() - interval '14 days',
 '[CONTOH] Masih dalam batas wajar untuk curah hujan saat itu. Dipantau saja.'),

('MGH-01', now() - interval '18 days',  'Rukmini', '628110000108', 'RT 02 / RW 03', 'perangkat',
 '[CONTOH] Lampu kecil di kotak alat berkedip terus, apakah rusak?',
 'situs', 'bukan_masalah', 'Ismail', now() - interval '17 days',
 '[CONTOH] Itu tanda alat sedang mengirim data. Normal.'),

('MGH-01', now() - interval '21 days',  'Endang Lestari', '628110000106', 'RT 06 / RW 02', 'sampah',
 '[CONTOH] Tumpukan sampah rumah tangga di pinggir saluran belum diangkut.',
 'telegram', 'selesai', 'Petugas BPBD 2', now() - interval '19 days',
 '[CONTOH] Sudah diangkut bersama petugas kebersihan kelurahan.');

-- ===========================================================================
-- 5. VERIFIKASI_LAPANGAN — 8 catatan pemeriksaan petugas
--    Inilah data yang membuat sistem belajar. Sengaja dibuat ada yang
--    penilaian AI-nya tepat dan ada yang meleset, supaya terlihat apa
--    adanya di dasbor.
-- ===========================================================================
insert into public.verifikasi_lapangan
    (saluran_id, waktu_periksa, petugas, instansi, kondisi_sebenarnya,
     peringatan_tepat, tinggi_endapan_cm, volume_terangkut_m3,
     jenis_sampah_dominan, sudah_dibersihkan, durasi_kerja_menit, catatan)
values
('MGH-01', now() - interval '3 days',  'Petugas BPBD 1', 'BPBD Kota Semarang', 'SIAGA',
 true,  32.5, 8.400, 'campuran', true,  145, '[CONTOH] Endapan sesuai perkiraan sistem. Terangkut 168 karung.'),

('MGH-01', now() - interval '11 days', 'Verdha',         'Tim SIGAP Drainase', 'WASPADA',
 true,  26.0, null,  'organik',  false,  35, '[CONTOH] Diperiksa saja, belum perlu dikeruk. Sesuai penilaian sistem.'),

('MGH-01', now() - interval '19 days', 'Petugas BPBD 2', 'BPBD Kota Semarang', 'SIAGA',
 false, 41.0, 11.200, 'lumpur',   true,  210,
 '[CONTOH] Sistem menilai WASPADA, kenyataannya sudah SIAGA. Endapan lebih tinggi dari taksiran, kemungkinan karena tidak ada periode kering minggu itu.'),

('MGH-01', now() - interval '27 days', 'Verdha',         'Tim SIGAP Drainase', 'AMAN',
 true,  12.0, null,  null,        false,  25, '[CONTOH] Saluran bersih setelah pengerukan. Aliran lancar.'),

('MGH-01', now() - interval '34 days', 'Petugas BPBD 1', 'BPBD Kota Semarang', 'KRITIS',
 true,  47.5, 13.600, 'campuran', true,  260,
 '[CONTOH] Sumbatan parah oleh potongan dahan dan kasur. Perlu dua orang tambahan.'),

('MGH-01', now() - interval '42 days', 'Ismail',         'Tim SIGAP Drainase', 'WASPADA',
 false, 19.0, null,  'organik',   false,  40,
 '[CONTOH] Sistem menilai SIAGA, kenyataannya masih WASPADA. Genangan di belakang sumbatan kecil terbaca sebagai endapan.'),

('MGH-01', now() - interval '51 days', 'Petugas BPBD 2', 'BPBD Kota Semarang', 'SIAGA',
 true,  35.0, 9.100, 'plastik',   true,  160,
 '[CONTOH] Didominasi sampah plastik rumah tangga, bukan lumpur.'),

('MGH-01', now() - interval '60 days', 'Verdha',         'Tim SIGAP Drainase', 'AMAN',
 true,  9.5,  null,  null,        false,  20, '[CONTOH] Pemeriksaan rutin. Tidak ada temuan.');

-- ===========================================================================
-- 6. LOG_NOTIFIKASI — 20 catatan pengiriman pesan
-- ===========================================================================
insert into public.log_notifikasi (tujuan, peran, kanal, status, berhasil, isi, dikirim_pada)
select
    k.chat_id,
    k.peran,
    'telegram',
    s.status,
    (random() > 0.06),                       -- sesekali gagal, seperti kenyataan
    '[CONTOH] Peringatan ' || s.status || ' dikirim otomatis oleh sistem.',
    s.waktu
from (values
    ('SIAGA',   now() - interval '6 hours'),
    ('SIAGA',   now() - interval '1 day'),
    ('WASPADA', now() - interval '2 days'),
    ('WASPADA', now() - interval '4 days'),
    ('KRITIS',  now() - interval '34 days')
) as s(status, waktu)
cross join lateral (
    select chat_id, peran from public.kontak_stakeholder
    where chat_id like 'contoh-%' and aktif
    limit 4
) k;

-- ===========================================================================
-- 7. LOG_PENDAFTARAN — 10 catatan percobaan pendaftaran
--    Nomor disimpan sebagai sidik, bukan aslinya.
-- ===========================================================================
insert into public.log_pendaftaran (nomor_hash, hasil, keterangan, waktu)
select
    md5('contoh-nomor-' || n),
    case when n % 7 = 0 then 'ganda'
         when n % 11 = 0 then 'ditolak'
         else 'berhasil' end,
    '[CONTOH] ' || case when n % 7 = 0 then 'nomor sudah pernah terdaftar'
                        when n % 11 = 0 then 'format nomor tidak sah'
                        else 'pendaftaran dari situs' end,
    now() - (n || ' hours')::interval
from generate_series(1, 10) as n;

-- ===========================================================================
-- 8. PROFIL_ADMIN — akun pengelola tambahan
--
--    Akun hanya dibuat bila surelnya belum ada, sehingga aman diulang.
--    Kata sandi seluruhnya: Contoh#2026
--    GANTI kata sandi ini sebelum sistem dipakai sungguhan.
-- ===========================================================================
create extension if not exists pgcrypto;

do $$
declare
    v_uid   uuid;
    r       record;
begin
    for r in
        select * from (values
            ('ismail@sigap.contoh',  'Ismail',  'admin',      null),
            ('kia@sigap.contoh',     'Kia',     'kader',      'RW 01'),
            ('verdha@sigap.contoh',  'Verdha',  'kader',      'RW 02'),
            ('maie@sigap.contoh',    'Maie',    'kader',      'RW 03'),
            ('bpbd@sigap.contoh',    'Petugas BPBD (contoh)', 'bpbd', null),
            ('lurah@sigap.contoh',   'Perangkat Kelurahan (contoh)', 'kelurahan', null)
        ) as x(email, nama, peran, wilayah)
    loop
        select id into v_uid from auth.users where email = r.email;

        if v_uid is null then
            v_uid := gen_random_uuid();

            insert into auth.users (
                instance_id, id, aud, role, email, encrypted_password,
                email_confirmed_at, created_at, updated_at,
                raw_app_meta_data, raw_user_meta_data
            ) values (
                '00000000-0000-0000-0000-000000000000', v_uid,
                'authenticated', 'authenticated', r.email,
                crypt('Contoh#2026', gen_salt('bf')),
                now(), now(), now(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('nama', r.nama)
            );

            -- Baris identities wajib ada, tanpa ini pengguna terbuat tetapi
            -- tidak dapat masuk pada Supabase versi baru.
            insert into auth.identities (
                id, user_id, provider_id, identity_data, provider,
                last_sign_in_at, created_at, updated_at
            ) values (
                gen_random_uuid(), v_uid, v_uid::text,
                jsonb_build_object('sub', v_uid::text, 'email', r.email,
                                   'email_verified', true),
                'email', now(), now(), now()
            );
        end if;

        insert into public.profil_admin (user_id, nama, peran, wilayah, aktif)
        values (v_uid, r.nama, r.peran, r.wilayah, true)
        on conflict (user_id) do update
            set nama = excluded.nama, peran = excluded.peran,
                wilayah = excluded.wilayah, aktif = true;
    end loop;
end $$;

commit;

-- ===========================================================================
--  PERIKSA HASILNYA
-- ===========================================================================
select 'sensor_drainase'      as tabel, count(*) as jumlah from public.sensor_drainase
union all select 'status_ai',           count(*) from public.status_ai
union all select 'kontak_stakeholder',  count(*) from public.kontak_stakeholder
union all select 'laporan_warga',       count(*) from public.laporan_warga
union all select 'verifikasi_lapangan', count(*) from public.verifikasi_lapangan
union all select 'log_notifikasi',      count(*) from public.log_notifikasi
union all select 'log_pendaftaran',     count(*) from public.log_pendaftaran
union all select 'profil_admin',        count(*) from public.profil_admin
order by tabel;

-- Kondisi terkini yang akan tampil di dasbor
select timestamp, status, round(rasio_endapan * 100, 1) as endapan_persen,
       round(rasio_debit * 100, 1) as aliran_persen, estimasi_volume_m3
from public.status_ai order by timestamp desc limit 5;

-- Akun yang dapat dipakai masuk ke halaman /masuk
select p.nama, p.peran, u.email, 'Contoh#2026' as kata_sandi_awal
from public.profil_admin p join auth.users u on u.id = p.user_id
order by p.peran, p.nama;


-- ===========================================================================
--  MENGHAPUS SELURUH DATA CONTOH
--
--  Jalankan blok di bawah ini sebelum sistem dipakai warga sungguhan.
--  Hapus dulu dua tanda minus di awal setiap baris.
-- ===========================================================================
-- begin;
-- delete from public.verifikasi_lapangan where catatan like '[CONTOH]%';
-- delete from public.laporan_warga        where isi like '[CONTOH]%';
-- delete from public.log_notifikasi       where isi like '[CONTOH]%';
-- delete from public.log_pendaftaran      where keterangan like '[CONTOH]%';
-- delete from public.status_ai            where alasan like '[CONTOH]%';
-- delete from public.sensor_drainase      where sumber in ('contoh-esp32','contoh-radar');
-- delete from public.kontak_stakeholder   where nomor_kontak like '62811000%' or chat_id like 'contoh-%';
-- delete from auth.users                  where email like '%@sigap.contoh';
-- commit;
