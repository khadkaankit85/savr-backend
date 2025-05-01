import { registerSchema } from "../schema/zodSchemas";
import { Response, Request } from "express";
import bcrypt from "bcrypt";
import User from "../schema/userSchema";

const loginWithEmailAndPassword = async (req: Request, res: Response) => {
  const user = registerSchema.safeParse(req.body);
  if (!user.success) {
    const fieldErrors = user.error.errors.reduce(
      (acc, curr) => {
        const field = curr.path[0];
        acc[field] = curr.message;
        return acc;
      },
      {} as Record<string, string>,
    );

    return res.status(401).json({ errors: fieldErrors });
  }

  try {
    const existingUser = await User.findOne({ email: user.data.email });
    if (!existingUser) {
      // For security reasons, we don't specify which field is wrong
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
      id: existingUser._id.toString(),
      username: existingUser.username,
      fullName: existingUser.fullName,
      email: existingUser.email,
      isVerified: existingUser.additionalInfo?.isVerified || false,
      role: existingUser.additionalInfo?.role || "user",
    };

    req.session.user = dataToBeSent;
    res.status(200).json(dataToBeSent);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
export default loginWithEmailAndPassword;
