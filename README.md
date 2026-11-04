# Remi Shake Shot

Game kartu remi multiplayer (2 sampai 4 pemain) untuk dimainkan bareng teman lewat kode meja.
Situs statis tanpa build, dengan Firebase Firestore sebagai penyimpanan bersama.

## Struktur

```
remi-shake-shot/
├── index.html            halaman utama
├── css/style.css         tampilan, kartu, meja
├── js/
│   ├── app.js            tampilan dan alur permainan
│   ├── logic.js          aturan permainan (fungsi murni, ada tesnya)
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
  "Murni" berarti tidak ada J, Q, K di tangan awal, dan angka 2 tidak boleh masuk urutan.
  Semuanya ada di `js/logic.js`.
- Data meja tidak dihapus otomatis. Hapus koleksi `games` di Firebase Console sesekali.
