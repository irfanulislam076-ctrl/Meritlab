import jwt, { type SignOptions } from "jsonwebtoken";
import type { Response } from "express";
import { env, isProd } from "../config/env";
import { toMs } from "./duration";

export type AccessPayload = { sub: string; role: string };
export type RefreshPayload = { sub: string; tv: number };

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role } satisfies AccessPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE as SignOptions["expiresIn"],
  });
}

export function signRefreshToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, tv: tokenVersion } satisfies RefreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRE as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}

export const REFRESH_COOKIE = "refresh_token";

// Frontend (Vercel) and backend (Render) are different sites in production,
// so the cookie must be SameSite=None + Secure there.
const cookieBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/api/auth",
};

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieBase, maxAge: toMs(env.JWT_REFRESH_EXPIRE) });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieBase);
}
