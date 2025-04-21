//TODO: conver this javascript file into typescript file later by adding proper types
import products from "../models/bestBuyData";
import User from "../schema/userSchema";

//grabs all the users and products from the database,  if the price is lower than threshold, sends the email hehehe
//1.how will this work? this function will be exposed as an api endpoint
//2.will create a HashMap of all the products based upon its id
//3.will go through each users, prepare email for them and send it
async function sendAlerts() {
  const users = await User.find({});
  const allproductsfromdb = await products.find({});
  debugger;
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
  //we just use the alertStore here
  //TODO: send the email to all the key of @alertStore based upon the value, which is an array of the products, which are supposed to be merged together in a single email
}
export default sendAlerts;
