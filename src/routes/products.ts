import express, { Request, Response } from "express";
import { scrape } from "../scrapes/bestbuy";
import products from "../dummydb/products";
const router = express.Router();

//<domain>/<routername>/autocompletion?query=<productname>&limit=<limit>
router.get("/autocompletion", (req: Request, res: Response) => {
  const query = req.query.query?.toString().toLowerCase() || "";
  const limit = Number(req.query.limit) || 10;

  console.log(query);

  /* logic to get the data goes here,
   * possible features, implement caching, implement nextpage feature to let the user get the actual next 'limit' number of products
   */

  const matchingProducts = products.filter((product) => {
    const productName = product.name.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    return productName.includes(normalizedQuery);
  });

  res.json({ suggestions: matchingProducts.slice(0, limit) });
});

export default router;
