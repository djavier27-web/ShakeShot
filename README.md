# Remi Shake Shot

Game kartu remi multiplayer (2 sampai 4 pemain) untuk dimainkan bareng teman lewat kode meja.
Situs statis tanpa build, dengan Firebase Firestore sebagai penyimpanan bersama.

## Struktur

```
remi-shake-shot/
├── index.html            halaman utama
├── admin.html            dashboard admin (buka di /admin)
├── css/style.css         tampilan, kartu, meja
├── js/
│   ├── app.js            tampilan dan alur permainan
│   ├── logic.js          aturan permainan (fungsi murni, ada tesnya)
│   ├── admin.js          dashboard admin: lihat meja, atur tingkat kartu pemain
│   ├── sound.js          sound effect (dibuat dengan WebAudio, tanpa file audio)
│   ├── db.js             adapter Firebase Firestore
│   └── firebase-config.js  isi dengan konfigurasi Firebase kamu
├── test/logic.test.mjs   tes aturan (npm test)
├── firestore.rules       aturan keamanan Firestore
├── vercel.json           pengaturan Vercel
└── package.json
```

## Setup Firebase (sekali saja, gratis)

1. Buka https://console.firebase.google.com, buat project baru.
2. Build > **Authentication** > Get started > Sign-in method > aktifkan **Anonymous**.
3. Build > **Firestore Database** > Create database (lokasi terdekat, misalnya asia-southeast2 Jakarta).
4. Tab **Rules**, tempel isi `firestore.rules`, lalu Publish.
5. Project settings > General > Your apps > tambah **Web app**, salin objek `firebaseConfig` ke `js/firebase-config.js`.

## Deploy ke Vercel

Lewat GitHub: push folder ini ke repo, lalu di https://vercel.com/new pilih repo tersebut.
Framework Preset: **Other**. Build Command dan Output Directory dikosongkan.

Lewat CLI:

```
npm i -g vercel
vercel --prod
```

Setelah dapat domain `*.vercel.app`, tambahkan domain itu di Firebase:
Authentication > Settings > **Authorized domains**.

## Jalankan lokal

```
npm run dev     # buka alamat yang ditampilkan
npm test        # tes aturan permainan
```

## Catatan

- Kartu semua pemain tersimpan di Firestore dan bisa dibaca siapa pun yang membuka alat developer
  browser. Cukup untuk main santai bersama teman, belum cocok untuk taruhan.
- Aturan yang ditafsirkan sendiri: pemain yang angka 2-nya kena bom dilewati sampai putaran selesai,
  "Murni" berarti tidak ada J, Q, K di tangan awal.
  Semuanya ada di `js/logic.js`.
- Angka 2 adalah joker: selain jadi kartu tertinggi, ia bisa menggantikan kartu apa pun saat dirangkai
  bersama kartu lain (dos, triple, shake shot, urutan, bom). Game memilih bacaan terkuat yang sah dan
  menampilkannya, misalnya "(2 jadi 8)". Joker butuh minimal satu kartu bukan 2, kombinasi berisi joker
  tidak bisa dipotong bom, dan 2 yang jadi 3 boleh dipakai untuk membuka permainan. Kalau satu set kartu
  bisa dibaca lebih dari satu jenis, bom lebih diutamakan, lalu shake shot, lalu urutan.
- Suara: ada tombol 🔊/🔇 di pojok atas, pilihannya tersimpan di browser. Suara mulai aktif setelah
  kamu menyentuh layar sekali (aturan browser).
- Data meja tidak dihapus otomatis. Hapus koleksi `games` di Firebase Console sesekali.
- Dashboard admin ada di `/admin` (login username dan password). Admin melihat semua meja, memilih meja,
  lalu menyetel tiap pemain: **Busuk** (kartu paling lemah, tanpa 2 dan As), **Biasa** (acak), atau **Hoki**
  (tangan "Murni" penuh 2 dan As, yang menurut aturan game langsung menang, jadi pasti juara 1). Pengaturan
  berlaku saat kartu dibagikan berikutnya, atau langsung lewat tombol "Bagikan ulang sekarang". Hoki maksimal
  3 orang per meja. Pengaturan disimpan di `games/<kode>/rig/cfg`.
- Login admin hanya pintu di tampilan: passwordnya disimpan sebagai hash di `js/admin.js`, tetapi aturan
  Firestore masih mengizinkan semua pemain menulis, dan pengaturan admin bisa dibaca lewat alat developer
  browser. Cukup untuk main santai bersama teman. Untuk pengamanan sungguhan, pakai Firebase Auth email/password
  untuk admin dan batasi penulisan `rig` di `firestore.rules`. Ganti password dengan membuat hash SHA-256 baru
  dari `username:password` lalu isi `ADMIN_HASH`.
