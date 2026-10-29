import mongoose from "mongoose";
import { env } from "./env";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI, {
    dbName: env.MONGO_DB_NAME, // the Atlas URI has no database name, so set it here
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    autoIndex: true, // builds unique indexes automatically, so no extra "db:indexes" step
  });
  // Older databases have a unique index on routineDayId alone. Rounds need the same day twice, so drop it.
  await mongoose.connection.collection("exams").dropIndex("routineDayId_1").catch(() => undefined);
  console.log(`MongoDB connected (db: ${env.MONGO_DB_NAME})`);
}
