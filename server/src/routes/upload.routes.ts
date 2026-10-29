import { Router } from "express";
import multer from "multer";
import { cloudinary } from "../config/cloudinary";
import { cloudinaryEnabled } from "../config/env";
import { requireAuth, requireRole } from "../middleware/auth";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const uploadRouter = Router();

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(400, "Only JPG, PNG or WEBP images are allowed")),
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    file.mimetype === "application/pdf" ? cb(null, true) : cb(new ApiError(400, "Only PDF files are allowed")),
});

function sendToCloudinary(buffer: Buffer, options: Record<string, unknown>) {
  return new Promise<{ secure_url: string; public_id: string; bytes: number }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) return reject(error ?? new Error("Upload failed"));
      resolve(result);
    });
    stream.end(buffer);
  });
}

function ensureConfigured() {
  if (!cloudinaryEnabled) throw new ApiError(503, "File upload is not configured on the server");
}

// Any logged-in user: avatars, payment screenshots.
uploadRouter.post(
  "/image",
  requireAuth,
  imageUpload.single("file"),
  asyncHandler(async (req, res) => {
    ensureConfigured();
    if (!req.file) throw new ApiError(400, 'Send an image in the "file" field');
    const result = await sendToCloudinary(req.file.buffer, {
      folder: `meritlab/${req.user!.id}`,
      resource_type: "image",
    });
    res.status(201).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  }),
);

// Admin side only: exam PDFs, solve sheets.
uploadRouter.post(
  "/pdf",
  requireAuth,
  requireRole("SUPER_ADMIN", "EXAM_MANAGER"),
  pdfUpload.single("file"),
  asyncHandler(async (req, res) => {
    ensureConfigured();
    if (!req.file) throw new ApiError(400, 'Send a PDF in the "file" field');
    const result = await sendToCloudinary(req.file.buffer, { folder: "meritlab/materials", resource_type: "raw", type: "authenticated" });
    res.status(201).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  }),
);
