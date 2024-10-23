import express, { Request, Response } from "express";
import userAuth from "../middlewares/auth";

const profileRouter = express.Router();

// Profile route
profileRouter.get("/view", userAuth, async (req, res) => {
  try {
    const user = req.user;
    console.log(`Logged in user: ${user}`);
    res.send(`Reading Cookies,`);
  } catch (error: any) {
    res.status(400).send(`Error: ${error.message}`);
  }
});

export default profileRouter;
