import mongoose from "mongoose";
import { app } from "./app";
import { connectDb } from "./config/db";
import { cloudinaryEnabled, env, smtpEnabled } from "./config/env";
import { verifyMail } from "./services/mailer";
import "./models"; // registers every model before the first request

async function main() {
  await connectDb();

  const server = app.listen(env.PORT, () => {
    console.log(`API running on port ${env.PORT} (${env.NODE_ENV})`);
    void verifyMail();
    if (!cloudinaryEnabled) console.warn("Cloudinary not set: /api/upload will return 503.");
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Failed to start server:", error instanceof Error ? error.message : error);
  process.exit(1);
});
