import { prisma } from "../prisma.js";

const healthCheck = async (req, res) => {
  const healthData = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthData.database = "Connected";
  } catch (error) {
    healthData.status = "DEGRADED";
    healthData.database = "Disconnected";
  }

  const statusCode = healthData.status === "OK" ? 200 : 503;
  return res.status(statusCode).json(healthData);
};

export { healthCheck };