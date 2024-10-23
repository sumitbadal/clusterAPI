import express, { Request, Response } from "express";
import connectDB from "./config/database";
import User, { IUser } from "./models/user";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes/auth";
import profileRouter from "./routes/profile";
import requestRouter from "./routes/request";
import "dotenv/config";
import groupRouter from "./routes/group";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: ["http://localhost:3000", "https://manish774.github.io"],
    credentials: true,
  })
);

app.use("/auth", authRouter);
app.use("/profile", profileRouter);
app.use("/request", requestRouter);
app.use("/group", groupRouter);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  next();
});
// User update route
app.patch("/userUpdate/:userId", async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const data = req.body;

  try {
    const ALLOWED_UPDATES = ["about", "lastName", "gender", "skills"];

    const isUpdateAllowed = Object.keys(data).every((key) =>
      ALLOWED_UPDATES.includes(key)
    );

    if (!isUpdateAllowed) throw new Error("Updates not allowed");

    const user = await User.findByIdAndUpdate({ _id: userId }, data, {
      new: true, // Return the modified document
      runValidators: true,
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log(user);
    res.send(`User updated successfully: ${user}`);
  } catch (error: any) {
    res.status(400).send(`Update Failed: ${error.message}`);
  }
});

// Test route
app.get("/test", (req: Request, res: Response) => {
  res.send("Hi, this is a test auto deployment... 456");
});

// Connect to the database and start the server
connectDB()
  .then(() => {
    console.log("DB connected successfully");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error: Error) => {
    console.error(error);
  });
