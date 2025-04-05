import { ObjectId } from "mongoose";

export interface SessionUser {
  username: string;
  fullName: string;
  id: string;
  email: string;
  isVerified: boolean;
  role: "user" | "admin";
}
