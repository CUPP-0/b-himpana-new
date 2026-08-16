import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import path from "path";
import db from "./db.js";
import beritaRoutes from "./routes/beritaRoutes.js";
import artikelRoutes from "./routes/artikelRoute.js";
import router from "./routes/wa.js";
import loginmember from "./routes/memberRoutes.js";
import cabang from "./routes/cabangProvinsi.js";
import { createCanvas } from "canvas";

const app = express();

app.use(cors({
  origin: ["https://himpana.com", "https://www.himpana.com"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === KONFIGURASI ===
const FONNTE_TOKEN = "BjMWRoyrKaYJTFBsjcav"; // token kamu
const uploadDir = path.join(process.cwd(), "uploads/wa");

// Pastikan folder upload ada
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// === KONEKSI DATABASE ===


// === ROUTES UTAMA ===
app.get("/", (req, res) => {
  res.send("API Himpana berjalan 🚀");
});

// static file upload
app.use("/uploads", express.static("uploads"));

// routes berita & artikel
app.use("/api/berita", beritaRoutes);
app.use("/api/artikel", artikelRoutes);
app.use("/api/cabang", cabang)
app.use(router)
app.use(loginmember)



// === JALANKAN SERVER ===
const PORT = 5000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`✅ Server berjalan di http://${HOST}:${PORT}`);
});
