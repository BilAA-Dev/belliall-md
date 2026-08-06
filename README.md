# 🤖 BELLIALL-MD

**Bot WhatsApp Multi-Fitur** by HELL. Dibuat untuk memudahkan aktivitas sehari-hari dengan fitur lengkap dan stabil.

---

## 📌 FITUR UTAMA
| Perintah | Fungsi |
|----------|--------|
| `.menu` | Tampilkan semua perintah |
| `.owner` | Info owner bot |
| `.ping` | Cek kecepatan bot |
| `.runtime` | Lama bot aktif |
| `.stiker` | Buat stiker dari gambar (balas gambar) |
| `.stikergif` | Buat stiker GIF dari video |
| `.ytmp3 <url>` | Download audio YouTube |
| `.ytmp4 <url>` | Download video YouTube |
| `.welcome on/off` | Aktif/nonaktifkan pesan selamat datang di grup |
| `.public` | Mode publik (owner) |
| `.private` | Mode privat (owner) |
| `.clearall` | Hapus semua chat (owner) |

---

## 🚀 CARA DEPLOY (RAILWAY)

### 1. Persiapan
- Fork atau clone repo ini
- Upload ke GitHub (public)

### 2. Deploy ke Railway
1. Buka [railway.app](https://railway.app)
2. Login dengan GitHub
3. Klik **New Project** → **Deploy from GitHub repo**
4. Pilih repo `belliall-md`
5. Railway akan otomatis deploy
6. Lihat logs → Masukkan nomor WhatsApp
7. Cek WhatsApp → Masukkan kode pairing
8. Selesai! Bot jalan 24/7.

---

## 📦 INSTALLASI LOKAL (UNTUK TESTING)
```bash
git clone https://github.com/BilAA-Dev/belliall-md.git
cd belliall-md
npm install
npm start| `.ytmp4 <url>` | Download video YouTube |
| `.welcome on/off` | Aktif/nonaktifkan pesan selamat datang di grup |
| `.public` | Mode publik (owner) |
| `.private` | Mode privat (owner) |
| `.clearall` | Hapus semua chat (owner) |

---

## 🚀 CARA DEPLOY (RAILWAY)

### 1. Persiapan
- Fork atau clone repo ini
- Upload ke GitHub (public)

### 2. Deploy ke Railway
1. Buka [railway.app](https://railway.app)
2. Login dengan GitHub
3. Klik **New Project** → **Deploy from GitHub repo**
4. Pilih repo `belliall-md`
5. Railway akan otomatis deploy
6. Lihat logs → scan QR Code
7. Selesai! Bot jalan 24/7.

### 3. Environment Variables (Opsional)
| Variable | Keterangan |
|----------|------------|
| `OWNER_NUMBER` | Nomor WhatsApp owner (contoh: `6282298323211`) |
| `BOT_NAME` | Nama bot (default: `BELLIALL-MD`) |
| `PREFIX` | Awalan perintah (default: `.`) |
| `SESSION_ID` | Biarkan kosong, auto-generate |

---

## 📦 INSTALLASI LOKAL (UNTUK TESTING)
```bash
git clone https://github.com/BilAA-Dev/belliall-md.git
cd belliall-md
npm install
npm start
