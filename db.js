import mysql from "mysql2";

const db = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "backend_himpana",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.query("SELECT 1", (err) => {
  if (err) {
    console.error("❌ Gagal koneksi database:", err);
  } else {
    console.log("✅ Koneksi database berhasil!");
  }
});

export default db;