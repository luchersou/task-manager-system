import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan"; 

import authRouter from "./routes/auth.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import healthCheckRouter from "./routes/healthchecker.routes.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(morgan("dev"));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Todo Task API",
    version: "1.0.0",
    endpoints: {
      healthcheck: "/api/v1/healthcheck",
      auth: "/api/v1/auth",
      projects: "/api/v1/projects",
      tasks: "/api/v1/tasks",
    },
  });
});

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use(errorHandler);

export default app;
