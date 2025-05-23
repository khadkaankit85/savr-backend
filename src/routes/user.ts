import express, { Request, Response } from "express";
import registerController from "../controllers/registerController";
import emailVerificaitonController from "../controllers/emailVerificationController";
import loginWithEmailAndPassword from "../controllers/loginWithEmailPw";
import { handleLogout } from "../controllers/logoutController";
import { sessionChecker } from "../controllers/checkSession";
import passport from "passport";
import "../configs/passport";
import { appConfigs } from "../configs/appconfigs";
import { SessionUser } from "../types/others";
import { getSavedProducts } from "../controllers/getSavedProductsController";
import { deleteTrackedProduct } from "../controllers/deleteTrackedProductController";

const router = express.Router();

//register with email and password route
router.post("/register/ep", registerController.registerWithEmailAndPassword);

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

router.get(
  "/authentication/withgoogle/callback",
  passport.authenticate("google", {
    failureRedirect: appConfigs.frontendUrl + "/login",
  }),
  (req: Request, res: Response) => {
    req.session.user = req.user as SessionUser;
    //@ts-ignore
    delete req.session.passport;
    res.redirect(appConfigs.frontendUrl);
  },
);

// For products

router.get("/getSavedProducts", getSavedProducts);

// TODO Add route for scheduled crawl of user saved products to update prices and update price array for charting.

router.delete("/deleteTrackedProduct", deleteTrackedProduct);

//to be implemented by: /accountverification?email=${temproaryUsername}&token=${token} in frontend
router.put("/verify/ep", emailVerificaitonController);

router.post("/login/ep", loginWithEmailAndPassword);

router.post("/logout", handleLogout);

router.get("/check-session", sessionChecker);

export default router;
