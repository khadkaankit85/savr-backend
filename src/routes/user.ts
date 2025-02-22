import express from "express";
import registerController from "../controllers/registerController";

const router = express.Router();

//register with email and password route
router.post("/register/ep", registerController.registerWithEmailAndPassword);

export default router;
