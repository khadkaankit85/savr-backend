import { log } from "node:console";
import random_user_agent from "../scrapes/agents";
import axios from "axios";

interface sephoraSkuData {
  productId: string;
  currentSku: {
    targetUrl: string;
    skuId: string;
    alternateImages?: Array<{
      image250?: string;
      altText?: string;
      imageUrl?: string;
    }>;
    skuImages?: Array<{
      image250?: string;
      imageUrl?: string;
    }>;
    listPrice?: string;
  };
}

async function sephoraParseProductDetails(
  url: string
): Promise<sephoraSkuData | null> {
  // https://www.sephora.com/api/v3/users/profiles/current/product/P393401
  // https://www.sephora.com/ca/en/product/nars-light-reflecting-advance-skincare-foundation-P479338?skuId=2514644&icid2=products%20grid:p479338:product
  // https://www.sephora.com/ca/en/product/P506548 <- productID only
  // https://www.sephora.com/ca/en/product/P506548?skuId=2666998 <- productID and skuID
  // So it can either have only the productID, or the productID and the skuID.

  const defaultHeaders = {
    "User-Agent": random_user_agent(),
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
  };

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
      currentSku: data.currentSku,
    };

    // console.log(finalData);
    return finalData;
  } catch (error) {
    console.log(`[parsers.ts] - Axios error fetching sephora details ${error}`);
  }
  return null;
}

sephoraParseProductDetails(
  "https://www.sephora.com/ca/en/product/satin-hydrating-lipstick-P501496?skuId=2564474&icid2=products%20grid:p501496:product"
);
export { sephoraParseProductDetails };
