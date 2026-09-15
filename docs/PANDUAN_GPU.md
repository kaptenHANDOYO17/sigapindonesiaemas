# Panduan GPU

Khusus untuk pelatihan model LSTM. Sistem tetap berjalan tanpa GPU; hanya
pelatihannya yang lebih lama.

---

## Masalahnya

TensorFlow di atas versi 2.10 **tidak lagi mendukung GPU pada Windows secara
langsung**. Bila Anda memasang `tensorflow==2.17` di Windows lalu memanggil
`tf.config.list_physical_devices("GPU")`, hasilnya akan kosong meskipun kartu
grafis Anda bagus.

Jalan keluar resminya adalah WSL2, yaitu Linux yang berjalan di dalam Windows.

---

## Memasang WSL2

Buka PowerShell **sebagai Administrator**:

```powershell
wsl --install -d Ubuntu-22.04
```

Komputer akan meminta dimulai ulang. Setelah itu Ubuntu terbuka dan meminta
nama pengguna serta kata sandi baru.

Pastikan driver NVIDIA di Windows sudah versi terbaru. Anda **tidak perlu**
memasang driver terpisah di dalam WSL; driver Windows sudah cukup.

Periksa dari dalam Ubuntu:

```bash
nvidia-smi
```

Bila muncul tabel berisi nama kartu grafis Anda, WSL sudah melihat GPU.

---

## Memasang TensorFlow dengan CUDA

Di dalam Ubuntu:

```bash
sudo apt update && sudo apt install -y python3-pip python3-venv
python3 -m venv ~/sigap
source ~/sigap/bin/activate

pip install --upgrade pip
pip install "tensorflow[and-cuda]==2.17.1"
```

Tanda kurung siku itu penting. Tanpa itu, CUDA dan cuDNN tidak ikut terpasang.

Periksa:

```bash
python3 -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
```

Harus muncul daftar berisi satu perangkat GPU.

---

## Mengakses berkas proyek dari WSL

Drive Windows tersedia di dalam WSL pada `/mnt/`:

```bash
cd /mnt/c/Users/NAMA_ANDA/Documents/sigap-drainase
pip install -r requirements-train.txt
python -m training.train_forecast --sumber sintetis --epoch 60
```

Membaca berkas lewat `/mnt/c` agak lambat. Untuk pelatihan yang sering
dijalankan, salin proyek ke dalam sistem berkas WSL (`~/sigap-drainase`) supaya
jauh lebih cepat.

---

## Bila GPU tetap tidak terdeteksi

Skrip pelatihan akan berhenti dan menampilkan petunjuk, bukan diam-diam
melanjutkan di CPU. Ini disengaja. Pada percobaan, melatih di CPU memakan
waktu berjam-jam dan hasilnya justru lebih buruk, karena jumlah epoch
terpaksa dipangkas agar selesai dalam waktu wajar. Lebih baik berhenti dan
memperbaiki penyiapan GPU daripada menunggu lama untuk model yang lemah.

Periksa berurutan:

1. `nvidia-smi` di dalam WSL harus menampilkan nama kartu grafis Anda. Bila
   tidak, perbarui driver NVIDIA di Windows, lalu mulai ulang WSL dengan
   `wsl --shutdown` dari PowerShell.
2. Pastikan Anda menjalankan dari dalam Ubuntu, bukan dari PowerShell.
   TensorFlow di atas versi 2.10 tidak lagi mendukung GPU pada Windows
   secara langsung.
3. Pastikan pemasangannya memakai tanda kurung siku:
   `pip install "tensorflow[and-cuda]==2.17.1"`. Tanpa itu, CUDA dan cuDNN
   tidak ikut terpasang.
4. Periksa dari Python:
   `python3 -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"`

Perkiraan waktu untuk 30 epoch pada data satu tahun, dengan GPU kelas
menengah seperti RTX pada laptop: sekitar 10 sampai 25 menit.

Pelatihan model penilai status (`training/train_classifier.py`) tidak
memerlukan GPU dan tetap berjalan di CPU dalam hitungan menit. Yang
membutuhkan GPU hanya model peramalan muka air.

## Catatan mixed precision

Skrip pelatihan menyalakan mixed precision secara otomatis bila GPU terdeteksi.
Ini mempercepat pelatihan hampir dua kali lipat pada kartu grafis modern.

Lapisan keluaran sengaja dipaksa `float32` supaya hasil ramalan tidak kehilangan
ketelitian. Bila Anda mengalami kejanggalan angka saat pelatihan, matikan
dengan:

```bash
python -m training.train_forecast --no-mixed
```

Mixed precision hanya menyala bila GPU terdeteksi, sehingga pilihan ini tidak
berpengaruh apa-apa bila penyiapan GPU Anda belum selesai.
