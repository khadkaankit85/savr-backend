import express, { Request, Response } from "express";
import productModel from "../schema/productSchema";
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
