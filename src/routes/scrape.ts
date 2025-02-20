import express, { Request, Response } from "express";
import { scrapeBestBuy, scrapeGiantTiger } from "../scrapes/scraper";
import { log } from "console";


const router = express.Router();

router.get("/scrape", async (req: Request, res: Response) => {
    const keyword = req.query.keyword as string;
    console.log(`Scrape request for ${keyword}`);

    try {
        const results = await Promise.allSettled([
            scrapeBestBuy(keyword),
            scrapeGiantTiger(keyword)
        ]);

        const bestBuyData = results[0].status === 'fulfilled' ? results[0].value : { error: 'Failed to fetch BestBuy data', details: results[0].reason };
        const giantTigerData = results[1].status === 'fulfilled' ? results[1].value : { error: 'Failed to fetch GiantTiger data', details: results[1].reason };

        if (results[0].status === 'rejected') {
            console.error('BestBuy scrape error:', results[0].reason);
        }
        if (results[1].status === 'rejected') {
            console.error('GiantTiger scrape error:', results[1].reason);
        }

        res.json({ bestBuy: bestBuyData, giantTiger: giantTigerData });
    } catch (error) {
        res.status(500).json({ message: "Error fetching data" });
    }
});

export default router;