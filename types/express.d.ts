import { Request } from "express";
// extension to the 'Request' interface from express
declare global {
  namespace Express {
    interface Request {
      user?: {
        role: "user" | "admin";
      };
    }
  }
}
