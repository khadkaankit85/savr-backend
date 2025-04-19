import { Request, Response } from "express";
import { emailVerificationSchema } from "../schema/zodSchemas";
import User from "../schema/userSchema";
import { isExpired } from "../utils/utils";
import { request } from "node:http";

const emailVerificaitonController = async (req: Request, res: Response) => {
  const data = emailVerificationSchema.safeParse(req.body);

  // Return with 400 error if invalid data
  if (data.error) {
    // This is not for normal usage, so monitor it more carefully in the future
    res.status(400).json({ error: "invalid data" });
    return;
  }

  // If data is valid
  try {
    const user = await User.findOne({ email: data.data.email });
    // Return with 404 if the user doesn't exist
    if (!user) {
      res.status(404).json({ error: "user doesn't exist" });
      return;
    }
    if (user.additionalInfo?.isVerified) {
      res.redirect("/");
      return;
    }

    const token = user.additionalInfo?.token?.value;
    const createdAt = user.additionalInfo?.token?.createdAt;

    // If there's no createdAt property
    if (!createdAt) {
      res.status(400).json({ error: "please request for verification email" });
      return;
    }

    // If the token is expired
    if (isExpired(createdAt, 24 * 60 * 60 * 1000)) {
      // console.log(createdAt);
      res.status(401).json({ error: "expired token" });
      return;
    }

    // If the token is not matching
    if (token !== data.data.token) {
      console.log("expected is ", token, " and got ", data);
      res.status(400).json({ error: "invalid token" });
      return;
    }

    // Update the user to mark as verified
    try {
      const updatedUser = await User.findOneAndUpdate(
        { email: user.email },
        { $set: { "additionalInfo.isVerified": true } },
        { new: true },
      );
      if (!updatedUser) return;

      req.session.user = {
        username: updatedUser.username,
        fullName: updatedUser!.fullName,
        id: updatedUser.fullName,
        email: updatedUser.email,
        isVerified: true,
        role: updatedUser.additionalInfo!.role,
      };

      // Return updated user info
      // we always have updatedUser here unless we have an exception so turnery operator might be replaceable by ! i guess:)
      /*
      res.status(201).json({
        username: updatedUser?.username,
        fullName: updatedUser?.fullName,
        email: updatedUser?.email,
        isVerified: updatedUser?.additionalInfo!.isVerified,
      });
      */
      res.redirect("/");
    } catch {
      res.status(500).json({ error: "please try again later" });
    }
  } catch (e) {
    // Catch any errors that might occur during the process
    res.status(500).json({ error: "please try again later" });
  }
};

export default emailVerificaitonController;
