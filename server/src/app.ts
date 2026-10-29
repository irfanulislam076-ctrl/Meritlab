import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { clientOrigins, isProd } from "./config/env";
import { ApiError } from "./utils/ApiError";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { apiRouter } from "./routes";

export const app = express();

// Render sits behind a proxy: needed for correct client IPs (rate limit) and Secure cookies.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(morgan(isProd ? "combined" : "dev"));

const devOrigins = isProd ? [] : ["meritlab-theta.vercel.app", "http://localhost:3000"];
const allowed = new Set([...clientOrigins, ...devOrigins]);

app.use(
  cors({
    origin(origin, cb) {
      // No Origin header = Postman, curl, server-to-server.
      if (!origin || allowed.has(origin)) return cb(null, true);
      cb(new ApiError(403, `CORS: ${origin} is not allowed. Add it to CLIENT_URL.`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests" },
  }),
);

app.get("/", (_req, res) => {
  res.json({ name: "Meritlab API", status: "running" });
});
app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);
