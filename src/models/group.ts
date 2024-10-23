import mongoose, { Model, Document } from "mongoose";

interface IGroup extends Document {
  name: string;
  description?: string;
  createdBy: string;
}

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "", // Optional description
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Assuming you have a User model
      required: true,
    },
    icon: {
      type: String,
    },
    //   members: [
    //     {
    //       userId: {
    //         type: mongoose.Schema.Types.ObjectId,
    //         ref: "User", // Reference to User model
    //         required: true,
    //       },
    //       role: {
    //         type: String,
    //         enum: ["admin", "member"], // Only 'admin' or 'member' allowed
    //         required: true,
    //       },
    //     },
    //   ],
    //   expenses: [
    //     {
    //       type: mongoose.Schema.Types.ObjectId,
    //       ref: "Expense", // Reference to Expense model
    //     },
    //   ],
  },
  { timestamps: true }
);

const Group: Model<IGroup> = mongoose.model<IGroup>("Group", groupSchema);
export default Group;
