import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import "@/models";

async function main() {
  await connectDb();
  for (const name of mongoose.modelNames()) {
    const dropped = await mongoose.model(name).syncIndexes();
    console.log(`${name}: indexes in sync${dropped.length ? ` (dropped: ${dropped.join(", ")})` : ""}`);
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
