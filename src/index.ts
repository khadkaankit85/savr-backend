import express, { NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import productModel from "./schema/productSchema";

//routes
import productRoute from "./routes/products";
import scrapeRoute from "./routes/scrape";
import userRoute from "./routes/user";
import crawlRoute from "./routes/crawl";

import { connectToDatabase } from "./utils/mongooseConnect";
import { appConfigs } from "./configs/appconfigs";
import mongoose from "mongoose";
import passport from "passport";

dotenv.config();
const app = express();

// Enable CORS
app.use(
  cors({
    origin: [appConfigs.frontendUrl, "https://www.savr.one"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

console.log("CORS allowed origin:", appConfigs.frontendUrl);

const swaggerDocument = YAML.load("./swagger.yaml");

connectToDatabase();
app.use(
  session({
    secret: appConfigs.sessionSecret,
    store: MongoStore.create({
      //      mongoUrl: appConfigs.databaseUrl,
      client: mongoose.connection.getClient(),
      ttl: 14 * 24 * 60 * 60, //14 days for now
    }).on("error", (error) => {
      console.log("error while starting session with mongodb \n", error);
    }),
    saveUninitialized: false,
    resave: false,
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000, //14 days for now
      secure: appConfigs.environment === "prod",
      httpOnly: true,
    },
  })
);

//trust the first proxy in production, different scenario when not using nginx or other reverse proxy server
if (appConfigs.environment === "prod") {
  app.set("trust proxy", 1);
}
app.use(passport.initialize());
app.use(passport.session());

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
