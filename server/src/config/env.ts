import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optional = z.preprocess(emptyToUndefined, z.string().optional());

const schema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // One or more allowed frontend origins, comma separated.
  CLIENT_URL: z.string().default("http://localhost:5173"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  MONGO_DB_NAME: z.string().default("meritlab"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRE: z.string().default("7d"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_REFRESH_EXPIRE: z.string().default("30d"),

  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,

  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  SMTP_FROM: optional,

  // Used only by `npm run seed`
  ADMIN_EMAIL: optional,
  ADMIN_PASSWORD: optional,
  CRON_SECRET: optional,
  ADMIN_MOBILE: z.string().default("+8801000000000"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("\nInvalid environment variables:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  console.error("\nCheck server/.env (local) or the Environment tab on Render.\n");
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

if (isProd && (/YOUR_/i.test(env.JWT_SECRET) || /YOUR_/i.test(env.JWT_REFRESH_SECRET))) {
  console.error("Refusing to start: JWT secrets still contain the YOUR_... placeholder. Set real random secrets.");
  process.exit(1);
}

export const clientOrigins = env.CLIENT_URL.split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
export const smtpEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
