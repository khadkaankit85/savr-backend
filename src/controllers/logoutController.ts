import { Request, Response } from "express";

/**
 * destroys the session and logouts the user
 */
export const handleLogout = (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ message: "Logout failed" });
        return;
      }
      res.clearCookie("connect.sid");
      res.status(200).json({ message: "Logged out successfully" });
      return;
    });
  } else {
    res.status(400).json({ message: "No active session" });
    return;
  }
};
