"""Latih LSTM peramalan muka air pada data gabungan beberapa seed."""
import json, sys, joblib, numpy as np, pandas as pd
from datetime import datetime, timezone
sys.path.insert(0, '.')

from src.config import MODELS_DIR, settings
from src.features import FITUR

MENIT = 15
LANGKAH_IN = int(18 * 60 / MENIT)    # 18 jam riwayat
LANGKAH_OUT = int(12 * 60 / MENIT)   # ramalan 12 jam
IDX = FITUR.index('permukaan_mm')
STRIDE = 6                            # satu jendela tiap 1,5 jam, hemat memori

def jendela(df, scaler=None):
    """Bangun jendela per seed agar tidak melompati batas antar simulasi."""
    X, y = [], []
    for _, g in df.groupby('seed', sort=False):
        m = g[FITUR].to_numpy('float32')
        if scaler is not None:
            m = scaler.transform(m).astype('float32')
        n = len(m) - LANGKAH_IN - LANGKAH_OUT + 1
        for i in range(0, n, STRIDE):
            X.append(m[i:i + LANGKAH_IN])
            y.append(m[i + LANGKAH_IN:i + LANGKAH_IN + LANGKAH_OUT, IDX])
    return np.asarray(X, 'float32'), np.asarray(y, 'float32')

SEED_LATIH_LSTM = [11, 22, 33, 44, 55, 66]   # enam saluran latih
SEED_UJI_LSTM = [99, 411, 522, 633]         # saluran yang belum pernah dilihat
latih = pd.read_csv('datasets/latih.csv')
latih = latih[latih['seed'].isin(SEED_LATIH_LSTM)].reset_index(drop=True)
uji = pd.read_csv('datasets/uji.csv')
uji = uji[uji['seed'].isin(SEED_UJI_LSTM)].reset_index(drop=True)

from sklearn.preprocessing import StandardScaler
scaler = StandardScaler().fit(latih[FITUR].to_numpy('float32'))

Xtr, ytr = jendela(latih, scaler)
# sisihkan 15 persen data latih sebagai validasi
pisah = int(len(Xtr) * 0.85)
Xva, yva = Xtr[pisah:], ytr[pisah:]
Xtr, ytr = Xtr[:pisah], ytr[:pisah]
print(f"latih {Xtr.shape}  validasi {Xva.shape}", flush=True)

import tensorflow as tf
from tensorflow.keras import layers, models

inp = layers.Input(shape=(LANGKAH_IN, len(FITUR)))
x = layers.LSTM(64, return_sequences=True)(inp)
x = layers.Dropout(0.15)(x)
x = layers.LSTM(32)(x)
x = layers.Dropout(0.15)(x)
x = layers.Dense(96, activation='relu')(x)
out = layers.Dense(LANGKAH_OUT, dtype='float32')(x)
m = models.Model(inp, out, name='lstm_level_drainase')
m.compile(optimizer=tf.keras.optimizers.Adam(2e-3),
          loss=tf.keras.losses.Huber(delta=1.0), metrics=['mae'])
m.summary()

MODELS_DIR.mkdir(parents=True, exist_ok=True)
m.fit(Xtr, ytr, validation_data=(Xva, yva), epochs=28, batch_size=256,
      shuffle=True, verbose=2,
      callbacks=[
          tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=6,
                                           restore_best_weights=True, verbose=1),
          tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5,
                                               patience=3, min_lr=1e-5, verbose=1),
      ])

# --- evaluasi dalam milimeter pada seed yang belum pernah dilihat ---
Xte, yte = jendela(uji, scaler)
print(f'uji {Xte.shape}', flush=True)
pred = m.predict(Xte, batch_size=256, verbose=0)
rerata, sebaran = float(scaler.mean_[IDX]), float(scaler.scale_[IDX])
pmm, amm = pred * sebaran + rerata, yte * sebaran + rerata
mae = float(np.mean(np.abs(pmm - amm)))
rmse = float(np.sqrt(np.mean((pmm - amm) ** 2)))
l3 = int(3 * 60 / MENIT)
mae3 = float(np.mean(np.abs(pmm[:, :l3] - amm[:, :l3])))
mae12 = float(np.mean(np.abs(pmm[:, -1] - amm[:, -1])))
# pembanding naif: menganggap muka air tidak berubah
naif = np.repeat(amm[:, :1] * 0 + (Xte[:, -1, IDX] * sebaran + rerata)[:, None], LANGKAH_OUT, axis=1)
mae_naif = float(np.mean(np.abs(naif - amm)))

print(f"\nMAE keseluruhan     : {mae:.1f} mm")
print(f"MAE 3 jam pertama   : {mae3:.1f} mm")
print(f"MAE pada jam ke-12  : {mae12:.1f} mm")
print(f"RMSE                : {rmse:.1f} mm")
print(f"MAE tebakan naif    : {mae_naif:.1f} mm  (model harus lebih kecil dari ini)")
print(f"Perbaikan atas naif : {(1 - mae/mae_naif):.1%}")

m.save(settings.model.ramalan)
joblib.dump(scaler, settings.model.ramalan_scaler)
settings.model.ramalan_meta.write_text(json.dumps({
    'dilatih_pada': datetime.now(timezone.utc).isoformat(),
    'perangkat': 'CPU', 'sumber': 'sintetis-gabungan',
    'seed_latih': SEED_LATIH_LSTM, 'seed_uji': SEED_UJI_LSTM,
    'fitur': FITUR, 'target': 'permukaan_mm', 'idx_target': IDX,
    'langkah_input': LANGKAH_IN, 'langkah_output': LANGKAH_OUT,
    'menit_per_langkah': MENIT, 'jumlah_jendela_latih': int(len(Xtr)),
    'metrik': {'mae_mm': mae, 'rmse_mm': rmse, 'mae_3jam_mm': mae3,
               'mae_jam12_mm': mae12, 'mae_naif_mm': mae_naif},
}, indent=2), encoding='utf-8')
print("\nModel tersimpan.")
