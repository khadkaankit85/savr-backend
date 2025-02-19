import axios from 'axios';
import random_user_agent from './agents'; // Ensure this module returns a valid User-Agent string

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
}

interface BestBuyResponse {
    products: Product[];
}

export async function scrapeBestbuy(keyword: string): Promise<{ name: string; regPrice: number; salePrice: number; highResImage: string }[]> {
    const page = 1;
    const searchString = keyword;
    const URL = `https://www.bestbuy.ca/api/v2/json/search?query=${searchString}&page=${page}`;

    try {
        const response = await axios.get<BestBuyResponse>(URL, { headers });
        const data = response.data;

        console.log(data);
        

        // Map and transform the product data
        return data.products.map((product) => ({
            name: product.name,
            regPrice: product.regularPrice,
            salePrice: product.salePrice,
            highResImage: product.highResImage,
        }));
    } catch (error) {
        console.error('Error fetching data:', error);
        throw new Error('Failed to scrape data'); // Ensure proper error propagation
    }
}

// "x-algolia-agent": "Algolia%20for%20JavaScript%20(4.15.0)%3B%20Browser%20(lite)",
// "X-Algolia-API-Key": "1ec86e7ee6661988fb72e0c843badcd8",  # Replace with your API key
// "X-Algolia-Application-Id": "NGMHTYXT0T",  # Replace with your Application ID


export async function scrapeGiantTiger(){
    const URL = "https://ngmhtyxt0t-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.15.0)%3B%20Browser%20(lite)&x-algolia-api-key=1ec86e7ee6661988fb72e0c843badcd8&x-algolia-application-id=NGMHTYXT0T"
    

}