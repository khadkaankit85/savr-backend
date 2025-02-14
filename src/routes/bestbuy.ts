import express, { Request, Response } from "express";
import { scrape } from "../scrapes/bestbuy";

const router = express.Router();

router.get("/scrape", async (_req: Request, res: Response) => {
    try {
        const data = await scrape();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching data" });
    }
});

export default router;