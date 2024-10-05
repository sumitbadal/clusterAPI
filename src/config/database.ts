import mongoose from "mongoose";

// Define the function to return a Promise<void>
const connectDB = async (): Promise<void> => {
  try {
    // Connect to the MongoDB database
    await mongoose.connect(
      "mongodb+srv://sumit:9534149147@cluster0.zucyuib.mongodb.net/testApi"
    );
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    // Exit the process with failure
    process.exit(1);
  }
};

export default connectDB;
