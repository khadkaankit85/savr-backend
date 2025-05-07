import { log } from "node:console";
import { OpenAI } from "openai";
import random_user_agent from "../scrapes/agents";
import axios from "axios";
import puppeteer from "puppeteer-core";
import dotenv from "dotenv";

dotenv.config();

interface sephoraSkuData {
  productId: string;
  heroImageAltText: string;
  currentSku: {
    skuId: string;
    alternateImages?: Array<{
      image250?: string;
      altText?: string;
      imageUrl?: string;
    }>;
    skuImages?: {
      image250?: string;
      imageUrl?: string;
    };
    listPrice?: number;
  };
}

const defaultHeaders = {
  "User-Agent": random_user_agent(),
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

// Universal scrape will have uniform interface that I'll dictate to the AI API

interface universalProduct {
  productSku: string;
  productName: string;
  listPrice: number;
  description: string;
  imageURLs: Array<{ imageURl: string }>;
}

async function sephoraParseProductDetails(
  url: string
): Promise<sephoraSkuData | null> {
  // https://www.sephora.com/api/v3/users/profiles/current/product/P393401
  // https://www.sephora.com/ca/en/product/nars-light-reflecting-advance-skincare-foundation-P479338?skuId=2514644&icid2=products%20grid:p479338:product
  // https://www.sephora.com/ca/en/product/P506548 <- productID only
  // https://www.sephora.com/ca/en/product/P506548?skuId=2666998 <- productID and skuID
  // So it can either have only the productID, or the productID and the skuID.

  console.log(`URL: ${url}`);

  const half = url.split("?");

  const productIdRaw = half[0];
  const skuIdRaw = half[1];

  console.log(`ProductIdRaw: ${half[0]}`);
  console.log(`skuIdRaw: ${half[1]}`);

  const productId = url.match(/P\d+/);
  console.log(`ProductIdMatch = ${productId}`);

  // TODO product cannot be null, but sku can be null which should default to just the main product details

  // const productId = productIdMatch ? productIdMatch[0].substring(1) : null;

  // console.log(`productId = ${productId}`);

  // sephoraParseProductDetails(
  //   "https://www.sephora.com/ca/en/product/P506548?skuId=2666998"
  // );

  const skuIdMatch = url.match(/skuId=(\d+)/);
  const skuId = skuIdMatch ? skuIdMatch[1] : null;

  console.log(`SkuId = ${skuId}`);

  try {
    // let axiosUrl = `https://www.sephora.com/api/v3/users/profiles/current/product/${productId}`;
    let axiosUrl = `https://www.sephora.com/api/v3/users/profiles/current/product/${productId}?preferedSku=${skuIdMatch}&countryCode=CA&loc=en-CA`;

    // https://www.sephora.com/api/v3/users/profiles/current/product/P393401
    const response = await axios.get<sephoraSkuData>(axiosUrl, {
      headers: defaultHeaders,
    });
    const data = response.data;
    const finalData = {
      productId: data.productId,
      heroImageAltText: data.heroImageAltText,
      currentSku: data.currentSku,
    };

    finalData.currentSku.listPrice = stringToNumber(
      finalData.currentSku.listPrice?.toString() || "$0.00"
    );

    // console.log(finalData);
    return finalData;
  } catch (error) {
    console.log(`[parsers.ts] - Axios error fetching sephora details ${error}`);
  }
  return null;
}

async function universalScrapeJS(url: string) {
  try {
    let browser;

    if (process.env.ENVIRONMENT == "dev") {
      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.CHROME_PATH,
        headless: true,
      });
    } else {
      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: "/app/.chrome-for-testing/chrome-linux64/chrome",
        headless: true,
      });
    }

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2" });

    const rawLd = await page.$$eval(
      'script[type="application/ld+json"]',
      (nodes) => nodes.map((n) => n.textContent)
    );

    console.log(rawLd);

    const bodyHTML = rawLd
      .map((txt) => JSON.parse(txt!))
      .filter((o) => o && o["@type"] === "Product");

    await browser.close();

    // Convert html because right now it's [{...data}]
    let productData = bodyHTML[0];
    let productJsonString = JSON.stringify(productData);

    return productJsonString;
  } catch (error) {
    console.log(`[parsers.ts] - Error getting universal scrape ${error}`);
  }
}

async function finalizeWithAi(data: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`Requesting from OpenAI...`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that converts product information into a specific MongoDB schema. Only return the final JSON because the content will be used directly in code, in JSON.parse function.",
      },
      {
        role: "user",
        content: `Here is the product info scraped from a website: ${data}
        
        Transform it into this schema (MongoDB-ready) in JSON format only.
        If fields are missing, use null. Regular price is the price it's being listed right now.
        Only return the JSON  response without any other messages.

{
  sku: string,
  name: string,
  customerRating: number | null,
  customerRatingCount: number | null,
  regularPrice: number,
  images: [string],
  brandName: string,
  longDescription: string,
  url: string,
}

        `,
      },
    ],
    temperature: 0.2,
  });

  let finalProductData = completion.choices[0].message;

  console.log(finalProductData);

  return finalProductData;
}

function stringToNumber(str: string) {
  // $16.00
  let splitString = str.split("$");
  let result = Number(splitString[1]);
  return result;
}

export { sephoraParseProductDetails, universalScrapeJS, finalizeWithAi };
