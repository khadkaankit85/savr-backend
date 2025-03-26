import express, { Request, Response } from "express";
import {
  getRawHTML,
  getRelevantHTMLJSDOM,
  getBestBuyScriptTagOnly,
  fixIncompleteJSON,
} from "../crawls/crawler";
import {
  BestBuyProductScraped,
  BestBuyProductStoreDetail,
} from "../types/product";
import ProductModel, { Product } from "../schema/productSchema";
import User from "../schema/userSchema";

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

router.get("/BB", async (req: Request, res: Response) => {
  console.log(`Crawling URL request: ${req.query.url}`);

  const user = req.session.passport?.user;
  //TODO:this should be checked in middleware, but early optimization is a waste of time lol
  if (!user?._id) {
    res.status(401).json({ message: "not authenticated to use this route)" });
    return
  }
  const url = req.query.url as string;

  if (!url) {
    res.status(400).json({ message: "URL is required" });
  }
  try {
    //TODO: check if the url is already in the database
    // if the url exists in the databse check if the latest price is of today or not
    const html = await getRawHTML(url);
    const bodyResult = getRelevantHTMLJSDOM(html);
    const scriptResult = getBestBuyScriptTagOnly(bodyResult);
    const fixedJSON: string = scriptResult
      ? fixIncompleteJSON(scriptResult)
      : "";

    const finalData: BestBuyProductScraped = JSON.parse(fixedJSON);
    res.json(finalData);
    //store the product detail in the database and update the price daily now:)

    // Check if product already exists in the database
    let existingProduct = await ProductModel.findOne({
      storeProductId: finalData.sku,
    });

    if (!existingProduct) {
      // Create a new product entry if it doesn't exist
      await ProductModel.create({
        name: finalData.name,
        storeProductId: finalData.sku,
        originalLink: url, // Store the original link if available
        storeDetails: [
          {
            storeName: "BestBuy",
            storeProductId: finalData.sku,
            originalPrice: finalData.regularPrice,
            discountedPrice: finalData.isOnSale
              ? finalData.priceWithEhf
              : undefined,
            saleStartDate: finalData.saleStartDate
              ? new Date(finalData.saleStartDate)
              : undefined,
            saleEndDate: finalData.saleEndDate
              ? new Date(finalData.saleEndDate)
              : undefined,
            isOnSale: finalData.isOnSale,
            isMarketplace: finalData.isMarketplace,
            isClearance: finalData.isClearance,
            customerRating: finalData.customerRating,
            customerRatingCount: finalData.customerRatingCount,
            additionalImages: finalData.additionalImages || [],
          },
        ],
        priceDetail: [
          {
            date: new Date(),
            originalPrice: finalData.regularPrice,
            discountedPrice: finalData.isOnSale
              ? finalData.priceWithEhf
              : undefined,
          },
        ],
      });
    } else {
      // Update price details
      existingProduct.priceDetail.push({
        date: new Date(),
        originalPrice: finalData.regularPrice,
        discountedPrice: finalData.isOnSale
          ? finalData.priceWithEhf
          : undefined,
      });

      // Update store details for BestBuy if it exists, otherwise, add new store detail
      const bestBuyDetailIndex: number = existingProduct.storeDetails.findIndex(
        (detail: BestBuyProductStoreDetail) => detail.storeName === "BestBuy",
      );

      if (bestBuyDetailIndex !== -1) {
        // Update existing BestBuy details
        existingProduct.storeDetails[bestBuyDetailIndex] = {
          storeName: "BestBuy",
          storeProductId: finalData.sku,
          originalPrice: finalData.regularPrice,
          discountedPrice: finalData.isOnSale
            ? finalData.priceWithEhf
            : undefined,
          saleStartDate: finalData.saleStartDate
            ? new Date(finalData.saleStartDate)
            : undefined,
          saleEndDate: finalData.saleEndDate
            ? new Date(finalData.saleEndDate)
            : undefined,
          isOnSale: finalData.isOnSale,
          isMarketplace: finalData.isMarketplace,
          isClearance: finalData.isClearance,
          customerRating: finalData.customerRating,
          customerRatingCount: finalData.customerRatingCount,
          additionalImages: finalData.additionalImages || [],
        } as BestBuyProductStoreDetail;
      } else {
        // Add BestBuy details if not present
        existingProduct.storeDetails.push({
          storeName: "BestBuy",
          storeProductId: finalData.sku,
          originalPrice: finalData.regularPrice,
          discountedPrice: finalData.isOnSale
            ? finalData.priceWithEhf
            : undefined,
          saleStartDate: finalData.saleStartDate
            ? new Date(finalData.saleStartDate)
            : undefined,
          saleEndDate: finalData.saleEndDate
            ? new Date(finalData.saleEndDate)
            : undefined,
          isOnSale: finalData.isOnSale,
          isMarketplace: finalData.isMarketplace,
          isClearance: finalData.isClearance,
          customerRating: finalData.customerRating,
          customerRatingCount: finalData.customerRatingCount,
          additionalImages: finalData.additionalImages || [],
        });
      }

      await existingProduct.save();
      //after scraping the user requested url, we would wanna store that product id in the datbase for the users tracked product
      try {
        const newProductToTrack = {
          storeProductId: existingProduct._id,
          alertPrice: 50,
          trackedDate: new Date(),
        }
        await User.findOneAndUpdate({
          _id: user._id
        }, {
          $push: {
            trackedProducts: { newProductToTrack }
          }
        }, { runValidators: true }

        )
      }
      catch {
        console.log("couldn't insert as the tracked product for user ", req.session.passport?.user?._id)
      }
    }

  } catch (error) {
    res.status(500).json({ message: "Error fetching data" });
  }
});

export default router;
