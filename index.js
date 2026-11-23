require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authRouter = require("./routes/auth");
const reportsRouter = require("./routes/reports");
const { authenticate, authorize } = require("./middlewares/auth");

const app = express();

// middleware: urutan penting, harus sebelum router
app.use(cors());
app.use(express.json());

// halaman utama (menghilangkan "Cannot GET /")
app.get("/", (req, res) => {
  res.json({ message: "API Laporan Magang berjalan" });
});

// pasang router (setelah express.json)
app.use(authRouter);

// route percobaan untuk mengetes middleware (boleh dihapus nanti)
app.get("/me", authenticate, (req, res) => {
  res.status(200).json(req.user);
});

app.get("/admin", authenticate, authorize("ADMIN"), (req, res) => {
  res.status(200).json({ message: "halo admin" });
});
app.use("/reports", reportsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});