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
  },
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

  console.log(`apiToken = ${apiToken}`);

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

        if (!user && !apiToken) {
          console.error("Error: User or ApiToken not found");
          return;
        }

        if (!existingProduct && user) {
          console.log(" [crawl.ts:/bb: New product...saving to database");

          finalData.product.url = url;
          finalData.product.priceDateHistory = [
            {
              Number: finalData.product.regularPrice,
              Date: new Date(),
            },
          ];

          const finalParsedData = await parseBestBuyDataForMongoDB(
            finalData.product,
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
          if (user) {
            console.log(
              "[crawl.ts:/bb: Existing product, adding to user but not saving to database.",
            );
            // Add the existing product to the user's tracked products
            if (
              !user.products.some(
                (item) =>
                  item.product.toString() === existingProduct!._id.toString(),
              )
            ) {
              user.products.push({
                product: existingProduct!._id,
                wantedPrice: 0,
              });
              await user.save();
            } else {
              console.log(
                "[crawl.ts:/bb: Product already exists in the user's tracked list.",
              );
            }
          } else {
            // Update price history if needed
            const lastPriceEntry =
              existingProduct!.priceDateHistory[
                existingProduct!.priceDateHistory.length - 1
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
                "[crawl.ts:/bb: Existing product: updating price since unequal date",
              );

              await products.updateOne(
                { sku: existingProduct!.sku },
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
                },
              );
            } else {
              console.log(
                "[crawl.ts:/bb: No update needed: Price and date are the same.",
              );
            }
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

      if (!user && !apiToken) {
        res
          .status(500)
          .json({ message: `User not found, not apiToken found.` });
        return;
      }

      if (!existingProduct && user) {
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
        if (user) {
          console.log(
            "[crawl.ts:/bb: Existing product, adding to user but not saving to database.",
          );
          // Add the existing product to the user's tracked products
          if (
            !user.products.some(
              (item) =>
                item.product.toString() === existingProduct?._id.toString(),
            )
          ) {
            user.products.push({
              product: existingProduct!._id,
              wantedPrice: 0,
            });
            await user.save();
          } else {
            console.log(
              "[crawl.ts:/bb: Product already exists in the user's tracked list.",
            );
          }
        } else {
          // Update price history if needed
          const lastPriceEntry =
            existingProduct!.priceDateHistory[
              existingProduct!.priceDateHistory.length - 1
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
              "[crawl.ts:/bb: Existing product: updating price since unequal date",
            );

            await products.updateOne(
              { sku: existingProduct!.sku },
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
              },
            );
          } else {
            console.log(
              "[crawl.ts:/bb: No update needed: Price and date are the same.",
            );
          }
        }
      }
      res.status(200).json({ product: existingProduct });
      return;
    }
    case "other": {
      let rawData;
      try {
        rawData = await universalScrapeJS(url);
      } catch (scrapeError: any) {
        console.error(
          `[crawl.ts] - Error during universalScrapeJS for ${url}:`,
          scrapeError.message,
        );
        // Send an error response back to the caller (productUpdate.ts)
        res.status(500).json({
          message: `Scraping failed for ${url}`,
          error: scrapeError.message,
        });
        return; // Stop processing this case
      }

      if (!rawData) {
        console.log("[crawl.ts] - No raw data returned from universalScrapeJS");
        res.status(501).json({ message: `Unsupported link ${url}` }); // Use 404 or 500 as appropriate

        return; // Exit the case if rawData is null or undefined
      }

      let aiDataResponse;
      try {
        aiDataResponse = await finalizeWithAi(rawData);
      } catch (aiError: any) {
        console.error(
          `[crawl.ts] - Error during finalizeWithAi for ${url}:`,
          aiError.message,
        );
        res.status(500).json({
          message: `AI processing failed for ${url}`,
          error: aiError.message,
        });
        return;
      }

      if (!aiDataResponse?.content) {
        console.log("[crawl.ts] - finalizeWithAi returned null");
        res
          .status(500)
          .json({ message: `AI processing returned no content for ${url}` });

        return; // Exit the case if AI response is null
      }

      // Safely access aiDataResponse.content
      let finalData: aiProductData;

      try {
        const parsedData = JSON.parse(aiDataResponse.content);
        finalData = parsedData as aiProductData;
      } catch (error: any) {
        console.log(
          `[crawl-ts] - Failed to parse AI response for ${url}: ${error.message}`,
        );
        // Send an error response back
        res.status(500).json({
          message: `Failed to parse AI response for ${url}`,
          error: error.message,
        });
        return;
      }

      console.log(`Parsed AI Data: ${JSON.stringify(finalData)}`);

      // OK now we do the same thing as before. create product, save it, if exists, update it.

      // const normalizedUrl = normalizeUrl(finalData.url);

      let existingProduct = await products.findOne({
        url: url,
      });
      const user = await User.findById(userSession);

      if (!user && !apiToken) {
        console.error("Error: User not found");
        return;
      }

      if (!existingProduct && user) {
        console.log(" [crawl.ts:/bb: New product...saving to database");

        // const normalizedSaveURl = normalizeUrl(finalData.url);

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
        if (user) {
          console.log(
            "[crawl.ts:/bb: Existing product, adding to user but not saving to database.",
          );
          // Add the existing product to the user's tracked products
          if (
            !user.products.some(
              (item) =>
                item.product.toString() === existingProduct?._id.toString(),
            )
          ) {
            user.products.push({
              product: existingProduct!._id,
              wantedPrice: 0,
            });
            await user.save();
          } else {
            console.log(
              "[crawl.ts:/bb: Product already exists in the user's tracked list.",
            );
          }
        } else {
          // Update price history if needed
          const lastPriceEntry =
            existingProduct!.priceDateHistory[
              existingProduct!.priceDateHistory.length - 1
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
              "[crawl.ts:/bb: Existing product: updating price since unequal date",
            );

            await products.updateOne(
              { sku: existingProduct!.sku },
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
              },
            );
          } else {
            console.log(
              "[crawl.ts:/bb: No update needed: Price and date are the same.",
            );
          }
        }
      }
      console.log(`[crawl.ts] - Successfully processed 'other' URL: ${url}`);
      res.status(200).json({ product: existingProduct });
      return;
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

  // [ ] Change this to a switch case for BB, sephora, etc.

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
      `[crawl.ts:/updater: Existing product check: ${existingProduct?.regularPrice} === ${finalData.product.url}`,
    );

    if (!existingProduct) {
      console.log("crawl.ts:/updater: No existing product");
      return;
    } else {
      console.log(
        "crawl.ts:/updater: Existing product found. Checking for updates...",
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
      },
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

// ... existing code ...

function normalizeUrl(urlString: string): string {
  try {
    const urlObj = new URL(urlString);

    // 1. Remove the specific Canadian Tire pattern (.digits.html)
    // This regex looks for '.html' preceded by a dot and one or more digits, at the end of the pathname
    const ctPattern = /\. \d + \.html$/;
    if (
      urlObj.hostname.includes("canadiantire.ca") &&
      ctPattern.test(urlObj.pathname)
    ) {
      // Replace '.<digits>.html' with just '.html'
      urlObj.pathname = urlObj.pathname.replace(ctPattern, ".html");
    }

    // 2. Remove trailing slash from pathname if it exists and pathname is not just '/'
    if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith("/")) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    return urlObj.toString();
  } catch (e) {
    // Handle invalid URLs if necessary, or just return original
    console.warn(`Could not normalize URL: ${urlString}`, e);

    // Basic fallback: Apply regex and trailing slash removal manually
    let normalizedString = urlString;
    const ctPattern = /\. \d + \.html$/;
    if (
      normalizedString.includes("canadiantire.ca") &&
      ctPattern.test(normalizedString)
    ) {
      normalizedString = normalizedString.replace(ctPattern, ".html");
    }
    normalizedString = normalizedString.endsWith("/")
      ? normalizedString.slice(0, -1)
      : normalizedString;
    return normalizedString;
  }
}

router.get("/BC", async (req: Request, res: Response): Promise<void> => {
  const url = req.query.url as string;
  let urlType: string = "";
  const apiToken = req.headers["authorization"];
  const userSession = req.session.user?.id;
  const useSSE = req.query.sse === "true";

  console.log(`apiToken = ${apiToken}`);
  console.log(`[crawl.ts/bb] - SSE mode: ${useSSE}`);

  // Set up SSE if requested
  if (useSSE) {
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Helper function to send SSE updates
    const sendUpdate = (message: string, data?: any) => {
      res.write(`event: update\n`);
      res.write(`data: ${JSON.stringify({ message, data })}\n\n`);
      // Flush to ensure data is sent immediately
      // Removed res.flush as it is not a standard method on the Response object
    };

    // Initial connection confirmation
    sendUpdate("Connected to server");
  }

  // Authorization check
  if (apiToken !== `Bearer ${process.env.SCRAPER_API_TOKEN}`) {
    if (!userSession) {
      if (useSSE) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({ message: "Unauthorized user" })}\n\n`,
        );
        res.end();
      } else {
        res.status(401).json("Unauthorized user");
      }
      return;
    }
  }

  // Validate URL
  if (!url) {
    if (useSSE) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: "URL is required" })}\n\n`);
      res.end();
    } else {
      res.status(400).json({ message: "URL is required" });
    }
    return;
  }

  // Identify URL type
  if (useSSE) {
    res.write(`event: update\n`);
    res.write(
      `data: ${JSON.stringify({ message: "Identifying URL type..." })}\n\n`,
    );
  }

  console.log(`[crawl.ts/bb] - url exists, identifying which url...`);
  urlType = (await identifyUrl(url)) || "other";

  console.log(`[crawl.ts URL TYPE = ${urlType}]`);

  if (useSSE) {
    res.write(`event: update\n`);
    res.write(
      `data: ${JSON.stringify({ message: `URL identified as ${urlType}` })}\n\n`,
    );
  }

  // Main switch case
  switch (urlType) {
    case "bestbuy": {
      console.log(`[crawl.ts/bb] - bestbuy url detected, running process`);

      if (useSSE) {
        res.write(`event: update\n`);
        res.write(
          `data: ${JSON.stringify({ message: "Fetching BestBuy product data..." })}\n\n`,
        );
      }

      try {
        // Fetch and process HTML for bestbuy
        const html = await getRawHTML(url);

        if (useSSE) {
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({ message: "Processing HTML content..." })}\n\n`,
          );
        }

        const bodyResult = getRelevantHTMLJSDOM(html);
        const scriptResult = getBestBuyScriptTagOnly(bodyResult);
        const fixedJSON: string = scriptResult
          ? fixIncompleteJSON(scriptResult)
          : "";
        const finalData: { [key: string]: any } = JSON.parse(fixedJSON);

        // Add the URL to the finalData object
        finalData.product = finalData.product || {};
        finalData.product.url = url;

        if (useSSE) {
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({
              message: "Product data extracted",
              productName: finalData.product.name || "Product",
            })}\n\n`,
          );
        }

        let existingProduct = await products.findOne({
          url: finalData.product.url,
        });
        const user = await User.findById(userSession);

        if (!user && !apiToken) {
          console.error("Error: User or ApiToken not found");
          if (useSSE) {
            res.write(`event: error\n`);
            res.write(
              `data: ${JSON.stringify({ message: "User or API token not found" })}\n\n`,
            );
            res.end();
          }
          return;
        }

        if (!existingProduct && user) {
          if (useSSE) {
            res.write(`event: update\n`);
            res.write(
              `data: ${JSON.stringify({ message: "New product found. Saving to database..." })}\n\n`,
            );
          }

          console.log(" [crawl.ts:/bb: New product...saving to database");

          finalData.product.url = url;
          finalData.product.priceDateHistory = [
            {
              Number: finalData.product.regularPrice,
              Date: new Date(),
            },
          ];

          const finalParsedData = await parseBestBuyDataForMongoDB(
            finalData.product,
          );

          const newProduct = await products.create(finalParsedData);

          if (newProduct && newProduct._id) {
            user.products.push({
              product: newProduct._id,
              wantedPrice: 0,
            });
            await user.save();
            existingProduct = newProduct;

            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({
                  message: "Product saved and added to your tracking list",
                  product: {
                    name: newProduct.name,
                    price: newProduct.regularPrice,
                    image: (newProduct.images && newProduct.images[0]) || null,
                  },
                })}\n\n`,
              );
            }
          } else {
            console.log("[crawl.ts:/bb: Error: Failed to create new product");
            if (useSSE) {
              res.write(`event: error\n`);
              res.write(
                `data: ${JSON.stringify({ message: "Failed to create new product" })}\n\n`,
              );
              res.end();
            }
            return;
          }
        } else {
          if (user) {
            console.log(
              "[crawl.ts:/bb: Existing product, adding to user but not saving to database.",
            );

            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({ message: "Product already exists in database. Adding to your list..." })}\n\n`,
              );
            }

            // Add the existing product to the user's tracked products
            if (
              !user.products.some(
                (item) =>
                  item.product.toString() === existingProduct!._id.toString(),
              )
            ) {
              user.products.push({
                product: existingProduct!._id,
                wantedPrice: 0,
              });
              await user.save();

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({
                    message: "Product added to your tracking list",
                    product: {
                      name: existingProduct!.name,
                      price: existingProduct!.regularPrice,
                      image:
                        (existingProduct!.images &&
                          existingProduct!.images[0]) ||
                        null,
                    },
                  })}\n\n`,
                );
              }
            } else {
              console.log(
                "[crawl.ts:/bb: Product already exists in the user's tracked list.",
              );

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({
                    message: "Product is already in your tracking list",
                    product: {
                      name: existingProduct!.name,
                      price: existingProduct!.regularPrice,
                      image:
                        (existingProduct!.images &&
                          existingProduct!.images[0]) ||
                        null,
                    },
                  })}\n\n`,
                );
              }
            }
          } else {
            // Update price history if needed
            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({ message: "Checking for price updates..." })}\n\n`,
              );
            }

            const lastPriceEntry =
              existingProduct!.priceDateHistory[
                existingProduct!.priceDateHistory.length - 1
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
                "[crawl.ts:/bb: Existing product: updating price since unequal date",
              );

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({
                    message: "Updating product price information",
                    oldPrice: lastPriceEntry?.Number,
                    newPrice: finalData.product.regularPrice,
                  })}\n\n`,
                );
              }

              await products.updateOne(
                { sku: existingProduct!.sku },
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
                },
              );

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({ message: "Price update complete" })}\n\n`,
                );
              }
            } else {
              console.log(
                "[crawl.ts:/bb: No update needed: Price and date are the same.",
              );

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({ message: "Product price is up to date" })}\n\n`,
                );
              }
            }
          }
        }

        if (useSSE) {
          res.write(`event: complete\n`);
          res.write(
            `data: ${JSON.stringify({
              message: "Process complete",
              product: {
                id: existingProduct!._id,
                name: existingProduct!.name,
                price: existingProduct!.regularPrice,
                image:
                  (existingProduct!.images && existingProduct!.images[0]) ||
                  null,
              },
            })}\n\n`,
          );
          res.end();
        } else {
          res.status(200).json({ product: existingProduct });
        }
        return;
      } catch (error) {
        console.log("[crawl.ts:/bb: Error fetching data:", error);
        if (useSSE) {
          res.write(`event: error\n`);
          res.write(
            `data: ${JSON.stringify({ message: "Error fetching data", error: error instanceof Error ? error.message : String(error) })}\n\n`,
          );
          res.end();
        } else {
          res.status(500).json({ message: "Error fetching data" });
        }
      }
      // Ensure break statements are correctly placed within the switch cases
      break;
    }

    case "sephora": {
      if (useSSE) {
        res.write(`event: update\n`);
        res.write(
          `data: ${JSON.stringify({ message: "Fetching Sephora product data..." })}\n\n`,
        );
      }

      try {
        let sephoraRawData = await sephoraParseProductDetails(url);

        if (useSSE) {
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({ message: "Processing product data..." })}\n\n`,
          );
        }

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

        if (useSSE) {
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({
              message: "Product data extracted",
              productName: finalData.name,
            })}\n\n`,
          );
        }

        let existingProduct = await products.findOne({
          url: finalData.url,
        });
        const user = await User.findById(userSession);

        if (!user && !apiToken) {
          if (useSSE) {
            res.write(`event: error\n`);
            res.write(
              `data: ${JSON.stringify({ message: "User not found and no API token" })}\n\n`,
            );
            res.end();
          } else {
            res
              .status(500)
              .json({ message: `User not found, not apiToken found.` });
          }
          return;
        }

        if (!existingProduct && user) {
          if (useSSE) {
            res.write(`event: update\n`);
            res.write(
              `data: ${JSON.stringify({ message: "New product found. Saving to database..." })}\n\n`,
            );
          }

          const newProduct = await products.create(finalData);

          if (newProduct && newProduct._id) {
            user.products.push({
              product: newProduct._id,
              wantedPrice: 0,
            });
            await user.save();
            existingProduct = newProduct;

            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({
                  message: "Product saved and added to your tracking list",
                  product: {
                    name: newProduct.name,
                    price: newProduct.regularPrice,
                    image: (newProduct.images && newProduct.images[0]) || null,
                  },
                })}\n\n`,
              );
            }
          } else {
            if (useSSE) {
              res.write(`event: error\n`);
              res.write(
                `data: ${JSON.stringify({ message: "Failed to create new product" })}\n\n`,
              );
              res.end();
            }
            return;
          }
        } else {
          if (user) {
            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({ message: "Product already exists in database. Adding to your list..." })}\n\n`,
              );
            }

            console.log(
              "[crawl.ts:/bb: Existing product, adding to user but not saving to database.",
            );

            // Add the existing product to the user's tracked products
            if (
              !user.products.some(
                (item) =>
                  item.product.toString() === existingProduct!._id.toString(),
              )
            ) {
              user.products.push({
                product: existingProduct!._id,
                wantedPrice: 0,
              });
              await user.save();

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({
                    message: "Product added to your tracking list",
                    product: {
                      name: existingProduct!.name,
                      price: existingProduct!.regularPrice,
                      image:
                        (existingProduct!.images &&
                          existingProduct!.images[0]) ||
                        null,
                    },
                  })}\n\n`,
                );
              }
            } else {
              console.log(
                "[crawl.ts:/bb: Product already exists in the user's tracked list.",
              );

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({
                    message: "Product is already in your tracking list",
                    product: {
                      name: existingProduct!.name,
                      price: existingProduct!.regularPrice,
                      image:
                        (existingProduct!.images &&
                          existingProduct!.images[0]) ||
                        null,
                    },
                  })}\n\n`,
                );
              }
            }
          } else {
            // Update price history if needed
            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({ message: "Checking for price updates..." })}\n\n`,
              );
            }

            const lastPriceEntry =
              existingProduct!.priceDateHistory[
                existingProduct!.priceDateHistory.length - 1
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
                "[crawl.ts:/bb: Existing product: updating price since unequal date",
              );

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({
                    message: "Updating product price information",
                    oldPrice: lastPriceEntry?.Number,
                    newPrice: finalData.regularPrice,
                  })}\n\n`,
                );
              }

              await products.updateOne(
                { sku: existingProduct!.sku },
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
                },
              );

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({ message: "Price update complete" })}\n\n`,
                );
              }
            } else {
              console.log(
                "[crawl.ts:/bb: No update needed: Price and date are the same.",
              );

              if (useSSE) {
                res.write(`event: update\n`);
                res.write(
                  `data: ${JSON.stringify({ message: "Product price is up to date" })}\n\n`,
                );
              }
            }
          }
        }

        if (useSSE) {
          res.write(`event: complete\n`);
          res.write(
            `data: ${JSON.stringify({
              message: "Process complete",
              product: {
                id: existingProduct!._id,
                name: existingProduct!.name,
                price: existingProduct!.regularPrice,
                image:
                  (existingProduct!.images && existingProduct!.images[0]) ||
                  null,
              },
            })}\n\n`,
          );
          res.end();
        } else {
          res.status(200).json({ product: existingProduct });
        }
        return;
      } catch (error: any) {
        console.error("[crawl.ts:/sephora: Error fetching data:", error);
        if (useSSE) {
          res.write(`event: error\n`);
          res.write(
            `data: ${JSON.stringify({ message: error.message || "Error fetching Sephora data" })}\n\n`,
          );
          res.end();
        } else {
          res
            .status(500)
            .json({ message: error.message || "Error fetching Sephora data" });
        }
        return;
      }
      break;
    }

    case "other": {
      if (useSSE) {
        res.write(`event: update\n`);
        res.write(
          `data: ${JSON.stringify({ message: "Processing generic website..." })}\n\n`,
        );
      }

      let rawData;
      try {
        if (useSSE) {
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({ message: "Scraping website content..." })}\n\n`,
          );
        }

        rawData = await universalScrapeJS(url);
      } catch (scrapeError: any) {
        console.error(
          `[crawl.ts] - Error during universalScrapeJS for ${url}:`,
          scrapeError.message,
        );

        if (useSSE) {
          res.write(`event: error\n`);
          res.write(
            `data: ${JSON.stringify({
              message: `Scraping failed for ${url}`,
              error: scrapeError.message,
            })}\n\n`,
          );
          res.end();
        } else {
          res.status(500).json({
            message: `Scraping failed for ${url}`,
            error: scrapeError.message,
          });
        }
        return;
      }

      if (!rawData) {
        console.log("[crawl.ts] - No raw data returned from universalScrapeJS");

        if (useSSE) {
          res.write(`event: error\n`);
          res.write(
            `data: ${JSON.stringify({ message: `No data could be scraped for ${url}` })}\n\n`,
          );
          res.end();
        } else {
          res
            .status(404)
            .json({ message: `No data could be scraped for ${url}` });
        }
        return;
      }

      let aiDataResponse;
      try {
        if (useSSE) {
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({ message: "Analyzing product information with AI..." })}\n\n`,
          );
        }

        aiDataResponse = await finalizeWithAi(rawData);
      } catch (aiError: any) {
        console.error(
          `[crawl.ts] - Error during finalizeWithAi for ${url}:`,
          aiError.message,
        );

        if (useSSE) {
          res.write(`event: error\n`);
          res.write(
            `data: ${JSON.stringify({
              message: `AI processing failed for ${url}`,
              error: aiError.message,
            })}\n\n`,
          );
          res.end();
        } else {
          res.status(500).json({
            message: `AI processing failed for ${url}`,
            error: aiError.message,
          });
        }
        return;
      }

      if (!aiDataResponse?.content) {
        console.log("[crawl.ts] - finalizeWithAi returned null");

        if (useSSE) {
          res.write(`event: error\n`);
          res.write(
            `data: ${JSON.stringify({ message: `AI processing returned no content for ${url}` })}\n\n`,
          );
          res.end();
        } else {
          res
            .status(500)
            .json({ message: `AI processing returned no content for ${url}` });
        }
        return;
      }

      // Safely access aiDataResponse.content
      let finalData: aiProductData;

      try {
        if (useSSE) {
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({ message: "Processing AI analysis results..." })}\n\n`,
          );
        }

        const parsedData = JSON.parse(aiDataResponse.content);
        finalData = parsedData as aiProductData;
      } catch (error: any) {
        console.log(
          `[crawl-ts] - Failed to parse AI response for ${url}: ${error.message}`,
        );

        if (useSSE) {
          res.write(`event: error\n`);
          res.write(
            `data: ${JSON.stringify({
              message: `Failed to parse AI response for ${url}`,
              error: error.message,
            })}\n\n`,
          );
          res.end();
        } else {
          res.status(500).json({
            message: `Failed to parse AI response for ${url}`,
            error: error.message,
          });
        }
        return;
      }

      console.log(`Parsed AI Data: ${JSON.stringify(finalData)}`);

      if (useSSE) {
        res.write(`event: update\n`);
        res.write(
          `data: ${JSON.stringify({
            message: "Product information extracted",
            productName: finalData.name,
          })}\n\n`,
        );
      }

      let existingProduct = await products.findOne({
        url: url,
      });
      const user = await User.findById(userSession);

      if (!user && !apiToken) {
        console.error("Error: User not found");

        if (useSSE) {
          res.write(`event: error\n`);
          res.write(
            `data: ${JSON.stringify({ message: "User not found and no API token" })}\n\n`,
          );
          res.end();
        } else {
          res.status(401).json({ message: "Unauthorized user" });
        }
        return;
      }

      if (!existingProduct && user) {
        if (useSSE) {
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({ message: "New product found. Saving to database..." })}\n\n`,
          );
        }

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

          if (useSSE) {
            res.write(`event: update\n`);
            res.write(
              `data: ${JSON.stringify({
                message: "Product saved and added to your tracking list",
                product: {
                  name: newProduct.name,
                  price: newProduct.regularPrice,
                  image:
                    newProduct.images && newProduct.images.length > 0
                      ? newProduct.images[0]
                      : null,
                },
              })}\n\n`,
            );
          }
        } else {
          console.log("[crawl.ts:/bb: Error: Failed to create new product");

          if (useSSE) {
            res.write(`event: error\n`);
            res.write(
              `data: ${JSON.stringify({ message: "Failed to create new product" })}\n\n`,
            );
            res.end();
          } else {
            res.status(500).json({ message: "Failed to create new product" });
          }
          return;
        }
      } else {
        if (user) {
          if (useSSE) {
            res.write(`event: update\n`);
            res.write(
              `data: ${JSON.stringify({ message: "Product already exists in database. Adding to your list..." })}\n\n`,
            );
          }

          console.log(
            "[crawl.ts:/bb: Existing product, adding to user but not saving to database.",
          );

          // Add the existing product to the user's tracked products
          if (
            !user.products.some(
              (item) =>
                item.product.toString() === existingProduct?._id.toString(),
            )
          ) {
            user.products.push({
              product: existingProduct!._id,
              wantedPrice: 0,
            });
            await user.save();

            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({
                  message: "Product added to your tracking list",
                  product: {
                    name: existingProduct!.name,
                    price: existingProduct!.regularPrice,
                    image:
                      existingProduct!.images &&
                      existingProduct!.images.length > 0
                        ? existingProduct!.images[0]
                        : null,
                  },
                })}\n\n`,
              );
            }
          } else {
            console.log(
              "[crawl.ts:/bb: Product already exists in the user's tracked list.",
            );

            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({
                  message: "Product is already in your tracking list",
                  product: {
                    name: existingProduct!.name,
                    price: existingProduct!.regularPrice,
                    image:
                      existingProduct!.images &&
                      existingProduct!.images.length > 0
                        ? existingProduct!.images[0]
                        : null,
                  },
                })}\n\n`,
              );
            }
          }
        } else {
          // Update price history if needed
          if (useSSE) {
            res.write(`event: update\n`);
            res.write(
              `data: ${JSON.stringify({ message: "Checking for price updates..." })}\n\n`,
            );
          }

          const lastPriceEntry =
            existingProduct!.priceDateHistory[
              existingProduct!.priceDateHistory.length - 1
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
              "[crawl.ts:/bb: Existing product: updating price since unequal date",
            );

            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({
                  message: "Updating product price information",
                  oldPrice: lastPriceEntry?.Number,
                  newPrice: finalData.regularPrice,
                })}\n\n`,
              );
            }

            await products.updateOne(
              { sku: existingProduct!.sku },
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
              },
            );

            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({ message: "Price update complete" })}\n\n`,
              );
            }
          } else {
            console.log(
              "[crawl.ts:/bb: No update needed: Price and date are the same.",
            );

            if (useSSE) {
              res.write(`event: update\n`);
              res.write(
                `data: ${JSON.stringify({ message: "Product price is up to date" })}\n\n`,
              );
            }
          }
        }
      }

      console.log(`[crawl.ts] - Successfully processed 'other' URL: ${url}`);

      if (useSSE) {
        res.write(`event: complete\n`);
        res.write(
          `data: ${JSON.stringify({
            message: "Process complete",
            product: {
              id: existingProduct!._id,
              name: existingProduct!.name,
              price: existingProduct!.regularPrice,
              image:
                existingProduct!.images && existingProduct!.images.length > 0
                  ? existingProduct!.images[0]
                  : null,
            },
          })}\n\n`,
        );
        res.end();
      } else {
        res.status(200).json({ product: existingProduct });
      }
      return;
    }
  }
});

// ... rest of the file ...
export default router;
