const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const router = express.Router();

// POST /register
// Body: { "username": "...", "password": "...", "name": "..." }
router.post("/register", async (req, res) => {
  try {
    const { username, password, name } = req.body || {};

    // kondisi paling spesifik ditaruh paling atas
    if (!username && !password) {
      return res.status(400).json({ message: "Register Gagal" });
    }

    if (!username) {
      return res.status(400).json({ message: "username harus terisi" });
    }

    if (!password) {
      return res.status(400).json({ message: "password harus terisi" });
    }

    if (!name) {
      return res.status(400).json({ message: "name harus terisi" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "password minimal 6 karakter" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, password: hashedPassword, name },
      select: { id: true, username: true, name: true },
    });

    return res.status(200).json(user);
  } catch (err) {
    // P2002 = pelanggaran unique (username sudah dipakai)
    if (err.code === "P2002") {
      return res.status(400).json({ message: "username sudah digunakan" });
    }
    console.error(err);
    return res.status(500).json({ message: "terjadi kesalahan pada server" });
  }
});

// POST /login
// Body: { "username": "...", "password": "..." }
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username && !password) {
      return res.status(400).json({ message: "Login Gagal" });
    }

    if (!username) {
      return res.status(400).json({ message: "username harus terisi" });
    }

    if (!password) {
      return res.status(400).json({ message: "password harus terisi" });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    // pesan sengaja sama untuk username salah dan password salah
    if (!user) {
      return res.status(401).json({ message: "username atau password salah" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "username atau password salah" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      id: user.id,
      username: user.username,
      name: user.name,
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "terjadi kesalahan pada server" });
  }
});

module.exports = router;