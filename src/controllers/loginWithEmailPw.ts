import { registerSchema } from "../schema/zodSchemas";
import { Response, Request } from "express";
import bcrypt from "bcrypt";
import User from "../schema/userSchema";

const loginWithEmailAndPassword = async (req: Request, res: Response) => {
  const user = registerSchema.safeParse(req.body);

  if (!user.success) {
    res.status(401).json({ error: user.error.errors });
    return;
  }

  try {
    const existingUser = await User.findOne({ email: user.data.email });

    if (!existingUser) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(
      user.data.password,
      existingUser.password,
    );

    if (!isPasswordValid) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const dataToBeSent = {
      username: existingUser.username,
      fullName: existingUser.fullName,
      email: existingUser.email,
      isVerified: existingUser.additionalInfo?.isVerified || false,
      role: existingUser.additionalInfo?.role || "user",
    };

    if (!req.session.passport) {
      req.session.passport = {}; // Initialize passport object
    }

    req.session.passport.user = {
      ...dataToBeSent,
      _id: existingUser._id.toString(),
    };
    res.status(200).json(dataToBeSent);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export default loginWithEmailAndPassword;
