import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("neon.tech")
        ? { rejectUnauthorized: false }
        : false,
});

export async function cekKoneksiDatabase() {
    const client = await pool.connect();
    try {
        await client.query("SELECT 1");
    } finally {
        client.release();
    }
}

export async function migrasiDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS pengguna_raymond (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            nomor_hp VARCHAR(20) NOT NULL,
            password_hash TEXT NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS produk_raymond (
            id SERIAL PRIMARY KEY,
            nama VARCHAR(150) NOT NULL,
            kategori VARCHAR(80) NOT NULL,
            gambar TEXT NOT NULL,
            terjual INTEGER NOT NULL DEFAULT 0,
            deskripsi JSONB NOT NULL DEFAULT '[]',
            varian JSONB NOT NULL DEFAULT '[]',
            dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS banner_raymond (
            id SERIAL PRIMARY KEY,
            gambar TEXT NOT NULL,
            urutan INTEGER NOT NULL DEFAULT 0,
            dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

export async function cariPenggunaByUsername(username) {
    const hasil = await pool.query(
        "SELECT id, username, email, nomor_hp, password_hash, role FROM pengguna_raymond WHERE username = $1",
        [username]
    );
    return hasil.rows[0] || null;
}

export async function cariPenggunaById(id) {
    const hasil = await pool.query(
        "SELECT id, username, email, nomor_hp, role FROM pengguna_raymond WHERE id = $1",
        [id]
    );
    return hasil.rows[0] || null;
}

export async function buatPengguna({ username, email, nomorHp, passwordHash }) {
    const hasil = await pool.query(
        `INSERT INTO pengguna_raymond (username, email, nomor_hp, password_hash, role)
         VALUES ($1, $2, $3, $4, 'user')
         RETURNING id, username, email, nomor_hp, role`,
        [username, email, nomorHp, passwordHash]
    );
    return hasil.rows[0];
}

export async function ambilSemuaProduk() {
    const hasil = await pool.query(
        "SELECT id, nama, kategori, gambar, terjual, deskripsi, varian FROM produk_raymond ORDER BY id DESC"
    );
    return hasil.rows;
}

export async function ambilProdukById(id) {
    const hasil = await pool.query(
        "SELECT id, nama, kategori, gambar, terjual, deskripsi, varian FROM produk_raymond WHERE id = $1",
        [id]
    );
    return hasil.rows[0] || null;
}

export async function buatProduk({ nama, kategori, gambar, terjual, deskripsi, varian }) {
    const hasil = await pool.query(
        `INSERT INTO produk_raymond (nama, kategori, gambar, terjual, deskripsi, varian)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nama, kategori, gambar, terjual, deskripsi, varian`,
        [nama, kategori, gambar, terjual || 0, JSON.stringify(deskripsi || []), JSON.stringify(varian || [])]
    );
    return hasil.rows[0];
}

export async function perbaruiProduk(id, { nama, kategori, gambar, terjual, deskripsi, varian }) {
    const hasil = await pool.query(
        `UPDATE produk_raymond
         SET nama = $1, kategori = $2, gambar = $3, terjual = $4, deskripsi = $5, varian = $6, diperbarui_pada = NOW()
         WHERE id = $7
         RETURNING id, nama, kategori, gambar, terjual, deskripsi, varian`,
        [nama, kategori, gambar, terjual || 0, JSON.stringify(deskripsi || []), JSON.stringify(varian || []), id]
    );
    return hasil.rows[0] || null;
}

export async function hapusProduk(id) {
    const hasil = await pool.query("DELETE FROM produk_raymond WHERE id = $1 RETURNING id", [id]);
    return hasil.rows[0] || null;
}

export async function ambilSemuaBanner() {
    const hasil = await pool.query(
        "SELECT id, gambar, urutan FROM banner_raymond ORDER BY urutan ASC, id ASC"
    );
    return hasil.rows;
}

export async function gantiSemuaBanner(daftarGambar) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("DELETE FROM banner_raymond");
        for (let i = 0; i < daftarGambar.length; i++) {
            await client.query(
                "INSERT INTO banner_raymond (gambar, urutan) VALUES ($1, $2)",
                [daftarGambar[i], i]
            );
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
    return ambilSemuaBanner();
}

export async function perbaruiProfilPengguna(id, { username, email, nomorHp }) {
    const hasil = await pool.query(
        `UPDATE pengguna_raymond
         SET username = $1, email = $2, nomor_hp = $3
         WHERE id = $4
         RETURNING id, username, email, nomor_hp, role`,
        [username, email, nomorHp, id]
    );
    return hasil.rows[0] || null;
}

export async function gantiPasswordPengguna(id, passwordHash) {
    const hasil = await pool.query(
        "UPDATE pengguna_raymond SET password_hash = $1 WHERE id = $2 RETURNING id",
        [passwordHash, id]
    );
    return hasil.rows[0] || null;
}

export async function ambilPasswordHashById(id) {
    const hasil = await pool.query(
        "SELECT password_hash FROM pengguna_raymond WHERE id = $1",
        [id]
    );
    return hasil.rows[0] || null;
}

export async function ambilPenggunaBerhalaman({ halaman, batas, cari }) {
    const offset = (halaman - 1) * batas;
    const kataKunci = "%" + (cari || "") + "%";

    const hasilData = await pool.query(
        `SELECT id, username, email, nomor_hp, role, dibuat_pada
         FROM pengguna_raymond
         WHERE username ILIKE $1 OR email ILIKE $1 OR nomor_hp ILIKE $1
         ORDER BY dibuat_pada DESC
         LIMIT $2 OFFSET $3`,
        [kataKunci, batas, offset]
    );

    const hasilTotal = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM pengguna_raymond
         WHERE username ILIKE $1 OR email ILIKE $1 OR nomor_hp ILIKE $1`,
        [kataKunci]
    );

    return { pengguna: hasilData.rows, total: hasilTotal.rows[0].total };
}

export default pool;
