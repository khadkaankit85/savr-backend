import express, { Request, Response } from "express";
import {
  getRawHTML,
  getRelevantHTMLJSDOM,
  getBestBuyScriptTagOnly,
  fixIncompleteJSON,
} from "../crawls/crawler";
import { log } from "console";
import { string } from "zod";
import products from "../models/bestBuyData";
import User from "../schema/userSchema";
import productSchema from "../schema/productSchema";
import dotenv from "dotenv";
import { parse } from "path";
import {
  finalizeWithAi,
  sephoraParseProductDetails,
  universalScrapeJS,
} from "../utils/parsers";

const router = express.Router();

interface productSchema {
  sku: string;
  name: string;
  isOnSale?: string;
  customerRating?: Number;
  customerRatingCount?: Number;
  regularPrice: Number;
  salePrice: Number;
  images: string[];
  brandName?: string;
  longDescription?: string;
  url: string;
  priceDateHistory: { Number: number; Date: Date }[];
}

interface aiProductData {
  sku: string;
  name: string;
  customerRating?: number;
  customerRatingCount?: number;
  regularPrice: number;
  salePrice?: number;
  images: string[];
  brandName?: string;
  longDescription?: string;
  url: string;
  priceDateHistory?: { Number: number; Date: Date }[];
}

// Track product defaults to /BB router so I'll have to redirect it to an API route that runs logic if it's BB or Sephora right now.
router.get(
  "/crawl-chooser",
  async (req: Request, res: Response): Promise<void> => {
    const url = req.query.url as string;

    // https://www.bestbuy.ca/en-ca/product/
    // https://www.sephora.com/ca/en/

    const weblist: string[] = ["www.bestbuy.ca", "www.sephora.com/ca"];

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      const pathname = parsedUrl.pathname;

      // Check for bestbuy
      if (hostname == "www.bestbuy.ca") {
        res.redirect(`/BB?url=${encodeURIComponent(url)}`);
      } else if (hostname == "www.sephora.com" && pathname.startsWith("/ca")) {
        res.redirect(`/sephora?url=${encodeURIComponent(url)}`);
      } else {
        // this is where the general AI parser would be
        res.status(400).send("Unsupported URL.");
      }
    } catch (error) {
      res.status(400).send("Invalid URI format");
    }
  }
);

router.get("/sephora", async (req: Request, res: Response): Promise<void> => {
  const url = req.query.url as string;

  console.log(`[crawl.ts - /sephora] - url: ${url}`);

  const apiToken = req.headers["authorization"];
  const userSession = req.session.user?.id;

  if (apiToken !== `Bearer ${process.env.SCRAPER_API_TOKEN}`) {
    if (!userSession) {
      res.status(401).json("Unauthorized user");
      return;
    }
  }

  if (!url) {
    res.status(400).json({ message: "URL is required" });
    return;
  }

  try {
    // https://www.sephora.com/api/v3/users/profiles/current/product/P393401?preferedSku=1359694&countryCode=CA&loc=en-CA
    // Params:
    // countryCode: CA
    // loc: en-CA
    // preferredSku

    const sampleShapeofAPI = {
      currentSku: {
        targetUrl: "/product/luminous-silk-foundation-P393401?skuId=1359694",
        skuId: "1359694",
        listPrice: "$85.00",
        alternateImages: [
          {
            image250:
              "https://www.sephora.com/productimages/sku/s2789857-av-1-zoom.jpg?imwidth=250",
            altText:
              "Armani Beauty Luminous Silk Natural Glow Foundation in 9 Image 2",
            imageUrl:
              "https://www.sephora.com/productimages/sku/s2789857-av-1-zoom.jpg",
          },
        ],
        skuImages: [
          {
            image250:
              "https://www.sephora.com/productimages/sku/s1359694-main-zoom.jpg?imwidth=250",
            imageUrl:
              "https://www.sephora.com/productimages/sku/s1359694-main-zoom.jpg",
          },
        ],
      },
    };
  } catch (error) {}
});

router.get("/BB", async (req: Request, res: Response): Promise<void> => {
  const url = req.query.url as string;
  let urlType: string = "";
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

  // TODO Crawl chooser must be here ...
  console.log(`[crawl.ts/bb] - url exists, identifying which url...`);
  urlType = (await identifyUrl(url)) || "other";

  console.log(`[crawl.ts URL TYPE = ${urlType}]`);

  // TODO IF bestbuy do this route...

  // Main switch case
  switch (urlType) {
    case "bestbuy": {
      console.log(`[crawl.ts/bb] - bestbuy url detected, running process`);
      try {
        // Fetch and process HTML for bestbuy
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

        let existingProduct = await products.findOne({
          url: finalData.product.url,
        });
        const user = await User.findById(userSession);

        if (!user) {
          console.error("Error: User not found");
          return;
        }

        if (!existingProduct) {
          console.log(" [crawl.ts:/bb: New product...saving to database");

          finalData.product.url = url;
          finalData.product.priceDateHistory = [
            {
              Number: finalData.product.regularPrice,
              Date: new Date(),
            },
          ];

          const finalParsedData = await parseBestBuyDataForMongoDB(
            finalData.product
          );

          const newProduct = await products.create(finalParsedData);

          if (newProduct && newProduct._id) {
            user.products.push({
              product: newProduct._id,
              wantedPrice: 0,
            });
            await user.save();
            existingProduct = newProduct;
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
            !user.products.some(
              (item) =>
                item.product.toString() === existingProduct?._id.toString()
            )
          ) {
            user.products.push({
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
            lastPriceEntry?.Number !== finalData.product.regularPrice
          ) {
            console.log(
              "[crawl.ts:/bb: Existing product: updating price since unequal date"
            );

            await products.updateOne(
              { sku: existingProduct.sku },
              {
                $push: {
                  priceDateHistory: {
                    Number: finalData.product.regularPrice,
                    Date: new Date(),
                  },
                },
                $set: {
                  regularPrice: finalData.product.regularPrice,
                },
              }
            );
          } else {
            console.log(
              "[crawl.ts:/bb: No update needed: Price and date are the same."
            );
          }
        }
        res.status(200).json({ product: existingProduct });
        return;
      } catch (error) {
        console.log("[crawl.ts:/bb: Error fetching data:", error);
        res.status(500).json({ message: "Error fetching data" });
      }
    }
    case "sephora": {
      // save to the shape of the productSchema // [x] Get the specific sku to choose since it will return a bunch of other skus // [x] Do axios get for the url
      let sephoraRawData = await sephoraParseProductDetails(url);
      const finalData: productSchema = {
        sku: sephoraRawData?.currentSku.skuId || "",
        name: sephoraRawData?.heroImageAltText || "",
        regularPrice: sephoraRawData?.currentSku.listPrice
          ? Number(sephoraRawData.currentSku.listPrice)
          : 0,
        salePrice: sephoraRawData?.currentSku.listPrice
          ? Number(sephoraRawData.currentSku.listPrice)
          : 0,
        images: sephoraRawData?.currentSku.skuImages?.imageUrl
          ? [sephoraRawData.currentSku.skuImages.imageUrl]
          : [],
        url: url,
        priceDateHistory: [
          {
            Number: sephoraRawData?.currentSku.listPrice || 0,
            Date: new Date(),
          },
        ],
      };

      let existingProduct = await products.findOne({
        url: finalData.url,
      });
      const user = await User.findById(userSession);

      if (!user) {
        console.error("Error: User not found");
        return;
      }

      if (!existingProduct) {
        const newProduct = await products.create(finalData);

        if (newProduct && newProduct._id) {
          user.products.push({
            product: newProduct._id,
            wantedPrice: 0,
          });
          await user.save();
          existingProduct = newProduct;
        }
      } else {
        console.log(
          "[crawl.ts:/bb: Existing product, adding to user but not saving to database."
        );
        // Add the existing product to the user's tracked products
        if (
          !user.products.some(
            (item) =>
              item.product.toString() === existingProduct?._id.toString()
          )
        ) {
          user.products.push({
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
          lastPriceEntry?.Number !== finalData.regularPrice
        ) {
          console.log(
            "[crawl.ts:/bb: Existing product: updating price since unequal date"
          );

          await products.updateOne(
            { sku: existingProduct.sku },
            {
              $push: {
                priceDateHistory: {
                  Number: finalData.regularPrice,
                  Date: new Date(),
                },
              },
              $set: {
                regularPrice: finalData.regularPrice,
              },
            }
          );
        } else {
          console.log(
            "[crawl.ts:/bb: No update needed: Price and date are the same."
          );
        }
      }
    }
    case "other": {
      let rawData = await universalScrapeJS(url);

      if (!rawData) {
        console.log("[crawl.ts] - No raw data returned from universalScrapeJS");
        return; // Exit the case if rawData is null or undefined
      }

      let aiDataResponse = await finalizeWithAi(rawData);

      if (!aiDataResponse?.content) {
        console.log("[crawl.ts] - finalizeWithAi returned null");
        return; // Exit the case if AI response is null
      }

      // Safely access aiDataResponse.content
      let finalData: aiProductData;

      try {
        const parsedData = JSON.parse(aiDataResponse.content);

        finalData = parsedData as aiProductData;
      } catch (error) {
        console.log(`[crawl-ts] - Failed ot parse AI response`);
        return;
      }

      console.log(`Parsed AI Data: ${JSON.stringify(finalData)}`);

      // OK now we do the same thing as before. create product, save it, if exists, update it.

      let existingProduct = await products.findOne({
        url: finalData.url,
      });
      const user = await User.findById(userSession);

      if (!user) {
        console.error("Error: User not found");
        return;
      }

      if (!existingProduct) {
        console.log(" [crawl.ts:/bb: New product...saving to database");

        finalData.salePrice = finalData.regularPrice;
        finalData.url = url;
        finalData.priceDateHistory = [
          {
            Number: finalData.regularPrice,
            Date: new Date(),
          },
        ];

        const newProduct = await products.create(finalData);

        if (newProduct && newProduct._id) {
          user.products.push({
            product: newProduct._id,
            wantedPrice: 0,
          });
          await user.save();
          existingProduct = newProduct;
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
          !user.products.some(
            (item) =>
              item.product.toString() === existingProduct?._id.toString()
          )
        ) {
          user.products.push({
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
          lastPriceEntry?.Number !== finalData.regularPrice
        ) {
          console.log(
            "[crawl.ts:/bb: Existing product: updating price since unequal date"
          );

          await products.updateOne(
            { sku: existingProduct.sku },
            {
              $push: {
                priceDateHistory: {
                  Number: finalData.regularPrice,
                  Date: new Date(),
                },
              },
              $set: {
                regularPrice: finalData.regularPrice,
              },
            }
          );
        } else {
          console.log(
            "[crawl.ts:/bb: No update needed: Price and date are the same."
          );
        }
      }
    }
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

    const existingProduct = await products.findOne({
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

    await products.updateOne(
      { url: existingProduct.url },
      {
        $push: {
          priceDateHistory: {
            Number: finalData.product.regularPrice,
            Date: new Date(),
          },
        },
        $set: {
          regularPrice: finalData.product.regularPrice,
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

async function identifyUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const pathname = parsedUrl.pathname;

    // Check for bestbuy
    if (hostname == "www.bestbuy.ca") {
      return "bestbuy";
    } else if (hostname == "www.sephora.com" && pathname.startsWith("/ca")) {
      return "sephora";
    } else {
      // this is where the general AI parser would be
      return "other";
    }
  } catch (error) {
    console.log(`[crawl.ts/identifyUrl()] - error identifying url`);
  }
}

async function parseBestBuyDataForMongoDB(scrapedData: { [key: string]: any }) {
  const finalData = {
    sku: scrapedData.sku,
    name: scrapedData.name,
    customerRating: scrapedData.customerRating,
    customerRatingCount: scrapedData.customerRatingCount,
    regularPrice: scrapedData.regularPrice,
    salePrice: scrapedData.priceWithoutEhf,
    images: scrapedData.additionalImages,
    brandName: scrapedData.brandName,
    longDescription: scrapedData.longDescription,
    url: scrapedData.url,
    priceDateHistory: scrapedData.priceDateHistory,
  };

  return finalData;
}

async function parseAIDataForMongoDB(scrapedData: { [key: string]: any }) {
  const finalData = {
    sku: scrapedData.sku,
    name: scrapedData.name,
    customerRating: scrapedData.customerRating,
    customerRatingCount: scrapedData.customerRatingCount,
    regularPrice: scrapedData.regularPrice,
    salePrice: scrapedData.salePrice,
    images: scrapedData.images,
    brandName: scrapedData.brandName,
    longDescription: scrapedData.longDescription,
    url: scrapedData.url,
    priceDateHistory: scrapedData.priceDateHistory,
  };

  return finalData;
}

export default router;
