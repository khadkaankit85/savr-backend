import express, { Request, Response } from "express";
import {
  getRawHTML,
  getRelevantHTMLJSDOM,
  getBestBuyScriptTagOnly,
  fixIncompleteJSON,
} from "../crawls/crawler";
import { log } from "console";
import { string } from "zod";
import bestBuy_products from "../models/bestBuyData";
import User from "../schema/userSchema";
import productSchema from "../schema/productSchema";
import dotenv from "dotenv";

const router = express.Router();

router.get("/BB", async (req: Request, res: Response): Promise<void> => {
  const url = req.query.url as string;

  const apiToken = req.headers["authorization"];
  const userSession = req.session.user?.id;
  // Authorization check
  if (apiToken !== `Bearer ${process.env.SCRAPER_API_TOKEN}`) {
    if (!userSession) {
      res.status(401).json("Unauthorized user");
      return;
    }
  }

  // Validate URL
  if (!url) {
    res.status(400).json({ message: "URL is required" });
    return;
  }

  try {
    // Fetch and process HTML
    const html = await getRawHTML(url);
    const bodyResult = getRelevantHTMLJSDOM(html);
    const scriptResult = getBestBuyScriptTagOnly(bodyResult);
    const fixedJSON: string = scriptResult
      ? fixIncompleteJSON(scriptResult)
      : "";
    const finalData: { [key: string]: any } = JSON.parse(fixedJSON);

    // Add the URL to the finalData object
    finalData.product = finalData.product || {};
    finalData.product.url = url;

    const existingProduct = await bestBuy_products.findOne({
      url: finalData.product.url,
    });
    const user = await User.findById(userSession);

    if (!user) {
      console.error("Error: User not found");
      return;
    }

    if (!existingProduct) {
      console.log(" [crawl.ts:/bb: New product...saving to database");

      // Add new product to the database
      finalData.product.url = url;
      finalData.product.priceDateHistory = [
        {
          Number: finalData.product.priceWithEhf,
          Date: new Date(),
        },
      ];

      const newProduct = await bestBuy_products.create(finalData.product);

      if (newProduct && newProduct._id) {
        user.bestBuyProducts.push({
          product: newProduct._id,
          wantedPrice: 0,
        });
        await user.save();
      } else {
        console.log("[crawl.ts:/bb: Error: Failed to create new product");
        return;
      }
    } else {
      console.log(
        "[crawl.ts:/bb: Existing product, adding to user but not saving to database."
      );

      // Add the existing product to the user's tracked products
      if (
        !user.bestBuyProducts.some(
          (item) => item.product.toString() === existingProduct._id.toString()
        )
      ) {
        user.bestBuyProducts.push({
          product: existingProduct._id,
          wantedPrice: 0,
        });
        await user.save();
      } else {
        console.log(
          "[crawl.ts:/bb: Product already exists in the user's tracked list."
        );
      }

      // Update price history if needed
      const lastPriceEntry =
        existingProduct.priceDateHistory[
          existingProduct.priceDateHistory.length - 1
        ];
      const today = new Date().toISOString().split("T")[0];
      const lastEntryDate = lastPriceEntry?.Date
        ? new Date(lastPriceEntry.Date).toISOString().split("T")[0]
        : null;

      console.log("[crawl.ts:/bb: Check if price update needed...");

      if (
        lastEntryDate !== today ||
        lastPriceEntry?.Number !== finalData.product.priceWithoutEhf
      ) {
        console.log(
          "[crawl.ts:/bb: Existing product: updating price since unequal date"
        );

        await bestBuy_products.updateOne(
          { sku: existingProduct.sku },
          {
            $push: {
              priceDateHistory: {
                Number: finalData.product.priceWithoutEhf,
                Date: new Date(),
              },
            },
            $set: {
              priceWithoutEhf: finalData.product.priceWithoutEhf,
              regularPrice: finalData.product.regularPrice,
              isOnSale: finalData.product.isOnSale,
            },
          }
        );
      } else {
        console.log(
          "[crawl.ts:/bb: No update needed: Price and date are the same."
        );
      }

      res.status(200).json({ product: existingProduct });
      return;
    }
  } catch (error) {
    console.log("[crawl.ts:/bb: Error fetching data:", error);
    res.status(500).json({ message: "Error fetching data" });
  }
});

router.get("/updater", async (req: Request, res: Response): Promise<void> => {
  const url = req.query.url as string;
  console.log(url);

  // Authorization check for the scraper
  const apiToken = req.headers["authorization"];
  if (apiToken !== `Bearer ${process.env.SCRAPER_API_TOKEN}`) {
    res.status(401).json({ message: "Unauthorized scraper" });
    return;
  }

  // Validate URL
  if (!url) {
    res.status(400).json({ message: "URL is required" });
    return;
  }

  try {
    // Fetch and process HTML
    const html = await getRawHTML(url);
    const bodyResult = getRelevantHTMLJSDOM(html);
    const scriptResult = getBestBuyScriptTagOnly(bodyResult);
    const fixedJSON: string = scriptResult
      ? fixIncompleteJSON(scriptResult)
      : "";
    const finalData: { [key: string]: any } = JSON.parse(fixedJSON);

    // Add the URL to the finalData object
    finalData.product = finalData.product || {};
    finalData.product.url = url;

    const existingProduct = await bestBuy_products.findOne({
      url: finalData.product.url,
    });

    console.log(
      `[crawl.ts:/updater: Existing product check: ${existingProduct?.regularPrice} === ${finalData.product.url}`
    );

    if (!existingProduct) {
      console.log("crawl.ts:/updater: No existing product");
      return;
    } else {
      console.log(
        "crawl.ts:/updater: Existing product found. Checking for updates..."
      );
    }

    console.log(`crawl.ts:/updater: Update query: ${url}`);
    console.log(
      `crawl.ts:/updater: Update payload: ${
        finalData.product.priceWithoutEhf
      } at ${new Date()} is on sale == ${finalData.product.isOnSale}`
    );

    await bestBuy_products.updateOne(
      { url: existingProduct.url },
      {
        $push: {
          priceDateHistory: {
            Number: finalData.product.priceWithoutEhf,
            Date: new Date(),
          },
        },
        $set: {
          priceWithoutEhf: finalData.product.priceWithoutEhf,
          regularPrice: finalData.product.regularPrice,
          isOnSale: finalData.product.isOnSale,
        },
      }
    );
    res
      .status(200)
      .json({ message: "crawl.ts:/updater: Product processed successfully" });
  } catch (error) {
    console.log(" crawl.ts:/updater:Error fetching data:", error);
    res.status(500).json({ message: "Error fetching data" });
  }
});

export default router;
