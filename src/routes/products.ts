import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("you hit product endpoint");
});

export default router;
