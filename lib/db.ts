import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

// Kept on globalThis so hot reloads and warm serverless invocations reuse one connection pool.
const globalCache = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = (globalCache.__mongoose ??= { conn: null, promise: null });

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  cache.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
    // Build indexes automatically in development only. In production run `npm run db:indexes`.
    autoIndex: process.env.NODE_ENV !== "production",
  });

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null; // let the next request retry
    throw error;
  }
  return cache.conn;
}
