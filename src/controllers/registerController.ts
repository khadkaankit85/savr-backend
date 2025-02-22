import { Request, Response } from "express";
import { registerSchema } from "../schema/zodSchemas";
import {
  getAccountVerificationEmailText,
  getUsernameFromEmail,
} from "../utils/utils";
import User from "../schema/userSchema";
import sendEmail from "../utils/sendEmail";
import { appConfigs } from "../configs/appconfigs";

const registerWithEmailAndPassword = async (req: Request, res: Response) => {
  const user = registerSchema.safeParse(req.body);

  //if invalid data, then send 401
  if (user.error) {
    res.status(401).json({ error: user.error.errors });
    return;
  }

  //if valid data
  if (user.success) {
    //then check if the email is already in user
    const temproaryUsername = getUsernameFromEmail(user.data.email);
    const existingUser = await User.findOne({
      $or: [{ username: temproaryUsername }, { email: user.data.email }],
    });

    //if email in use then send this error message
    if (existingUser) {
      res
        .status(400)
        .json({ error: "user with this email or username already exists" });
    } else {
      // else create an user in the database, assign them a session id and send an email to verify their account,
      // and send basic user data to the frontend
      try {
        //on success,
        const token = crypto.randomUUID();
        console.log(token);
        const url = `${appConfigs.frontendUrl}/accountverification?username=${temproaryUsername}&token=${token}`;
        //create the user
        const createdUser = await User.insertOne({
          username: temproaryUsername,
          fullName: temproaryUsername,
          email: user.data.email,
          password: user.data.password,
          additionalInfo: { token: { value: token } },
        });

        //send the email to verify their account
        try {
          const emailSent = sendEmail(
            user.data.email,
            "Savr Account Verification",
            getAccountVerificationEmailText(url),
          );
          console.log("email sent to ", user.data.email, await emailSent);
        } catch (e) {
          //console.log("couldnt send the email");
        }

        //#todo: pass session id here

        //and send 201 with userdata
        res.status(201).json({
          username: createdUser.username,
          fullName: createdUser.fullName,
          email: createdUser.email,
          isVerified: createdUser.additionalInfo?.isVerified || false,
        });
      } catch (e) {
        //if couldn't create in the database, send 500
        console.log(e);
        res.status(500).json({
          error: "couldn't create the user in the database, please try again",
        });
      }
    }
  }
};

const registerController = {
  registerWithEmailAndPassword,
};

export default registerController;
