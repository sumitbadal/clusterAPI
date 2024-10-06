import express, { Request, Response } from "express";
import connectDB from "./config/database";
import User, { IUser } from "./models/user";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import userAuth from "./middlewares/auth";
import cors from "cors";

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors());

// Signup route
app.post("/signup", async (req: Request, res: Response) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    console.log(hashedPassword);

    const { emailId, fullName, phone } = req.body;

    const user = new User({
      emailId,
      password: hashedPassword,
      fullName,
      phone,
    });

    await user.save();
    res.send("User created successfully");
  } catch (error: any) {
    console.log("Error:", error.message);
    res.status(400).send(error.message);
  }
});

// Login route
app.post("/login", async (req: Request, res: Response) => {
  try {
    const { emailId, password } = req.body;

    const user = await User.findOne({ emailId });
    if (!user) throw new Error("Invalid Credentials");

    const isValidPassword = await user.validatePassword(password);
    if (isValidPassword) {
      const token = await user.getToken();
      res.cookie("token", token);
      res.send("Login Successful");
    } else {
      throw new Error("Invalid Credentials");
    }
  } catch (error: any) {
    res.status(400).send(`Error: ${error.message}`);
  }
});

// Profile route
app.get("/profile", userAuth, async (req, res) => {
  try {
    // const user = req.user;
    console.log(`Logged in user:`);
    res.send(`Reading Cookies,`);
  } catch (error: any) {
    res.status(400).send(`Error: ${error.message}`);
  }
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
