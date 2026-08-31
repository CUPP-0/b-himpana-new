import express from "express";
import fs from "fs";
import path from "path";
import { createCanvas, loadImage, registerFont } from "canvas";
import db from "../db.js";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import { fileURLToPath } from "url";
const { Client, LocalAuth, MessageMedia } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

/* ======================================================
   📁 Folder upload
====================================================== */
const uploadDir = "uploads/wa";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* ======================================================
   🖋️ Register font
====================================================== */
registerFont(path.join(__dirname, "../fonts/ARIALBD.TTF"), {
  family: "ArialBold",
});

/* ======================================================
   ⚙️ Setup WhatsApp Web Client
====================================================== */
// ⚙️ Setup WhatsApp Web Client - PERBAIKAN
let clientReady = false;
let isReconnecting = false;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./wa-session" }),
  puppeteer: {
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
});

// Fungsi restart client
const restartClient = async () => {
  if (isReconnecting) return;

  isReconnecting = true;
  console.log("🔄 Restarting WhatsApp client...");

  try {
    await client.destroy();
    await client.initialize();
    isReconnecting = false;
  } catch (error) {
    console.error("❌ Gagal restart client:", error);
    isReconnecting = false;
  }
};

client.on("qr", (qr) => {
  console.log("📱 Scan QR untuk login WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("🔐 WhatsApp berhasil authenticated!");
});

client.on("ready", () => {
  console.log("✅ WhatsApp Web siap digunakan!");
  clientReady = true;
});

client.on("auth_failure", (msg) => {
  console.error("❌ AUTH FAILURE:", msg);
});

client.on("disconnected", (reason) => {
  console.error("❌ DISCONNECTED:", reason);
});

client.on("loading_screen", (percent, message) => {
  console.log(`⏳ LOADING: ${percent}% - ${message}`);
});

client.on("change_state", (state) => {
  console.log(`🔄 STATE: ${state}`);
});

client.on("error", (error) => {
  console.error("💥 CLIENT ERROR:", error);
});

client.on("disconnected", (reason) => {
  console.error("❌ WhatsApp Client terputus:", reason);
  clientReady = false;

  // JANGAN restart otomatis dulu
});

client.on("remote_session_saved", () => {
  console.log("💾 Session saved remotely");
});

console.log("🚀 Memulai WhatsApp client...");

client.on("authenticated", async () => {
  console.log("🔐 WhatsApp berhasil authenticated!");

  try {
    const info = await client.pupPage.evaluate(() => ({
      debugVersion: window.Debug?.VERSION ?? null,
      authStore: typeof window.AuthStore,
      store: typeof window.Store,
      wwebjs: typeof window.WWebJS,
      readyState: document.readyState
    }));

    console.log("📊 BEFORE STORE:", info);

    await client.pupPage.waitForFunction(
      'window.Store != undefined',
      { timeout: 10000 }
    );

    console.log("✅ window.Store sudah tersedia!");

  } catch (err) {
    console.error("❌ window.Store TIDAK tersedia:", err.message);
  }
});

client.initialize()
  .then(() => {
    console.log("✅ initialize() selesai dipanggil");
  })
  .catch((error) => {
    console.error("❌ initialize() gagal:", error);
  });

/* ======================================================
   🧮 Fungsi Generate Card Number otomatis
====================================================== */
function generateCardNumber() {
  const part1 = String(Math.floor(Math.random() * 999)).padStart(3, "0");
  const part2 = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  return `NA. ${part1}.${part2}`;
}

/* ======================================================
   🔍 Validasi Format Retirement Number
====================================================== */
function isValidRetirementNumber(value) {
  const pattern = /^\d{2}-\d-\d{6}-\d{2}$/;
  return pattern.test(value);
}

/* ======================================================
   📩 ROUTE: Tambah Member Baru
====================================================== */
/* ======================================================
   📩 FUNGSI: Kirim WhatsApp dengan Error Handling
====================================================== */
async function sendWhatsAppMessage(chatId, media, caption, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!clientReady) {
        throw new Error("WhatsApp client belum siap");
      }

      // Pastikan nomor dalam format yang benar
      let phone = String(chatId)
        .replace("@c.us", "")
        .replace(/\D/g, "");

      if (phone.startsWith("0")) {
        phone = "62" + phone.substring(1);
      }

      if (!phone.startsWith("62")) {
        phone = "62" + phone;
      }

      const whatsappId = `${phone}@c.us`;

      console.log("📱 Nomor asli :", chatId);
      console.log("📱 Nomor WA   :", whatsappId);

      // Cek apakah nomor terdaftar di WhatsApp
      const numberId = await client.getNumberId(phone);

      if (!numberId) {
        throw new Error(
          `Nomor ${phone} tidak terdaftar di WhatsApp`
        );
      }

      console.log("✅ Nomor WhatsApp ditemukan:", numberId._serialized);

      // Kirim caption
      if (caption) {
        await client.sendMessage(
          numberId._serialized,
          caption
        );

        console.log("✅ Caption berhasil dikirim");
      }

      // Kirim media
      if (media) {
        await client.sendMessage(
          numberId._serialized,
          media,
          {
            caption: "🎫 Ini kartu anggota anda",
          }
        );

        console.log("✅ ID Card berhasil dikirim");
      }

      console.log("✅ Pesan WhatsApp berhasil dikirim");

      return true;
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${retries} gagal`);

      console.error("Type:", typeof error);
      console.error("Error:", error);
      console.error("Message:", error?.message);
      console.error("Stack:", error?.stack);

      if (attempt === retries) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 2000 * attempt)
      );

      if (
        error?.message?.includes("Execution context was destroyed") ||
        error?.message?.includes("Session closed")
      ) {
        console.log("🔄 Execution context bermasalah, restart client...");
        await restartClient();
      }
    }
  }
}

// 📩 ROUTE: Tambah Member Baru - PERBAIKAN
router.post("/api/kirim-member", async (req, res) => {
  const {
    name,
    retirement_number,
    phone_number,
    birth_date,
    address,
    city,
    branch_id,
  } = req.body;

  if (
    !name ||
    !retirement_number ||
    !phone_number ||
    !birth_date ||
    !address ||
    !city ||
    !branch_id
  ) {
    return res
      .status(400)
      .json({ status: "error", message: "Data tidak lengkap" });
  }

  if (!isValidRetirementNumber(retirement_number)) {
    return res.status(400).json({
      status: "error",
      message: "Format retirement_number tidak valid! Contoh: 01-9-311589-40",
    });
  }

  let filePath = null;

  try {
    const branchIdInt = parseInt(branch_id, 10);

    // === Ambil kode cabang dari tabel branches ===
    const branchCode = await new Promise((resolve, reject) => {
      db.query(
        "SELECT code FROM branches WHERE id = ?",
        [branchIdInt],
        (err, results) => {
          if (err) return reject(err);
          if (results.length === 0)
            return reject(new Error("Cabang tidak ditemukan."));
          resolve(results[0].code);
        },
      );
    });

    // === Ambil nomor urut terakhir berdasarkan cabang ===
    let lastNumber = await new Promise((resolve, reject) => {
      db.query(
        `
      SELECT 
        CAST(SUBSTRING_INDEX(card_number, '.', -1) AS UNSIGNED) AS urut
      FROM members
      WHERE branch_id = ? AND card_number LIKE CONCAT('NA. ', ?, '.%')
      ORDER BY urut DESC
      LIMIT 1
      `,
        [branchIdInt, branchCode],
        (err, results) => {
          if (err) return reject(err);
          if (results.length === 0) return resolve(0); // Belum ada data di cabang ini
          resolve(results[0].urut || 0);
        },
      );
    });

    // === Cari nomor unik ===
    let newNumber, card_number, exists;
    do {
      newNumber = String(++lastNumber).padStart(5, "0");
      card_number = `NA. ${branchCode}.${newNumber}`;

      exists = await new Promise((resolve, reject) => {
        db.query(
          "SELECT COUNT(*) AS total FROM members WHERE card_number = ?",
          [card_number],
          (err, results) => {
            if (err) return reject(err);
            resolve(results[0].total > 0);
          },
        );
      });
    } while (exists);

    // === Generate ID card ===
    const templatePath = path.resolve("assets/ID_CARD_FRONT_2024.jpg");
    const template = await loadImage(templatePath);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(template, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px ArialBold";
    ctx.fillText(name.toUpperCase(), 47, 520);

    ctx.font = "bold 28px ArialBold";
    ctx.fillText(card_number, 47, 560);

    ctx.fillStyle = "#000000";
    ctx.font = "28px ArialBold";
    ctx.fillText(`NP. ${retirement_number}`, 715, 330);

    const filename = `idcard-${Date.now()}.jpg`;
    filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(
      filePath,
      canvas.toBuffer("image/jpeg", { quality: 0.95 }),
    );

    const fotoPath = `/uploads/wa/${filename}`;

    // === Simpan ke database ===
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO members (name, retirement_number, card_number, phone_number, birth_date, address, city, card_image_path, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          retirement_number,
          card_number,
          phone_number,
          birth_date,
          address,
          city,
          fotoPath,
          branchIdInt,
        ],
        (err, results) => {
          if (err) {
            if (err.code === "ER_DUP_ENTRY") {
              return reject({
                type: "duplicate",
                message: `Nomor pensiun ${retirement_number} sudah terdaftar!`,
              });
            }
            return reject({
              type: "database",
              message: "Kesalahan saat menyimpan data ke database.",
              detail: err.message,
            });
          }
          resolve(results);
        },
      );
    });

    console.log(
      "🧩 Member tersimpan di database:",
      name,
      retirement_number,
      card_number,
    );

    // === Kirim ke WhatsApp ===
    try {
      let phoneNumber = phone_number.replace(/[^0-9]/g, "");
      if (phoneNumber.startsWith("0"))
        phoneNumber = "62" + phoneNumber.slice(1);
      else if (!phoneNumber.startsWith("62")) phoneNumber = "62" + phoneNumber;
      const chatId = phoneNumber + "@c.us";

      const caption = `Selamat ${name}, Anda telah resmi menjadi anggota baru HIMPANA`;
      const media = MessageMedia.fromFilePath(filePath);

      // === Kirim media pertama (depan) ===
      await sendWhatsAppMessage(chatId, media, caption);

      // === Kirim media kedua (belakang) ===
      const backImagePath = path.resolve("assets/belakang-kta.png");
      const mediaBack = MessageMedia.fromFilePath(backImagePath);

      await sendWhatsAppMessage(
        chatId,
        mediaBack,
        "Ini adalah kartu anggota sisi belakang. Terima kasih telah menjadi bagian dari keluarga besar HIMPANA.",
      );

      return res.json({
        status: "success",
        message: "Data tersimpan dan ID Card berhasil dikirim ke WhatsApp.",
        foto_idcard: fotoPath,
        data: { name, retirement_number, card_number, branch_id },
      });
    } catch (waError) {
      console.warn("⚠️ Gagal kirim ke WhatsApp:", waError.message);

      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }

      return res.json({
        status: "warning",
        message:
          "Data tersimpan, tapi gagal kirim ke WhatsApp: " + waError.message,
        foto_idcard: null,
      });
    }
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
      } catch (cleanupError) {
        console.warn("⚠️ Gagal hapus file sementara:", cleanupError.message);
      }
    }

    console.error("❌ Error utama:", error);

    if (error.type === "duplicate") {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Gagal membuat atau menyimpan data member.",
      detail: error.message,
    });
  }
});

/* ======================================================
   ✏️ ROUTE: Update Member
====================================================== */
async function handleUpdateMember(req, res) {
  const {
    id,
    member_id,
    name,
    old_retirement_number,
    retirement_number,
    phone_number,
    birth_date,
    address,
    city,
  } = req.body;

  const targetMemberId = id ?? member_id ?? null;
  const finalName = String(name ?? "").trim();
  const finalOldRetirementNumber = String(old_retirement_number ?? "").trim();
  const finalRetirementNumber = String(retirement_number ?? "").trim();

  console.log("[UPDATE MEMBER] Request diterima:", {
    targetMemberId,
    name: finalName,
    old_retirement_number: finalOldRetirementNumber,
    retirement_number: finalRetirementNumber,
    phone_number,
    birth_date,
    city,
  });

  if (
    !finalName ||
    !finalRetirementNumber ||
    !phone_number ||
    !birth_date ||
    !address ||
    !city ||
    (!finalOldRetirementNumber && !targetMemberId)
  ) {
    console.warn("[UPDATE MEMBER] validasi gagal: data tidak lengkap", {
      targetMemberId,
      finalName,
      finalOldRetirementNumber,
      finalRetirementNumber,
      phone_number,
      birth_date,
      address: Boolean(address),
      city,
    });
    return res.status(400).json({
      status: "error",
      message: "Data tidak lengkap. Pastikan semua field terisi.",
    });
  }

  if (!isValidRetirementNumber(finalRetirementNumber)) {
    console.warn("[UPDATE MEMBER] validasi gagal: format retirement_number salah", {
      finalRetirementNumber,
    });
    return res.status(400).json({
      status: "error",
      message: "Format retirement_number tidak valid! Contoh: 01-9-311589-40",
    });
  }

  try {
    let oldRetirementNumber = finalOldRetirementNumber;
    let oldFotoPath = null;

    if (targetMemberId) {
      console.log("[UPDATE MEMBER] Cari member berdasarkan id:", targetMemberId);
      const [memberRows] = await db
        .promise()
        .query(
          "SELECT retirement_number, card_image_path FROM members WHERE id = ? LIMIT 1",
          [targetMemberId],
        );

      if (!memberRows.length) {
        console.warn("[UPDATE MEMBER] member dengan id tidak ditemukan:", targetMemberId);
        return res.status(404).json({
          status: "error",
          message: "Data member tidak ditemukan.",
        });
      }

      oldRetirementNumber = memberRows[0].retirement_number;
      oldFotoPath = memberRows[0].card_image_path;
    } else {
      console.log("[UPDATE MEMBER] Cari member berdasarkan nomor pensiun lama:", oldRetirementNumber);
      const [oldData] = await db
        .promise()
        .query(
          "SELECT retirement_number, card_image_path FROM members WHERE retirement_number = ? LIMIT 1",
          [oldRetirementNumber],
        );

      if (!oldData.length) {
        console.warn("[UPDATE MEMBER] member lama tidak ditemukan:", oldRetirementNumber);
        return res.status(404).json({
          status: "error",
          message: "Data member lama tidak ditemukan.",
        });
      }

      oldRetirementNumber = oldData[0].retirement_number;
      oldFotoPath = oldData[0].card_image_path;
    }

    if (finalRetirementNumber !== oldRetirementNumber) {
      console.log("[UPDATE MEMBER] Cek duplikasi nomor pensiun baru:", finalRetirementNumber);
      const [dupeCheck] = await db
        .promise()
        .query(
          "SELECT retirement_number FROM members WHERE retirement_number = ? LIMIT 1",
          [finalRetirementNumber],
        );

      if (dupeCheck.length > 0) {
        console.warn("[UPDATE MEMBER] Duplikasi nomor pensiun terdeteksi:", finalRetirementNumber);
        return res.status(400).json({
          status: "error",
          message: `Nomor pensiun ${finalRetirementNumber} sudah terdaftar!`,
        });
      }
    }

    if (oldFotoPath) {
      const normalizedOldPath = oldFotoPath.startsWith("/")
        ? `.${oldFotoPath}`
        : oldFotoPath;

      console.log("[UPDATE MEMBER] Hapus foto lama jika ada:", normalizedOldPath);
      if (fs.existsSync(normalizedOldPath)) {
        await fs.promises.unlink(normalizedOldPath);
      }
    }

    const card_number = generateCardNumber();
    console.log("[UPDATE MEMBER] Generate nomor kartu baru:", card_number);
    const templatePath = path.resolve("assets/ID_CARD_FRONT_2024.jpg");
    const template = await loadImage(templatePath);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(template, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px ArialBold";
    ctx.fillText(finalName.toUpperCase(), 47, 520);

    ctx.font = "bold 28px ArialBold";
    ctx.fillText(`NP. ${finalRetirementNumber}`, 47, 560);

    ctx.fillStyle = "#000000";
    ctx.font = "28px ArialBold";
    ctx.fillText(card_number, 715, 330);

    const filename = `idcard-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(
      filePath,
      canvas.toBuffer("image/jpeg", { quality: 0.95 }),
    );

    const fotoPath = `/uploads/wa/${filename}`;
    console.log("[UPDATE MEMBER] Simpan ID Card baru dengan path:", fotoPath);

    const updateQuery = targetMemberId
      ? "UPDATE members SET name=?, retirement_number=?, phone_number=?, birth_date=?, address=?, city=?, card_image_path=? WHERE id=?"
      : "UPDATE members SET name=?, retirement_number=?, phone_number=?, birth_date=?, address=?, city=?, card_image_path=? WHERE retirement_number=?";

    const updateParams = targetMemberId
      ? [
          finalName,
          finalRetirementNumber,
          phone_number,
          birth_date,
          address,
          city,
          fotoPath,
          targetMemberId,
        ]
      : [
          finalName,
          finalRetirementNumber,
          phone_number,
          birth_date,
          address,
          city,
          fotoPath,
          oldRetirementNumber,
        ];

    console.log("[UPDATE MEMBER] Jalankan query update dengan data:", {
      targetMemberId,
      oldRetirementNumber,
      newRetirementNumber: finalRetirementNumber,
      name: finalName,
      city,
      fotoPath,
    });

    await db.promise().query(updateQuery, updateParams);

    console.log("[UPDATE MEMBER] Update berhasil:", {
      targetMemberId,
      name: finalName,
      retirement_number: finalRetirementNumber,
      card_number,
      fotoPath,
    });

    return res.json({
      status: "success",
      message: "Data berhasil diperbarui dan ID Card baru dibuat",
      foto_idcard: fotoPath,
      data: {
        name: finalName,
        retirement_number: finalRetirementNumber,
        card_number,
      },
    });
  } catch (error) {
    console.error("❌ Gagal update member:", {
      targetMemberId,
      oldRetirementNumber: finalOldRetirementNumber,
      newRetirementNumber: finalRetirementNumber,
      name: finalName,
      phone_number,
      city,
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        status: "error",
        message: `Nomor pensiun ${finalRetirementNumber} sudah terdaftar di sistem.`,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Gagal update data atau membuat ID Card baru",
      detail: error.message,
    });
  }
}

router.post("/api/update-member", handleUpdateMember);
router.put("/api/update-member", handleUpdateMember);

router.get("/api/member", async (req, res) => {
  try {
    const { branch_id, city, name } = req.query;

    // 🔹 Siapkan query dasar
    let sql = `
      SELECT 
        m.id,
        m.name,
        m.retirement_number,
        m.card_number,
        m.phone_number,
        m.birth_date,
        m.address,
        m.city,
        m.card_image_path,
        m.created_at,
        m.branch_id,
        b.name AS branch_name,
        b.code AS branch_code
      FROM members m
      LEFT JOIN branches b ON m.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    // 🔹 Filter opsional
    if (branch_id) {
      sql += " AND m.branch_id = ?";
      params.push(branch_id);
    }
    if (city) {
      sql += " AND m.city LIKE ?";
      params.push(`%${city}%`);
    }
    if (name) {
      sql += " AND m.name LIKE ?";
      params.push(`%${name}%`);
    }

    sql += " ORDER BY m.created_at DESC";

    // 🔹 Jalankan query
    const results = await new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    if (!results.length) {
      return res.status(404).json({
        status: "empty",
        message: "Belum ada data member yang cocok.",
        data: [],
      });
    }

    return res.json({
      status: "success",
      message: "Data member berhasil diambil.",
      total: results.length,
      data: results,
    });
  } catch (error) {
    console.error("❌ Error GET /api/member:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Gagal mengambil data member.",
      detail: error.message,
    });
  }
});

// 🗑️ Hapus member berdasarkan ID
router.delete("/api/member/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 🔹 Cek apakah member ada
    const check = await new Promise((resolve, reject) => {
      db.query("SELECT id FROM members WHERE id = ?", [id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    if (!check.length) {
      return res.status(404).json({
        status: "not_found",
        message: "Member tidak ditemukan.",
      });
    }

    // 🔹 Hapus data member
    await new Promise((resolve, reject) => {
      db.query("DELETE FROM members WHERE id = ?", [id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return res.json({
      status: "success",
      message: "Member berhasil dihapus.",
    });
  } catch (error) {
    console.error("❌ Error DELETE /api/member:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Gagal menghapus member.",
      detail: error.message,
    });
  }
});

export default router;
