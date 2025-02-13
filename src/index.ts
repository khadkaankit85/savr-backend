import express from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

//routes
import productRoute from "./routes/products";

const app = express();
const port = process.env.PORT || 3000;
const swaggerDocument = YAML.load("./swagger.yaml");

//for docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/product", productRoute);

app.get("/", (_req, res) => {
  res.send("hello world");
});

app.listen(port, () => {
  console.log("app is live on port ", port);
});
