import express, { NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import dotenv from "dotenv";
import cors from "cors";
import productModel from "./schema/productSchema";

//routes
import productRoute from "./routes/products";
import scrapeRoute from "./routes/scrape";
import userRoute from "./routes/user";
import crawlRoute from "./routes/crawl";

import { connectToDatabase } from "./utils/mongooseConnect";
import { appConfigs } from "./configs/appconfigs";

dotenv.config();
const app = express();
const swaggerDocument = YAML.load("./swagger.yaml");
connectToDatabase();

// Enable CORS
app.use(cors());
app.use(express.json());

//for docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/products", productRoute);

app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
  const keyword = req.query.keyword as string;
  if (keyword) {
    const findProductName = await productModel.findOne({ name: keyword });
    if (!findProductName) {
      await productModel.insertOne({ name: keyword });
    }
  }

  // console.log(await productModel.find({}));
  next();
});
app.use("/api/scrape", scrapeRoute);
app.use("/api/user", userRoute);
app.use("/api/crawl", crawlRoute);

app.get("/", (_req, res) => {
  res.send("hello world");
});

app.listen(appConfigs.port, () => {
  console.log("app is live on port ", appConfigs.port);
});
