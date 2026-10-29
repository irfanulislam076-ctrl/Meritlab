import type { NextFunction, Request, Response } from "express";
import { UserModel, type Role } from "../models";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/tokens";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: Role };
  }
}

/** Reads `Authorization: Bearer <accessToken>`. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Login required");

    let payload;
    try {
      payload = verifyAccessToken(header.slice(7));
    } catch {
      throw new ApiError(401, "Session expired, please log in again");
    }

    const user = await UserModel.findById(payload.sub).select("role blocked").lean();
    if (!user || user.blocked) throw new ApiError(401, "Account not available");

    req.user = { id: String(user._id), role: user.role as Role };
    next();
  } catch (error) {
    next(error);
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, "Not allowed"));
    next();
  };
