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
  if (!user.success) {
    const fieldErrors = user.error.errors.reduce((acc, curr) => {
      const field = curr.path[0];
      acc[field] = curr.message;
      return acc;
    }, {} as Record<string, string>);

    res.status(400).json({ errors: fieldErrors });
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

        const dataToBeSent = {
          id: createdUser._id.toString(),
          username: createdUser.username,
          fullName: createdUser.fullName,
          email: createdUser.email,
          //watch out here, isVerified and role cannot be undefined as per my understanding of the code i have written but still i dont want ts to trust me:)
          isVerified: createdUser.additionalInfo?.isVerified || false,
          role: createdUser.additionalInfo?.role || "user",
        };

        //give session to the user
        req.session.user = dataToBeSent;

        //and send 201 with userdata
        res.status(201).json({
          username: createdUser.username,
          fullName: createdUser.fullName,
          email: createdUser.email,
          isVerified: createdUser.additionalInfo?.isVerified || false,
          role: createdUser.additionalInfo?.role,
        });

        //send the email to verify their account
        try {
          const emailSent = sendEmail(
            user.data.email,
            "Savr Account Verification",
            getAccountVerificationEmailText(url)
          );
          console.log("email sent to ", user.data.email, await emailSent);
        } catch (e) {
          //console.log("couldnt send the email");
        }
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
