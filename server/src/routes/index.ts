import { Router } from "express";
import mongoose from "mongoose";
import { adminRouter } from "./admin.routes";
import { authRouter } from "./auth.routes";
import { contentRouter } from "./content.routes";
import { cronRouter } from "./cron.routes";
import { examRouter } from "./exam.routes";
import { catalogRouter } from "./catalog.routes";
import { studentRouter } from "./student.routes";
import { uploadRouter } from "./upload.routes";

export const apiRouter = Router();

// Render pings this to know the service is alive.
apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: Math.round(process.uptime()),
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/upload", uploadRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/cron", cronRouter);
apiRouter.use("/", examRouter);
apiRouter.use("/", contentRouter);
apiRouter.use("/", catalogRouter);
apiRouter.use("/", studentRouter);
