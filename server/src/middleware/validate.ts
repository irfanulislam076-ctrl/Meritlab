import type { Request } from "express";
import type { ZodTypeAny, z } from "zod";

/** Parses with Zod so only plain strings/numbers ever reach a Mongo query (blocks $-operator injection). */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}
export const body = <T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> => schema.parse(req.body ?? {});
