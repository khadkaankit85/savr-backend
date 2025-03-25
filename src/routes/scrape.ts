import express, { Request, Response } from "express";
import {
  scrapeBestBuy,
  scrapeGiantTiger,
  scrapeCadTire,
} from "../scrapes/scraper";
import { log } from "console";

const router = express.Router();

router.get("/scrape", async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;

  try {
    const results = await Promise.allSettled([
      scrapeBestBuy(keyword),
      scrapeGiantTiger(keyword),
      scrapeCadTire(keyword),
    ]);

    const bestBuyData =
      results[0].status === "fulfilled"
        ? results[0].value
        : { error: "Failed to fetch BestBuy data", details: results[0].reason };
    const giantTigerData =
      results[1].status === "fulfilled"
        ? results[1].value
        : {
            error: "Failed to fetch GiantTiger data",
            details: results[1].reason,
          };
    const cadTireData =
      results[2].status === "fulfilled"
        ? results[2].value
        : {
            error: "Failed to fetch GiantTiger data",
            details: results[2].reason,
          };

    if (results[0].status === "rejected") {
      //console.error('BestBuy scrape error:', results[0].reason);
    }
    if (results[1].status === "rejected") {
      //console.error('GiantTiger scrape error:', results[1].reason);
    }
    if (results[2].status === "rejected") {
      //console.log('CadTire scrape error: ', results[2].reason);
    }

    res.json({
      bestBuy: bestBuyData,
      giantTiger: giantTigerData,
      cadTire: cadTireData,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Error fetching data" });
  }
});

export default router;
