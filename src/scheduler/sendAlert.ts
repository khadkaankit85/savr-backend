//TODO: conver this javascript file into typescript file later by adding proper types
import { ObjectId } from "mongoose";
import products, { Product } from "../models/bestBuyData";
import User from "../schema/userSchema";
import { BestBuyProduct } from "../scrapes/scraper";
import sendEmail from "../utils/sendEmail";

//grabs all the users and products from the database,  if the price is lower than threshold, sends the email hehehe
//1.how will this work? this function will be exposed as an api endpoint
//2.will create a HashMap of all the products based upon its id
//3.will go through each users, prepare email for them and send it
async function sendAlerts() {
  const users = await User.find({});
  const allproductsfromdb = await products.find({});
  //hashmap of  userId and the products, for which users will get alert
  const alertStore = new Map();
  //hashmap of users id and their email address
  const userStore = new Map();
  //store has all the product and productid from the database
  const productStore = new Map();
  allproductsfromdb.map((product) => {
    productStore.set(product.id, product);
  });
  users.map((user) => {
    const trackedProducts = user.bestBuyProducts;
    trackedProducts.map((product) => {
      //for each product, check the alert price and today's price and then store that in alertstore if alert needs to be created for that user
      const proudctId = product.product.toString();
      const alertPrice = product.wantedPrice;
      //this is an array of the prices, not just number, but array of date and price
      const realPrices = productStore.get(proudctId)?.priceDateHistory;
      if (!realPrices || realPrices.length === 0) return;
      ///so the real price is the one at the end of the array, which belongs to today:)
      const realPrice = realPrices[realPrices.length - 1];
      if (realPrice.Number <= alertPrice) {
        //store in the alertstore of that user, so that we can send them email
        //if we already have alert for the user in ourt alertStore hashmap, then we push to it, otherwise we create the hashmap key value for that user

        if (!alertStore.get(user.id)) {
          alertStore.set(user.id, []);
        }

        alertStore.get(user.id).push(product);
      }

      //save the users email in the userStore
      userStore.set(user.id, user.email);
    });
  });
  //use a forEach loop to go through the users in the alertStore, and then send them email
  //we just use the alertStore here, proudctList is everything that you can see when you do db.users.find({}) so basically the bestBuyProducts property of users as of 2025-04-21
  for (const [userId, productList] of alertStore.entries()) {
    const email = userStore.get(userId);
    const productLines = productList
      .map((pd: { product: ObjectId }) => {
        const product = productStore.get(pd.product.toString());
        return `
          <li>
            <strong>${product.name}</strong><br />
            Current Price: <strong>$${product.priceDateHistory.at(-1).Number}</strong><br />
            <a href="${product.url}" target="_blank">Check it out</a>
          </li>
        `;
      })
      .join("");

    const emailBody = `
      <h2>🔥 Price Drop Alert from Savr 🔔</h2>
      <p>Here are the products you're watching that are now below your desired price:</p>
      <ul>${productLines}</ul>
    `;

    await sendEmail(email, "Your tracked products are on SALE!", emailBody);
  }
}
export default sendAlerts;
