const { PrismaClient } = require("@prisma/client");

// satu instance saja, dipakai bersama oleh semua file
const prisma = new PrismaClient();

module.exports = prisma;