-- ===========================================================================
--  SIGAP DRAINASE — Pembuatan Akun Pengelola
--  Jalankan di Supabase -> SQL Editor, setelah migrasi_admin_laporan.sql.
-- ===========================================================================
--
--  ADA DUA CARA. Pilih salah satu.
--
--  CARA A (disarankan) — lewat antarmuka Supabase
--  ----------------------------------------------
--  1. Buka Authentication -> Users -> Add user -> Create new user.
--  2. Email    : handoyo@sigapdrainase.my.id
--     Password : (buat sendiri, minimal 12 karakter)
--     Centang "Auto Confirm User".
--  3. Salin User UID yang muncul pada daftar pengguna.
--  4. Jalankan hanya bagian ini, ganti UID-nya:
--
--       insert into public.profil_admin (user_id, nama, peran)
--       values ('TEMPEL-UID-DI-SINI', 'Handoyo', 'admin')
--       on conflict (user_id) do update set nama = excluded.nama, peran = excluded.peran;
--
--  Cara ini lebih aman karena kata sandi tidak pernah tertulis di berkas mana pun.
--
--
--  CARA B — seluruhnya lewat SQL
--  -----------------------------
--  Pakai bila Anda ingin sekali jalan. Blok di bawah ini membuat pengguna
--  sekaligus profilnya. GANTI kata sandinya lebih dulu, lalu HAPUS berkas ini
--  dari repositori setelah dijalankan, atau setidaknya ganti kata sandinya
--  melalui menu Authentication begitu berhasil masuk.
-- ===========================================================================

create extension if not exists pgcrypto;

do $$
declare
    v_uid   uuid := gen_random_uuid();
    v_email text := 'handoyo@sigapdrainase.my.id';
    v_sandi text := 'SigapDrainase#2026';      -- <<< GANTI SEBELUM DIJALANKAN
    v_nama  text := 'Handoyo';
begin
    -- Bila surel ini sudah ada, cukup pastikan profilnya benar lalu berhenti.
    if exists (select 1 from auth.users where email = v_email) then
        select id into v_uid from auth.users where email = v_email;
        insert into public.profil_admin (user_id, nama, peran, aktif)
        values (v_uid, v_nama, 'admin', true)
        on conflict (user_id) do update
            set nama = excluded.nama, peran = excluded.peran, aktif = true;
        raise notice 'Pengguna % sudah ada. Profil pengelola diperbarui.', v_email;
        return;
    end if;

    insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
    ) values (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, crypt(v_sandi, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nama', v_nama)
    );

    -- Baris identities diperlukan agar masuk dengan surel dan kata sandi
    -- berjalan pada Supabase versi baru. Tanpa ini, pengguna terbuat tetapi
    -- tidak dapat masuk, dan penyebabnya sulit ditelusuri.
    insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at,
        created_at, updated_at
    ) values (
        gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', now(), now(), now()
    );

    insert into public.profil_admin (user_id, nama, peran, aktif)
    values (v_uid, v_nama, 'admin', true);

    raise notice 'Akun pengelola dibuat. Surel: %  Kata sandi: %', v_email, v_sandi;
end $$;

-- ---------------------------------------------------------------------------
--  Memeriksa hasilnya
-- ---------------------------------------------------------------------------
select p.nama, p.peran, p.aktif, u.email, u.email_confirmed_at is not null as terkonfirmasi
from public.profil_admin p
join auth.users u on u.id = p.user_id
order by p.dibuat_pada;

-- ---------------------------------------------------------------------------
--  MENAMBAH PENGELOLA LAIN
--
--  Buat penggunanya lewat Authentication -> Users, salin UID-nya, lalu:
--
--    insert into public.profil_admin (user_id, nama, peran, wilayah) values
--      ('UID-ISMAIL',  'Ismail',  'admin',      null),
--      ('UID-KIA',     'Kia',     'kader',      'RW 01'),
--      ('UID-VERDHA',  'Verdha',  'kader',      'RW 02'),
--      ('UID-PETUGAS', 'Nama',    'bpbd',       null),
--      ('UID-LURAH',   'Nama',    'kelurahan',  null);
--
--  Peran yang tersedia: admin, kader, bpbd, kelurahan.
--  Hanya 'admin' yang boleh menambah dan menghapus pengelola lain.
-- ---------------------------------------------------------------------------
