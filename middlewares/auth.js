const jwt = require("jsonwebtoken");

// Middleware: wajib login.
// Header yang dibaca: Authorization: Bearer <token>
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "token tidak ditemukan" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: "token tidak valid atau sudah kedaluwarsa" });
  }
}

// Middleware: batasi berdasarkan role. Contoh: authorize("ADMIN")
// Harus dipasang SETELAH authenticate
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "akses ditolak" });
    }
    next();
  };
}

module.exports = { authenticate, authorize };