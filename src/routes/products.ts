import express, { Request, Response } from "express";
import { scrapeBestBuy } from "../scrapes/scraper";
import products from "../dummydb/products";
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

export default router;
