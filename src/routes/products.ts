import express, { Request, Response } from "express";
import productModel from "../schema/productSchema";
import { log } from "console";
const router = express.Router();

//<domain>/<routername>/autocompletion?query=<productname>&limit=<limit>
router.get("/autocompletion", async (req: Request, res: Response) => {
  const query = req.query.query?.toString().toLowerCase() || "";
  const suggestions = await productModel
    .find({ name: { $regex: query, $options: "i" } })
    .limit(10);
  res.json({ suggestions });
});

router.post("/track-product", async (req: Request, res: Response) => {
  const { url } = req.body;
  log(url);

  if (!url) {
    res
      .status(400)
      .json({ success: false, message: "Product URL is required." });
    return;
  }

  try {
  } catch (error) {}
});

export default router;
