import express, { Request, Response } from "express";
import { scrapeBestbuy } from "../scrapes/bestbuy";

const router = express.Router();

router.get("/scrape", async (req: Request, res: Response) => {
    const keyword = req.query.keyword as string;
    try {
        const data = await scrapeBestbuy(keyword);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching data" });
    }
});

export default router;