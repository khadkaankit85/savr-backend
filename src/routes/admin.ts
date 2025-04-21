import express from "express";
import sendAlerts from "../scheduler/sendAlert";
const router = express.Router();

//fulllocation: GET  backendurl/api/admin/sendemail
router.get("/sendemail", sendAlerts);
export default router;
