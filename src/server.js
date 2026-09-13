import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import {
    cekKoneksiDatabase,
    migrasiDatabase,
    cariPenggunaByUsername,
    cariPenggunaById,
    buatPengguna,
    ambilSemuaProduk,
    buatProduk,
    perbaruiProduk,
    hapusProduk,
    ambilSemuaBanner,
    gantiSemuaBanner,
    perbaruiProfilPengguna,
    gantiPasswordPengguna,
    ambilPasswordHashById,
} from "./db.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT;

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 8,
        },
    })
);

function wajibLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Belum login" });
    }
    next();
}

function wajibAdmin(req, res, next) {
    if (!req.session.userId || req.session.role !== "admin") {
        return res.status(403).json({ error: "Akses ditolak" });
    }
    next();
}

app.post("/api/register", async (req, res) => {
    try {
        const { username, email, nomorHp, password, konfirmasiPassword } = req.body;

        if (!username || !email || !nomorHp || !password) {
            return res.status(400).json({ error: "Semua field wajib diisi" });
        }
        if (password !== konfirmasiPassword) {
            return res.status(400).json({ error: "Konfirmasi password tidak cocok" });
        }

        const penggunaAda = await cariPenggunaByUsername(username);
        if (penggunaAda) {
            return res.status(409).json({ error: "Username sudah digunakan" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const pengguna = await buatPengguna({ username, email, nomorHp, passwordHash });

        req.session.userId = pengguna.id;
        req.session.role = pengguna.role;

        res.json({ username: pengguna.username, role: pengguna.role });
    } catch (error) {
        console.error("Gagal registrasi:", error.message);
        res.status(500).json({ error: "Gagal membuat akun" });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username dan password wajib diisi" });
        }

        const pengguna = await cariPenggunaByUsername(username);
        if (!pengguna) {
            return res.status(401).json({ error: "Username atau password salah" });
        }

        const cocok = await bcrypt.compare(password, pengguna.password_hash);
        if (!cocok) {
            return res.status(401).json({ error: "Username atau password salah" });
        }

        req.session.userId = pengguna.id;
        req.session.role = pengguna.role;

        res.json({ username: pengguna.username, role: pengguna.role });
    } catch (error) {
        console.error("Gagal login:", error.message);
        res.status(500).json({ error: "Gagal login" });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ berhasil: true });
    });
});

app.get("/api/me", async (req, res) => {
    if (!req.session.userId) {
        return res.json({ login: false });
    }
    const pengguna = await cariPenggunaById(req.session.userId);
    if (!pengguna) {
        return res.json({ login: false });
    }
    res.json({ login: true, username: pengguna.username, role: pengguna.role });
});

app.get("/api/produk-publik", async (req, res) => {
    try {
        const daftarProduk = await ambilSemuaProduk();
        res.json({ produk: daftarProduk });
    } catch (error) {
        console.error("Gagal ambil produk publik:", error.message);
        res.status(500).json({ error: "Gagal mengambil daftar produk" });
    }
});

app.get("/api/banner-publik", async (req, res) => {
    try {
        const daftarBanner = await ambilSemuaBanner();
        res.json({ banner: daftarBanner });
    } catch (error) {
        console.error("Gagal ambil banner publik:", error.message);
        res.status(500).json({ error: "Gagal mengambil banner" });
    }
});

app.get("/api/produk", wajibAdmin, async (req, res) => {
    try {
        const daftarProduk = await ambilSemuaProduk();
        res.json({ produk: daftarProduk });
    } catch (error) {
        console.error("Gagal ambil produk:", error.message);
        res.status(500).json({ error: "Gagal mengambil daftar produk" });
    }
});

app.post("/api/produk", wajibAdmin, async (req, res) => {
    try {
        const { nama, kategori, gambar, terjual, deskripsi, varian } = req.body;
        if (!nama || !kategori || !gambar) {
            return res.status(400).json({ error: "Nama, kategori, dan gambar wajib diisi" });
        }
        const produk = await buatProduk({ nama, kategori, gambar, terjual, deskripsi, varian });
        res.json({ produk });
    } catch (error) {
        console.error("Gagal buat produk:", error.message);
        res.status(500).json({ error: "Gagal menyimpan produk" });
    }
});

app.put("/api/produk/:id", wajibAdmin, async (req, res) => {
    try {
        const { nama, kategori, gambar, terjual, deskripsi, varian } = req.body;
        if (!nama || !kategori || !gambar) {
            return res.status(400).json({ error: "Nama, kategori, dan gambar wajib diisi" });
        }
        const produk = await perbaruiProduk(req.params.id, { nama, kategori, gambar, terjual, deskripsi, varian });
        if (!produk) {
            return res.status(404).json({ error: "Produk tidak ditemukan" });
        }
        res.json({ produk });
    } catch (error) {
        console.error("Gagal perbarui produk:", error.message);
        res.status(500).json({ error: "Gagal memperbarui produk" });
    }
});

app.delete("/api/produk/:id", wajibAdmin, async (req, res) => {
    try {
        const dihapus = await hapusProduk(req.params.id);
        if (!dihapus) {
            return res.status(404).json({ error: "Produk tidak ditemukan" });
        }
        res.json({ berhasil: true });
    } catch (error) {
        console.error("Gagal hapus produk:", error.message);
        res.status(500).json({ error: "Gagal menghapus produk" });
    }
});

app.get("/api/banner", wajibAdmin, async (req, res) => {
    try {
        const daftarBanner = await ambilSemuaBanner();
        res.json({ banner: daftarBanner });
    } catch (error) {
        console.error("Gagal ambil banner:", error.message);
        res.status(500).json({ error: "Gagal mengambil banner" });
    }
});

app.put("/api/banner", wajibAdmin, async (req, res) => {
    try {
        const { gambar } = req.body;
        if (!Array.isArray(gambar) || gambar.length === 0) {
            return res.status(400).json({ error: "Minimal satu gambar banner wajib diisi" });
        }
        const daftarBanner = await gantiSemuaBanner(gambar);
        res.json({ banner: daftarBanner });
    } catch (error) {
        console.error("Gagal ganti banner:", error.message);
        res.status(500).json({ error: "Gagal mengganti banner" });
    }
});

app.put("/api/profil", wajibLogin, async (req, res) => {
    try {
        const { username, email, nomorHp } = req.body;
        if (!username || !email || !nomorHp) {
            return res.status(400).json({ error: "Semua field wajib diisi" });
        }
        const pengguna = await perbaruiProfilPengguna(req.session.userId, { username, email, nomorHp });
        if (!pengguna) {
            return res.status(404).json({ error: "Pengguna tidak ditemukan" });
        }
        res.json({ pengguna });
    } catch (error) {
        console.error("Gagal perbarui profil:", error.message);
        res.status(500).json({ error: "Gagal memperbarui profil" });
    }
});

app.put("/api/profil/password", wajibLogin, async (req, res) => {
    try {
        const { passwordLama, passwordBaru } = req.body;
        if (!passwordLama || !passwordBaru) {
            return res.status(400).json({ error: "Password lama dan baru wajib diisi" });
        }
        const data = await ambilPasswordHashById(req.session.userId);
        if (!data) {
            return res.status(404).json({ error: "Pengguna tidak ditemukan" });
        }
        const cocok = await bcrypt.compare(passwordLama, data.password_hash);
        if (!cocok) {
            return res.status(401).json({ error: "Password lama salah" });
        }
        const passwordHash = await bcrypt.hash(passwordBaru, 10);
        await gantiPasswordPengguna(req.session.userId, passwordHash);
        res.json({ berhasil: true });
    } catch (error) {
        console.error("Gagal ganti password:", error.message);
        res.status(500).json({ error: "Gagal mengganti password" });
    }
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
    res.redirect("/app");
});

app.get("/app", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/auth", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "auth.html"));
});

app.get("/app/owner", (req, res) => {
    if (!req.session.userId || req.session.role !== "admin") {
        return res.redirect("/auth");
    }
    res.sendFile(path.join(__dirname, "..", "public", "owner.html"));
});

app.get("/app/health", (req, res) => {
    res.json({ status: "ok" });
});

const MODE = process.env.NODE_ENV === "production" ? "production" : "development";

async function mulaiServer() {
    await cekKoneksiDatabase();
    console.log("Koneksi database berhasil");

    await migrasiDatabase();
    console.log("Migrasi database selesai");

    if (MODE === "development") {
        app.listen(PORT, () => {
            console.log(`Server berjalan di port ${PORT} (development)`);
        });
    } else {
        console.log("Server berjalan dalam mode production (serverless)");
    }
}

mulaiServer().catch((error) => {
    console.error("Gagal koneksi ke database:", error.message);
    if (MODE === "development") process.exit(1);
});

export default app;
