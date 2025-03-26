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

// (async () => {
//     const html = await getRawHTML();
//     const bodyResult = getRelevantHTMLJSDOM(html);
//     const scriptResult = getBestBuyScriptTagOnly(bodyResult);

//     // Check if scriptResult is not null before passing it to fixIncompleteJSON stupid typescript
//     const fixedJSON = scriptResult ? fixIncompleteJSON(scriptResult) : "";
//     const final = fixedJSON;

//     // Write the final output to a file (just for testing)
//     fs.writeFileSync("output.json", final);
// })();

const router = express.Router();

router.get("/BB", async (req: Request, res: Response): Promise<void> => {
  console.log(`Crawling URL request: ${req.query.url}`);

  const url = req.query.url as string;
  // TODO go back to this to get session ID

  const userSession = req.session.user?.id;
  if (!userSession) {
    res.status(401).json("user unauth"); // unauth
    return;
  }

  if (!url) {
    res.status(400).json({ message: "URL is required" });
    return;
  }
  try {
    const html = await getRawHTML(url); // parses here
    const bodyResult = getRelevantHTMLJSDOM(html); // gets raw HTML
    const scriptResult = getBestBuyScriptTagOnly(bodyResult); // narrows down bestbuy
    const fixedJSON: string = scriptResult
      ? fixIncompleteJSON(scriptResult)
      : ""; // fixes json
    const finalData: { [key: string]: any } = JSON.parse(fixedJSON);
    res.json(finalData);

    let existingProduct = await bestBuy_products.findOne({
      sku: finalData.product.sku,
    });
    if (!existingProduct) {
      finalData.product.url = url;

      finalData.product.priceDateHistory = [
        {
          Number: finalData.product.priceWithEhf,
          Date: new Date(),
        },
      ];

      // Reformat JSON data so that price is an priceList[] => (price, date) for later pulling for charting

      // This is for MONGO:
      let productData = finalData.product;

      // Insert data into MongoDB
      const newProduct = await bestBuy_products.create(productData);
      const user = await User.findById(userSession);

      if (user) {
        user.bestBuyProducts.push(newProduct._id);
        await user.save();
      } else {
        return;
      }
    } else {
      //   TODO check if same day then don't update, else update
      await bestBuy_products.updateOne(
        { sku: existingProduct.sku },
        {
          $push: {
            priceDateHistory: {
              Number: finalData.product.priceWithoutEhf,
              Date: new Date(),
            },
          },
        }
      );

      //   console.log("this is the result", updateResult);

      const user = await User.findById(userSession);

      if (user) {
        user.bestBuyProducts.push(existingProduct._id);
        await user.save();
      } else {
        return;
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    // res.status(500).json({ message: "Error fetching data" });
  }
});

export default router;
