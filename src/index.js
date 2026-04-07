require("dotenv").config();
const prisma = require("./config/prismaClient");
const app = require("./app");

const PORT = process.env.PORT || 3000;

async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Database connected");
    return true;
  } catch (error) {
    console.error("✗ Database connection failed:", error.message);
    return false;
  }
}

async function startServer() {
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();