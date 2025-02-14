import axios from 'axios';
import "./agents"
import random_user_agent from './agents';

const page = 1;
const searchString = "playstation";
const URL = `https://www.bestbuy.ca/api/v2/json/search?query=${searchString}&page=${page}`;

const headers = {
    "User-Agent": random_user_agent(),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
};

interface Product {
    name: string;
    regularPrice: number;
    salePrice: number;
}

interface BestBuyResponse {
    products: Product[];
}

axios.get<BestBuyResponse>(URL, { headers })
    .then((response) => {
        const data = response.data;

        // check the data
        console.log(data.products);

        // Parse time
        const parsedData = data.products.map((product: Product) => ({
            name: product.name,
            regPrice: product.regularPrice,
            salePrice: product.salePrice
        }));

        // Tabulate
        console.table(parsedData, ["name", "regPrice", "salePrice"]);
    })
    .catch((error: any) => {
        console.error('Error fetching data:', error);
    });