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

export async function scrape(keyword: string): Promise<{ name: string; regPrice: number; salePrice: number; highResImage: string }[]> {
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
