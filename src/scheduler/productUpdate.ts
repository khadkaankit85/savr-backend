import { log } from "console";
import bestBuy_products from "../models/bestBuyData";
import mongoose, { mongo } from "mongoose";
import axios from "axios";

interface ProductToUpdate {
  url: string;
  date: Date; // TODO Check the type of this, i think date?
}

interface PulledProducts {
  url: string;
  date: Date;
  priceDateHistory: { Number: number; Date: Date }[];
}

const db_url =
  "mongodb+srv://mattazz:Burnout90210@testing.h0pbt.mongodb.net/?retryWrites=true&w=majority&appName=Testing";

async function updateProducts() {
  try {
    // DEBUG FOR TESTING ONLY
    await mongoose.connect(db_url, { dbName: "savr" });

    if (mongoose.connection.readyState === 1) {
      log("MongoDB connection is successful");
    } else {
      console.log("Connection is not successful.");
    }

    const productDetails: PulledProducts[] = await bestBuy_products.find({});

    for (let i = 0; i < productDetails.length; i++) {
      const product = productDetails[i];

      if (product.priceDateHistory.length === 0) {
        log(`No price history available for ${product.url}`);
        continue;
      }

      const latestProductDetails =
        product.priceDateHistory[product.priceDateHistory.length - 1];
      const productUrl = product.url;

      if (!latestProductDetails.Date) {
        log(`Missing date entry for the latest entry of ${product.url}`);
        continue;
      } else {
        log(`Latest date for ${product.url}: `, latestProductDetails.Date);
      }

      if (dateIsToday(latestProductDetails.Date)) {
        console.log(`Product Date is today... skipping`);
        continue;
      } else {
        console.log(`Product date is not today...updating product:`);
        // this is where I scrape the product again, then push the date.

        try {
          const response = await axios.get(
            `https://api.savr.one/api/crawl/BB?url=${productUrl}`
          );
          console.log(`Product successfully updated!`);
        } catch (error) {
          console.error("Unable to update product date", error);
        }
      }
    }
  } catch (error) {
    console.error("Error connecting to MongodB: ", error);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      log("MongoDB connection closed");
    }
  }
}

function dateIsToday(d1: Date): boolean {
  if (isNaN(new Date(d1).getTime())) {
    console.error("Invalid date provided:", d1);
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const productDate = new Date(d1);
  productDate.setHours(0, 0, 0, 0);

  return today.getTime() === productDate.getTime();
}

updateProducts();
