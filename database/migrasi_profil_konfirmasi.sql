-- ===========================================================================
--  SIGAP DRAINASE — Migrasi Foto Profil dan Konfirmasi Nomor
--  Jalankan setelah migrasi_admin_laporan.sql. Aman diulang.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolom tambahan pada profil pengelola
-- ---------------------------------------------------------------------------
alter table public.profil_admin
    add column if not exists foto_url      text,
    add column if not exists jabatan       text,
    add column if not exists nomor_kontak  text,
    add column if not exists diperbarui_pada timestamptz;

-- Pengelola boleh mengubah profilnya sendiri, tetapi TIDAK boleh mengubah
-- perannya sendiri. Tanpa pembatasan ini, seorang kader dapat menaikkan
-- dirinya menjadi admin lalu melihat seluruh nomor warga.
drop policy if exists "pengelola ubah profil sendiri" on public.profil_admin;
create policy "pengelola ubah profil sendiri" on public.profil_admin
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create or replace function public.jaga_peran_profil()
returns trigger language plpgsql security definer as $$
begin
    -- Admin penuh boleh mengubah peran siapa pun, termasuk dirinya.
    if public.adalah_admin_penuh() then
        return new;
    end if;
    -- Selain itu, peran dan status aktif dikembalikan ke nilai lama.
    new.peran := old.peran;
    new.aktif := old.aktif;
    return new;
end $$;

drop trigger if exists trg_jaga_peran_profil on public.profil_admin;
create trigger trg_jaga_peran_profil
    before update on public.profil_admin
    for each row execute function public.jaga_peran_profil();

-- ---------------------------------------------------------------------------
-- 2. Kode konfirmasi nomor warga
--
--    Dipakai untuk membuktikan bahwa nomor yang didaftarkan lewat situs
--    benar-benar milik orang yang mendaftar. Warga mengirim kode ini dari
--    WhatsApp-nya sendiri ke nomor pengelola; karena pesan itu datang dari
--    nomor yang bersangkutan, kepemilikannya terbukti tanpa perlu layanan
--    pengirim OTP berbayar.
-- ---------------------------------------------------------------------------
alter table public.kontak_stakeholder
    add column if not exists kode_konfirmasi text;

create index if not exists idx_kontak_kode
    on public.kontak_stakeholder (kode_konfirmasi)
    where kode_konfirmasi is not null;

-- ---------------------------------------------------------------------------
-- 3. Tempat penyimpanan foto profil
--
--    Bucket dibuat publik untuk dibaca, karena foto profil memang tampil di
--    halaman. Yang dibatasi adalah siapa yang boleh mengunggah dan menghapus.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatar', 'avatar', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
    set public = true,
        file_size_limit = 2097152,
        allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "avatar boleh dibaca siapa saja" on storage.objects;
create policy "avatar boleh dibaca siapa saja" on storage.objects
    for select to public using (bucket_id = 'avatar');

-- Setiap pengelola hanya boleh menyentuh berkas di dalam foldernya sendiri,
-- yaitu folder yang bernama sama dengan user id miliknya.
drop policy if exists "pengelola unggah avatar sendiri" on storage.objects;
create policy "pengelola unggah avatar sendiri" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatar'
                and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pengelola ganti avatar sendiri" on storage.objects;
create policy "pengelola ganti avatar sendiri" on storage.objects
    for update to authenticated
    using (bucket_id = 'avatar'
           and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pengelola hapus avatar sendiri" on storage.objects;
create policy "pengelola hapus avatar sendiri" on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatar'
           and (storage.foldername(name))[1] = auth.uid()::text);

-- Selesai.
