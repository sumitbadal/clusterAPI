import express, { Request, Response } from "express";

const requestRouter = express.Router();

requestRouter.patch(
  "/invite/:userId/:status",
  async (req: Request, res: Response) => {
    try {
      const { userId, status } = req.params;

      res.status(200).send({
        status: `Success`,
        data: `${userId} ${status}`,
        message: `Invitation sent`,
      });
    } catch (error: any) {
      console.log("Error:", error.message);
      res.status(400).send({
        status: "Error",
        message: error.message,
      });
    }
  }
);

export default requestRouter;
