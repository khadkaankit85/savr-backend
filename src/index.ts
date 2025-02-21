import express from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

//routes
import productRoute from "./routes/products";
import scrapeRoute from "./routes/scrape";
import { connectToDatabase } from "./utils/mongooseConnect";
import { appConfigs } from "./configs/appconfigs";

const app = express();
const swaggerDocument = YAML.load("./swagger.yaml");

connectToDatabase();

// Enable CORS
app.use(cors());

//for docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/products", productRoute);
app.use("/api/scrape", scrapeRoute);

app.get("/", (_req, res) => {
  res.send("hello world");
});

app.listen(appConfigs.port, () => {
  console.log("app is live on port ", appConfigs.port);
});
