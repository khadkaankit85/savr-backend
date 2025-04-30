import { log } from "console";
import products from "../models/bestBuyData";
import mongoose, { mongo } from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import { env } from "process";

interface ProductToUpdate {
  url: string;
  date: Date; // TODO Check the type of this, i think date?
}

interface PulledProducts {
  url: string;
  date: Date;
  priceDateHistory: { Number: number; Date: Date }[];
}

dotenv.config();
const environment = process.env.ENVIRONMENT;

// const db_url = process.env.DATABASE_URL;
const db_url =
  environment === "prod"
    ? process.env.DATABASE_URL
    : process.env.LOCAL_DATABASE_URL;

const backend_url =
  environment === "prod"
    ? process.env.BACKEND_URL
    : process.env.LOCAL_BACKEND_URL;
console.log(
  `Environment is: ${environment}, setting backend url to:  ${backend_url}, database as ${db_url}`
);

async function updateProducts() {
  try {
    // DEBUG FOR TESTING ONLY
    if (!db_url) {
      throw new Error("DATABASE_URL not defined");
    }
    await mongoose.connect(db_url, { dbName: "savr" });

    if (mongoose.connection.readyState === 1) {
      log("[priceUpdate worker] MongoDB connection is successful");
    } else {
      console.log("Connection is not successful.");
    }

    const productDetails: PulledProducts[] = await products.find({});

    // console.log(`Pulled products: ${productDetails}`);

    for (let i = 0; i < productDetails.length; i++) {
      const product = productDetails[i];

      if (product.priceDateHistory.length === 0) {
        log(
          `[priceUpdate worker] - No price history available for ${product.url}`
        );
        continue;
      }

      const latestProductDetails =
        product.priceDateHistory[product.priceDateHistory.length - 1];
      const productUrl = product.url;

      if (!latestProductDetails.Date) {
        log(
          `[priceUpdate worker] - Missing date entry for the latest entry of ${product.url}`
        );
        continue;
      } else {
        log(
          `[priceUpdate worker] - Latest date for ${product.url}: `,
          latestProductDetails.Date
        );
      }

      if (dateIsToday(latestProductDetails.Date)) {
        console.log(`[priceUpdate worker] - Product Date is today... skipping`);
        continue;
      } else {
        console.log(
          `[priceUpdate worker] - Product date is not today...updating product:`
        );
        // this is where I scrape the product again, then push the date.

        try {
          const response = await axios.get(
            `${backend_url}/api/crawl/BB?url=${productUrl}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.SCRAPER_API_TOKEN}`,
              },
            }
          );
          console.log(
            `[priceUpdate worker] - Product successfully updated: `,
            JSON.stringify(response.data, null, 2)
          );
        } catch (error) {
          console.error(
            "[priceUpdate worker] - Unable to update product date",
            error
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "[priceUpdate worker] - Error connecting to MongodB: ",
      error
    );
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      log("[priceUpdate worker] - MongoDB connection closed");
    }
  }
}

function dateIsToday(d1: Date): boolean {
  if (isNaN(new Date(d1).getTime())) {
    console.error("[priceUpdate worker] - Invalid date provided:", d1);
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const productDate = new Date(d1);
  productDate.setHours(0, 0, 0, 0);

  return today.getTime() === productDate.getTime();
}

updateProducts();
console.log(`Proudct update for ${new Date()} finished`);
