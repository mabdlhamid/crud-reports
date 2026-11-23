const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

// semua route di file ini wajib login
router.use(authenticate);

// tanggal hari ini (zona WITA) dalam format YYYY-MM-DD
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Makassar" });

// cek format tanggal YYYY-MM-DD
const isValidDate = (str) =>
  /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str));

// Ambil laporan berdasarkan :id sekaligus cek hak akses.
// Mengembalikan laporan kalau boleh, atau null (response sudah dikirim) kalau tidak.
async function getAllowedReport(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "id tidak valid" });
    return null;
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    res.status(404).json({ message: "laporan tidak ditemukan" });
    return null;
  }

  // otorisasi: pemilik laporan atau ADMIN
  if (report.userId !== req.user.id && req.user.role !== "ADMIN") {
    res.status(403).json({ message: "akses ditolak" });
    return null;
  }

  return report;
}

// POST /reports  -> buat laporan
router.post("/", async (req, res) => {
  try {
    const { date, problem, solving, kendala, saran } = req.body || {};

    if (!problem && !solving) {
      return res.status(400).json({ message: "Laporan Gagal" });
    }
    if (!problem) {
      return res.status(400).json({ message: "problem harus terisi" });
    }
    if (!solving) {
      return res.status(400).json({ message: "solving harus terisi" });
    }

    const tanggal = date || today();
    if (!isValidDate(tanggal)) {
      return res.status(400).json({ message: "format date harus YYYY-MM-DD" });
    }

    const report = await prisma.report.create({
      data: {
        date: new Date(tanggal),
        problem,
        solving,
        kendala,
        saran,
        userId: req.user.id, // diambil dari token, bukan dari body
      },
    });

    return res.status(200).json(report);
  } catch (err) {
    // P2002 = pelanggaran @@unique([userId, date])
    if (err.code === "P2002") {
      return res.status(400).json({ message: "laporan untuk tanggal ini sudah ada" });
    }
    console.error(err);
    return res.status(500).json({ message: "terjadi kesalahan pada server" });
  }
});

// GET /reports  -> daftar laporan (USER: miliknya, ADMIN: semua)
router.get("/", async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";
    const { from, to, userId } = req.query;

    // pagination: nilai dari query berupa string, ubah jadi angka
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

    // validasi filter tanggal
    if (from && !isValidDate(from)) {
      return res.status(400).json({ message: "from harus berformat YYYY-MM-DD" });
    }
    if (to && !isValidDate(to)) {
      return res.status(400).json({ message: "to harus berformat YYYY-MM-DD" });
    }

    // USER hanya boleh melihat miliknya; ADMIN boleh melihat semua atau memfilter per user
    const where = {};
    if (!isAdmin) {
      where.userId = req.user.id;
    } else if (userId) {
      where.userId = Number(userId);
    }

    // filter rentang tanggal (gte = >=, lte = <=)
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    // ambil data halaman ini dan total seluruh data, secara bersamaan
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, username: true, name: true } } },
      }),
      prisma.report.count({ where }),
    ]);

    return res.status(200).json({
      data: reports,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "terjadi kesalahan pada server" });
  }
});

// GET /reports/:id  -> satu laporan
router.get("/:id", async (req, res) => {
  try {
    const report = await getAllowedReport(req, res);
    if (!report) return;

    return res.status(200).json(report);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "terjadi kesalahan pada server" });
  }
});

// PATCH /reports/:id  -> ubah sebagian isi laporan
router.patch("/:id", async (req, res) => {
  try {
    const report = await getAllowedReport(req, res);
    if (!report) return;

    const { problem, solving, kendala, saran } = req.body || {};

    if (
      problem === undefined &&
      solving === undefined &&
      kendala === undefined &&
      saran === undefined
    ) {
      return res.status(400).json({ message: "tidak ada data yang diubah" });
    }

    // field yang tidak dikirim bernilai undefined, jadi tidak diubah oleh Prisma
    const updated = await prisma.report.update({
      where: { id: report.id },
      data: { problem, solving, kendala, saran },
    });

    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "terjadi kesalahan pada server" });
  }
});

// DELETE /reports/:id  -> hapus laporan
router.delete("/:id", async (req, res) => {
  try {
    const report = await getAllowedReport(req, res);
    if (!report) return;

    await prisma.report.delete({ where: { id: report.id } });

    return res.status(200).json({ message: "laporan dihapus" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "terjadi kesalahan pada server" });
  }
});

module.exports = router;