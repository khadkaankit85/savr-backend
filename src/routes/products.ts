import express, { Request, Response } from "express";
import productModel from "../schema/productSchema";
import { log } from "console";
import bestBuy_products from "../models/bestBuyData";
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

router.get("/history", async (req: Request, res: Response) => {
  console.log(req.query);
  const productId = req.query.productId;
  if (!productId) {
    res.status(404).json({ message: "not found" });
    return;
  }
  try {
    const product = await bestBuy_products.findOne({
      _id: productId,
    });
    res.json({ product });
  } catch {
    res
      .status(500)
      .json({
        message:
          "internal server error while querying the database for asked product",
      });
  }
});

export default router;
