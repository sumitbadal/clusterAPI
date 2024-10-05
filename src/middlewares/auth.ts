import { NextFunction, Request, Response } from "express";
import User from "../models/user";
import jwt, { JwtPayload } from "jsonwebtoken";

const userAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.cookies;
    if (!token) throw new Error("Invalid Token");

    const decodeObj = await jwt.verify(token, "DEV@sumit");
    const { _id } = decodeObj as JwtPayload;
    const user = await User.findById(_id);
    if (!user) throw new Error("User not found");
    console.log(`Logged in user: ${user} ${_id}`, req.cookies);
    // req["user"] = user;
    next();
  } catch (error) {
    res.status(400).send(`Error on Authentication:`);
  }
};

export default userAuth;
