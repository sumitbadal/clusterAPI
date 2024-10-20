import mongoose, { Document, Model } from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Create an interface for the User document that extends Mongoose's Document interface
export interface IUser extends Document {
  fullName: string;
  emailId: string;
  password: string;
  phone?: number;
  gender?: string;
  about?: string;
  friends?: string[];
  getToken(): Promise<string>;
  validatePassword(passwordInputByUser: string): Promise<boolean>;
}

const friendSchema = new mongoose.Schema({
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User", // Assuming 'User' is the model for users
  },
  status: {
    type: String,
    enum: ["accepted", "pending"],
    required: true,
  },
});

// Define the User schema
const userSchema = new mongoose.Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      minLength: 4,
      maxLength: 50,
    },
    emailId: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      trim: true,
      validate(value: string) {
        if (!validator.isEmail(value))
          throw new Error(`Invalid Email Id: ${value}`);
      },
    },
    password: {
      type: String,
      required: true,
      validate(value: string) {
        if (!validator.isStrongPassword(value))
          throw new Error(`Enter a Strong Password`);
      },
    },
    phone: {
      type: String,
      validate(value: string) {
        if (!validator.isMobilePhone(value, "any"))
          throw new Error(`Enter a valid mobile no`);
      },
    },
    gender: {
      type: String,
      validate(value: string) {
        if (!["male", "female", "others"].includes(value)) {
          throw new Error("Gender data is not valid");
        }
      },
    },
    about: {
      type: String,
      default: "This is default about user",
    },
    friends: [friendSchema],
  },
  {
    timestamps: true,
  }
);

// Define methods on the User schema
userSchema.methods.getToken = async function (): Promise<string> {
  const user = this as IUser;
  const token = await jwt.sign({ _id: user._id }, "DEV@sumit", {
    expiresIn: "1d",
  });
  return token;
};

userSchema.methods.validatePassword = async function (
  passwordInputByUser: string
): Promise<boolean> {
  const user = this as IUser;
  const hashedPassword = user.password;
  const isValidPassword = await bcrypt.compare(
    passwordInputByUser,
    hashedPassword
  );
  return isValidPassword;
};

// Export the User model
const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;
