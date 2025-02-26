import express, { Request, Response } from "express";
import registerController from "../controllers/registerController";
import emailVerificaitonController from "../controllers/emailVerificationController";
import loginWithEmailAndPassword from "../controllers/loginWithEmailPw";
const router = express.Router();

//register with email and password route
router.post("/register/ep", registerController.registerWithEmailAndPassword);

//to be implemented by: /accountverification?email=${temproaryUsername}&token=${token} in frontend
router.put("/verify/ep", emailVerificaitonController);

router.post("/login/ep", loginWithEmailAndPassword);

router.get("/check-session", (req: Request, res: Response) => {
  if (req.session.user) {
    res.status(200).json({ user: req.session.user });
  } else {
    res.status(401).json({ message: "Not logged in" });
    return;
  }
});
export default router;
