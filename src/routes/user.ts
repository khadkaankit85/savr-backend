import express from "express";
import registerController from "../controllers/registerController";
import emailVerificaitonController from "../controllers/emailVerificationController";
const router = express.Router();

//register with email and password route
router.post("/register/ep", registerController.registerWithEmailAndPassword);

//to be implemented by: /accountverification?email=${temproaryUsername}&token=${token} in frontend
router.put("/verify/ep", emailVerificaitonController);
export default router;
