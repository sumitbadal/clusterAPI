import express, { Request, Response } from "express";
import userAuth from "../middlewares/auth";
import Group from "../models/group";

const groupRouter = express.Router();

groupRouter.post("/create", userAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    console.log(user);
    if (!user || !user._id) throw new Error(`Internal server error`);
    const group = new Group({
      name: req.body.name,
      description: req.body.description ? req.body.description : "",
      createdBy: user._id,
      icon: req.body.icon,
    });

    const groupData = await group.save();

    res.send({
      data: groupData,
      status: "Success",
      message: "Group created successfully",
    });
  } catch (error: any) {
    console.log("Error:", error.message);
    res.status(400).send({
      status: "Error",
      message: error.message,
    });
  }
});

export default groupRouter;
