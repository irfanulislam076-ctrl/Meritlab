import { Router } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { tickAll } from "../services/examService";

export const cronRouter = Router();

// Call every minute from cron-job.org: GET/POST https://YOUR-API/api/cron/tick with header Authorization: Bearer <CRON_SECRET>
cronRouter.all("/tick", asyncHandler(async (req, res) => {
  if (!env.CRON_SECRET) throw new ApiError(503, "CRON_SECRET is not set");
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) throw new ApiError(401, "Unauthorized");
  res.json({ success: true, data: { checked: await tickAll() } });
}));
