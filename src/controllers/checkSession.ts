import { Request, Response } from "express";
/**
 * @returns User data from the session store if the user has session else 401
 * user data exists in req.session.user, regardless of the method of authentication
 */
export const sessionChecker = (req: Request, res: Response) => {
  // console.log("Session data: ", req.cookies);
  if (req.session.user) {
    res.status(200).json({ user: req.session.user });
  } else {
    res.status(401).json({ message: "Not logged in" });
  }
  return;
};
