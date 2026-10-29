import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isProd } from "../config/env";
import { ApiError } from "../utils/ApiError";

export function notFound(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: err.issues[0]?.message ?? "Invalid input",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  const e = err as { code?: number; name?: string; keyPattern?: Record<string, unknown>; message?: string };
  if (e?.code === 11000) {
    const field = Object.keys(e.keyPattern ?? {})[0] ?? "value";
    return res.status(409).json({ success: false, message: `${field} already exists` });
  }
  if (e?.name === "MulterError") {
    return res.status(400).json({ success: false, message: e.message });
  }
  console.error(err);
  res.status(500).json({ success: false, message: isProd ? "Something went wrong" : (e?.message ?? "Server error") });
}
