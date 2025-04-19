import express, { Request, Response } from "express";
const router = express.Router();

router.get("/sendemail", (req: Request, res: Response) => {
  //get all the users and price here and send email using sendEmail function
  res.status(204).json({ message: "emails sent successfully" });
});

export default router;
