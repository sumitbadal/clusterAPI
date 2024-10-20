import express, { Request, Response } from "express";
import User from "../models/user";
import bcrypt from "bcrypt";

const authRouter = express.Router();
authRouter.post("/signup", async (req: Request, res: Response) => {
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
    res.send({
      status: "Success",
      message: "User created successfully",
    });
  } catch (error: any) {
    console.log("Error:", error.message);
    res.status(400).send({
      status: "Error",
      message: error.message,
    });
  }
});

// Login route
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { emailId, password } = req.body;

    const user = await User.findOne({ emailId });
    if (!user) throw new Error("Invalid Credentials");

    const isValidPassword = await user.validatePassword(password);
    if (isValidPassword) {
      const token = await user.getToken();
      res.cookie("token", token);
      res.send({
        details: user,
        status: "Success",
        statusCode: 200,
        message: "Login Successful",
      });
    } else {
      throw new Error("Invalid Credentials");
    }
  } catch (error: any) {
    res.status(400).send({
      status: "Error",
      message: error.message,
    });
  }
});

export default authRouter;
