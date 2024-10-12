import express, { Request, Response } from "express";
import connectDB from "./config/database";
import User, { IUser } from "./models/user";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes/auth";
import profileRouter from "./routes/profile";

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use("/auth", authRouter);
app.use("/profile", profileRouter);

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
  res.send("Hi, this is a test");
});

// Connect to the database and start the server
connectDB()
  .then(() => {
    console.log("DB connected successfully");
    app.listen(3000, () => {
      console.log(`Server running on port 3000`);
    });
  })
  .catch((error: Error) => {
    console.error(error);
  });
