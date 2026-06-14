# Progres Pengembangan Fitur Chatbot Kawan

## Fitur `#CHECKSLS` dan `#UPDATE`

### 1. Tujuan

Fitur ini dikembangkan untuk memudahkan petugas **PML** (Pengawas/Master Lapangan) dan **PPL** (Petugas Pencacah Lapangan) dalam mengelola data SLS (Slokter/Sampling Frame Unit) langsung melalui WhatsApp.

---

### 2. Mekanisme Otorisasi

Hanya nomor telepon yang **terdaftar** sebagai PML atau PPL di database SLS yang dapat menggunakan fitur ini.

#### Basis Data

Data PML/PPL disimpan di Google Sheets dan diakses melalui Google Apps Script Web App dengan endpoint:

```
GET {API}?action=readDBSLS
```

Setiap record memiliki dua field nomor telepon:

| Field | Deskripsi |
|---|---|
| `noHpPml` | Nomor HP **PML** (Pengawas/Master Lapangan) |
| `noHPMitra` | Nomor HP **PPL** (Petugas Pencacah Lapangan) |

#### Diagram Alur Otorisasi

```
User mengirim #CHECKSLS atau #UPDATE
                    |
                    v
          GET {API}?action=readDBSLS
                    |
                    v
    Apakah nomor user cocok dengan noHpPml atau noHPMitra?
        /                                        \
       Ya                                         Tidak
        |                                           |
        v                                           v
   Dapat mengakses fitur                   "anda tidak punya wewenang"
```

#### Verifikasi Ganda untuk `#UPDATE`

Untuk `#UPDATE`, terdapat dua lapis pemeriksaan:

1. **Cek registrasi**: Apakah nomor user terdaftar sebagai PML/PPL?
2. **Cek kepemilikan SLS**: Apakah kode SLS yang dikirimkan benar-benar milik user tersebut?

```javascript
// Layer 1: Cek registrasi
const isRegistered = records.some(
  (record) => String(record.noHPMitra) === String(no)
          || String(record.noHpPml) === String(no)
);

// Layer 2: Cek kepemilikan SLS
const slsMatch = records.some(
  (record) =>
    (String(record.noHPMitra) === String(no) &&
     String(record.kodeSLS).startsWith(String(kodesls))) ||
    (String(record.noHpPml) === String(no) &&
     String(record.kodeSLS).startsWith(String(kodesls)))
);
```

---

### 3. Fitur `#CHECKSLS`

#### Cara Kerja

1. User mengirim pesan dengan teks `#CHECKSLS`
2. Sistem mengambil seluruh data SLS dari database
3. Sistem memfilter record yang `noHpPml` atau `noHPMitra`-nya cocok dengan nomor user
4. Jika tidak ada record yang cocok → `"anda tidak punya wewenang"`
5. Jika ada yang cocok → sistem menampilkan daftar SLS user dengan label peran:
   - `(PML)` jika tercocok melalui field `noHpPml`
   - `(PPL)` jika tercocok melalui field `noHPMitra`

#### Kolom Database

Selain `kodeSLS` dan `nmsls`, setiap record SLS juga menyimpan kolom progres:

| Kolom | Untuk | Deskripsi |
|---|---|---|
| `JumlahApproved` | PML | Jumlah sampel yang sudah disetujui |
| `JumlahReject` | PML | Jumlah sampel yang ditolak |
| `jumlahSelesaiLapangan` | PPL | Jumlah sampel selesai di lapangan |
| `jumlahSubmit` | PPL | Jumlah sampel sudah disubmit |
| `statusSls` | PPL | Status SLS (`Selesai` / `Belum`) |

#### Format Respon

**Untuk PML:**
```
1. SLS001 - Desa Sukamaju (PML)
   ├ Approve: 10
   └ Reject: 5
```

**Untuk PPL:**
```
1. SLS002 - Desa Mekar Sari (PPL)
   ├ Selesai Lapangan: 8
   ├ Submit: 3
   └ Status: Selesai
```

**Contoh lengkap multi-SLS:**
```
*Daftar SLS Anda:*

1. SLS001 - Desa Sukamaju (PML)
   ├ Approve: 10
   └ Reject: 5
2. SLS002 - Desa Mekar Sari (PPL)
   ├ Selesai Lapangan: 8
   ├ Submit: 3
   └ Status: Selesai

Total SLS: 2.

Format UPDATE:
- PML: #UPDATE_{kodesls}_{jumlah Approve}_PML_{jumlah Reject}
- PPL: #UPDATE_{kodesls}_{jumlah selesai lapangan}_PPL_{jumlah Submit}_{Status SLS}

Contoh:
- #UPDATE_SLS001_10_PML_5
- #UPDATE_SLS001_10_PPL_5_Selesai
```

#### Implementasi

- **File**: `src/server.js` baris 472–497
- **Method**: `GET` ke `{API}?action=readDBSLS`
- **Filter**: `record.noHPMitra === number || record.noHpPml === number`

---

### 4. Fitur `#UPDATE`

#### Cara Kerja

1. User mengirim pesan dengan format yang sesuai
2. Sistem memvalidasi kategori (`PML` atau `PPL`)
3. Sistem memvalidasi `statusSls` (khusus PPL: harus `selesai` atau `belum`)
4. Sistem memeriksa registrasi nomor user
5. Sistem memeriksa kepemilikan SLS
6. Jika lolos semua validasi → mengirim data ke endpoint penyimpanan
7. Jika gagal → mengirim pesan error yang sesuai

#### Format Command

**PML:**
```
#UPDATE_{kodesls}_{jumlah Approve}_PML_{jumlah Reject}
```
Contoh: `#UPDATE_SLS001_10_PML_5`

**PPL:**
```
#UPDATE_{kodesls}_{jumlah selesai lapangan}_PPL_{jumlah Submit}_{Status SLS}
```
Contoh: `#UPDATE_SLS001_10_PPL_5_Selesai`

#### Regex

```javascript
/^#UPDATE_(\w+)_(\d+)_(\w+)_(\d+)(?:_(\w+))?$/i
```

| Grup | Field | Keterangan |
|---|---|---|
| `$1` | `kodesls` | Kode SLS |
| `$2` | `jumlah` | Jumlah approve (PML) / jumlah selesai lapangan (PPL) |
| `$3` | `kategori` | Harus `PML` atau `PPL` |
| `$4` | `jumlahSubmit` | Jumlah reject (PML) / jumlah submit (PPL) |
| `$5` | `statusSls` | (Opsional, khusus PPL) `selesai` atau `belum` |

#### Alur Validasi

```
Pesan masuk → Cocok regex?
     |                     |
    Ya                     Tidak → Bukan command UPDATE
     |
     v
Kategori == PML atau PPL?
     |              |
    Ya              Tidak → "kategori harus PML atau PPL"
     |
     v
PML? —Ya→ Lanjut
     |
    Tidak (PPL)
     |
     v
statusSls == "selesai" atau "belum"?
     |                          |
    Ya                          Tidak → "statusSls harus 'selesai' atau 'belum'"
     |
     v
Cek registrasi → Apakah nomor terdaftar?
     |                                |
    Ya                                Tidak → "anda tidak punya wewenang update data"
     |
     v
Cek SLS match → Apakah kodesls milik user?
     |                                   |
    Ya                                   Tidak → "sls tidak tepat"
     |
     v
Kirim ke endpoint penyimpanan
     |
     v
"data sudah terupdate" / "data gagal diupdate"
```

#### Endpoint Penyimpanan

```
GET {baseUrl}?action=save-record-message-sls
              &kodesls={kodesls}
              &no={no}
              &jumlah={jumlah}
              &kategori={kategori}
              &id={uuid}
              &jumlahSubmit={jumlahSubmit}
              &statusSls={statusLower}
```

#### Implementasi

- **File**: `src/server.js` baris 420–470
- **UUID**: Menggunakan `uuidv4()` untuk ID unik tiap update
- **Base URL**: Endpoint Google Apps Script yang sudah ditentukan

---

### 5. Ringkasan Peran

| Peran | Field di DB | `#CHECKSLS` | `#UPDATE` | Format UPDATE |
|---|---|---|---|---|
| **PML** | `noHpPml` | ✅ Lihat SLS binaan | ✅ Update SLS binaan | `#UPDATE_{kodesls}_{approve}_PML_{reject}` |
| **PPL** | `noHPMitra` | ✅ Lihat SLS tugas | ✅ Update SLS tugas | `#UPDATE_{kodesls}_{selesai}_PPL_{submit}_{status}` |
| **Lainnya** | - | ❌ Tidak punya akses | ❌ Tidak punya akses | - |

---

### 6. Sejarah Pengembangan

| Commit | Perubahan |
|---|---|
| `bdf8af0` | Awal: `#CHECKSLS` hanya untuk PPL (menggunakan `noHPMitra`). Ada command `#CHECKSLSPML` terpisah untuk PML (menggunakan `noHpPml`). |
| `3792331` | Menambahkan command `#CHECKSLSPML` |
| `9217250` | **Menggabungkan** `#CHECKSLS` dan `#CHECKSLSPML` menjadi satu command `#CHECKSLS` yang mendeteksi otomatis peran user berdasarkan pencocokan `noHPMitra` dan `noHpPml`. Command `#CHECKSLSPML` dihapus. |

### 7. File Terkait

| File | Peran |
|---|---|
| `src/server.js` | Semua logika command `#CHECKSLS` dan `#UPDATE` |
| `.env` | Konfigurasi endpoint API Google Apps Script |
