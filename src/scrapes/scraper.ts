import axios from "axios";
import random_user_agent from "./agents"; // Ensure this module returns a valid User-Agent string
import { parse } from "path";
import { log } from "console";

const defaultHeaders = {
  "User-Agent": random_user_agent(),
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "application/json",
};

interface BestBuyProduct {
  name: string;
  regularPrice: number;
  salePrice: number;
  highResImage: string;
  productUrl: string;
}

interface BestBuyResponse {
  products: BestBuyProduct[];
}

interface CadTireProduct {
  url: string;
  title: string;
  images: {
    url: string;
  }[];
  currentPrice: {
    value: number;
  };
}

interface CadTireResponse {
  products: CadTireProduct[];
}

export async function scrapeBestBuy(
  keyword: string,
): Promise<
  {
    title: string;
    price: number;
    salePrice: number;
    image: string;
    url: string;
  }[]
> {
  const page = 1;
  const searchString = keyword;
  const URL = `https://www.bestbuy.ca/api/v2/json/search?query=${searchString}&page=${page}`;

  try {
    const response = await axios.get<BestBuyResponse>(URL, {
      headers: defaultHeaders,
    });
    const data = response.data;

    // console.log(data);

    // Map and transform the product data
    const parsedData = data.products.map((product: BestBuyProduct) => ({
      title: product.name,
      price: product.regularPrice,
      salePrice: product.salePrice,
      image: product.highResImage,
      url: `https://www.bestbuy.ca${product.productUrl}`,
    }));

    // console.log(parsedData);

    return parsedData;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error("Failed to scrape data");
  }
}

// URL link is not given but the pattern is https://www.gianttiger.com/products/${handle}?variant=${objectID}
interface GiantTigerProduct {
  title: string;
  price: number;
  image: string;
  handle: string;
  objectID: string;
}

interface GiantTigerResponse {
  results: {
    hits: GiantTigerProduct[];
  }[];
}

interface SimonsProductResponse{
  results: {
    hits: SimonsProduct[];
  }[];
}
interface SimonsProduct {
  title?: string;
  brand_name?: string;
  regular_price?: number;
  price: number;
  image: string;
}

export async function scrapeSimons(keyword: string,
): Promise<{ title?: string; brand_name?: string; price: number;image: string;}[]> {
  const searchString = keyword;
  const algoliaAPIKey = "cafaab73d1b1e8b2721d108fc92ddc99"
  const algoliaID = "7BMC2DATKE"

  const URL = `https://7bmc2datke-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.17.0)%3B%20Browser%20(lite)%3B%20instantsearch.js%20(4.55.0)%3B%20Vue%20(2.7.14)%3B%20Vue%20InstantSearch%20(4.9.0)%3B%20JS%20Helper%20(3.12.0)&x-algolia-api-key=${algoliaAPIKey}&x-algolia-application-id=${algoliaID}`
  const BASE_URL_IMG = "https://imagescdn.simons.ca/"

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": random_user_agent(),
    Accept: "*/*",
    Connection: "keep-alive",
  }

  const payload = {
    requests: [
      {
        indexName: "simons_products_en-CA",
        hitsPerPage: 1000,
        distinct: false,
        analytics: false,
        clickAnalytics: false,
        page: 0,
        params: `query=${encodeURIComponent(searchString)}&hitsPerPage=100&facets=["product_type"]&tagFilters=`
      }
    ]
  }

  try {
    const response = await axios.post<SimonsProductResponse>(URL, payload, {
      headers,
    });
    const data = response.data;
    // console.log(data);

    // Parse and transform the product data
    const parsedData = data.results[0].hits.map(
      (product: SimonsProduct) => ({
        title: product.title || product.brand_name,
        price: product.price,
        image: `${BASE_URL_IMG}${product.image}`
      }),
    );

    //  console.log(parsedData);

    return parsedData;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error("Failed to scrape data");
  }

}

export async function scrapeGiantTiger(
  keyword: string,
): Promise<{ title: string; price: number; image: string; url: string }[]> {
  const searchString = keyword;
  const algoliaAPIKey = "1ec86e7ee6661988fb72e0c843badcd8";
  const algoliaAPPId = "NGMHTYXT0T";

  const URL = `https://ngmhtyxt0t-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.15.0)%3B%20Browser%20(lite)&x-algolia-api-key=${algoliaAPIKey}&x-algolia-application-id=${algoliaAPPId}`;

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": random_user_agent(),
    Accept: "*/*",
    Connection: "keep-alive",
  };

  const payload = {
    requests: [
      {
        indexName: "shopify_products",
        hitsPerPage: 1000,
        distinct: false,
        analytics: false,
        clickAnalytics: false,
        page: 0,
        params: `query=${encodeURIComponent(searchString)}&hitsPerPage=100&facets=["product_type"]&tagFilters=`,
      },
    ],
  };

  try {
    const response = await axios.post<GiantTigerResponse>(URL, payload, {
      headers,
    });
    const data = response.data;
    // console.log(data);

    // Parse and transform the product data
    const parsedData = data.results[0].hits.map(
      (product: GiantTigerProduct) => ({
        title: product.title,
        price: product.price,
        image: product.image,
        handle: product.handle,
        objectID: product.objectID,
        url: `https://www.gianttiger.com/products/${product.handle}?variant=${product.objectID}`,
      }),
    );

    //  console.log(parsedData);

    return parsedData;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error("Failed to scrape data");
  }
}

export async function scrapeCadTire(keyword: string) {
  const searchString = keyword;
  const cadTireSubKey: string = "c01ef3612328420c9f5cd9277e815a0e";
  const storeCode: string = "600";

  const URL: string = `https://apim.canadiantire.ca/v1/search/v2/search?q=${searchString}&store=${storeCode}`;

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": random_user_agent(),
    Accept: "*/*",
    Connection: "keep-alive",
    "ocp-apim-subscription-key": `${cadTireSubKey}`,
  };

  try {
    const response = await axios.get<CadTireResponse>(URL, { headers });
    const data = response.data;

    // log(data.products)
    if (!data.products || data.products.length === 0) {
      // logic for brand search
      // log(data)
    } else {
      const parsedData = data.products.map((product: CadTireProduct) => ({
        title: product.title,
        url: product.url,
        currentPrice: product.currentPrice.value,
        image: product.images[0].url,
      }));

      // log("this is the parsed data")
      // console.log(parsedData);
      return parsedData;
    }
  } catch (error) {
    console.log(`Error fetching data: `, error);
    throw new Error(`Failed to scrape data`);
  }
}


// NOT WORKING NOT SURE WHY IT'S THE SAME ARCHITECTURE AS CADTIRE
export async function scrapeSportCheck(keyword: string) {
  const searchString = keyword;
  const sportCheckSubKey: string = "c01ef3612328420c9f5cd9277e815a0e";
  const storeCode: string = "5141";

  const URL: string = `https://apim.sportchek.ca/v1/search/v2/search?q=${searchString}&store=${storeCode}`;

  const headers = {
    "authority": "apim.sportchek.ca",
    "Content-Type": "application/json",
    "User-Agent": random_user_agent(),
    "Accept": "*/*",
    "Connection": "keep-alive",
    "Referer": "https://www.sportchek.ca/",
    "Dnt": "1",
    "ocp-apim-subscription-key": `${sportCheckSubKey}`,
  };

  try {
    const response = await axios.get<CadTireResponse>(URL, { headers });
    const data = response.data;

    // console.log(data);


    // log(data.products)
    if (!data.products || data.products.length === 0) {
      // logic for brand search
      // log(data)
    } else {
      const parsedData = data.products.map((product: CadTireProduct) => ({
        title: product.title,
        url: product.url,
        currentPrice: product.currentPrice.value,
        image: product.images[0].url,
      }));

      log("this is the parsed data")
      // console.log(parsedData);
      return parsedData;
    }
  } catch (error) {
    console.log(`Error fetching data: `, error);
    throw new Error(`Failed to scrape data`);
  }
}


// Call the function to test it
// scrapeSimons("shirt")
//   .then(data => console.log(data))
//   .catch(error => console.error(error));

// scrapeSportCheck("Shoes")
//   .then(data => console.log(data))
//   .catch(error => console.error(error));
