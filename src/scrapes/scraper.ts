import axios from 'axios';
import random_user_agent from './agents'; // Ensure this module returns a valid User-Agent string
import { parse } from 'path';

const headers = {
    "User-Agent": random_user_agent(),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "application/json",
};

interface Product {
    name: string;
    regularPrice: number;
    salePrice: number;
    highResImage: string;
    productUrl: string;
}

interface BestBuyResponse {
    products: Product[];
}

export async function scrapeBestBuy(keyword: string): Promise<{ title: string; price: number; salePrice: number; image: string; url: string; }[]> {
    const page = 1;
    const searchString = keyword;
    const URL = `https://www.bestbuy.ca/api/v2/json/search?query=${searchString}&page=${page}`;

    try {
        const response = await axios.get<BestBuyResponse>(URL, { headers });
        const data = response.data;

        // console.log(data);


        // Map and transform the product data
        const parsedData =  data.products.map((product) => ({
            title: product.name,
            price: product.regularPrice,
            salePrice: product.salePrice,
            image: product.highResImage,
            url: `https://www.bestbuy.ca${product.productUrl}`
        }));

        console.log(parsedData);
        

        return parsedData
    } catch (error) {
        console.error('Error fetching data:', error);
        throw new Error('Failed to scrape data'); 
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

export async function scrapeGiantTiger(keyword: string): Promise<{title: string; price: number; image: string; url: string}[]> {
    const searchString = keyword
    const algoliaAPIKey = "1ec86e7ee6661988fb72e0c843badcd8"
    const algoliaAPPId = "NGMHTYXT0T"

    const URL = `https://ngmhtyxt0t-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.15.0)%3B%20Browser%20(lite)&x-algolia-api-key=${algoliaAPIKey}&x-algolia-application-id=${algoliaAPPId}`

    const headers = {
        "Content-Type": "application/json",
        "User-Agent": random_user_agent(),
        "Accept": "*/*",
        "Connection": "keep-alive",

    }

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
        const response = await axios.post<GiantTigerResponse>(URL, payload, { headers });
        const data = response.data;
        // console.log(data);
        

        // Parse and transform the product data
        const parsedData = data.results[0].hits.map((product: GiantTigerProduct) => ({
            title: product.title,
            price: product.price,
            image: product.image,
            handle: product.handle,
            objectID: product.objectID,
            url: `https://www.gianttiger.com/products/${product.handle}?variant=${product.objectID}`
        }));

        // console.log(parsedData);

        return parsedData;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw new Error('Failed to scrape data'); // Ensure proper error propagation
    }

}

