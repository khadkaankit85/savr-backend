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
import adminRoute from "./routes/admin";
import { appConfigs } from "./configs/appconfigs";
import mongoose from "mongoose";
import passport from "passport";
import path from "node:path";
import { connectToDatabase } from "./utils/mongooseConnect";
import { debug } from "node:console";

dotenv.config();
const app = express();

//well known file for first classs cookie support
app.use(
  "/.well-known",
  express.static(path.join(__dirname, "public/.well-known")),
);

// Enable CORS
app.use(
  cors({
    origin: [appConfigs.frontendUrl, "https://savr.one"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

// console.log("CORS allowed origin:", appConfigs.frontendUrl);

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
      httpOnly: true,
      ...(appConfigs.environment === "prod" && {
        domain: ".savr.one",
        sameSite: "none",
        secure: true,
      }),
      ...(appConfigs.environment !== "prod" && {
        sameSite: "lax",
        secure: false,
      }),
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

//trust the first proxy in production, different scenario when not using nginx or other reverse proxy server
if (appConfigs.environment === "prod") {
  app.set("trust proxy", 1);
}

app.use(express.json());
//app.use(express.static(path.join(__dirname, "public")))

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
//contains the routes mainly used by admins, for example, a route that sends email to every users belong to this route category
app.use("/api/admin", adminRoute);

app.get("/", (_req, res) => {
  res.send("hello world");
});

app.listen(appConfigs.port, () => {
  console.log("app is live on port ", appConfigs.port);
});
