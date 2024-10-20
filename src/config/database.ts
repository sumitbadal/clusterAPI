import mongoose from "mongoose";
import "dotenv/config";

const MONGODB_URL = process.env.MONGODB_URL;
if (!MONGODB_URL) {
  throw new Error("MONGODB_URL environment variable is not defined");
}
const connectDB = async (): Promise<void> => {
  try {
    // Connect to the MongoDB database
    await mongoose.connect(MONGODB_URL);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    // Exit the process with failure
    process.exit(1);
  }
};

export default connectDB;
