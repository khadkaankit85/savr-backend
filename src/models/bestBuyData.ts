import mongoose from "mongoose";
const { Schema, model } = mongoose;

// TODO rename this script to productData.ts instead of bestBuy since I made it universal.

const imageSchema = new Schema({
  mimeType: String,
  size: {
    width: Number,
    height: Number,
  },
});

const mediaSchema = new Schema({
  images: {
    "0": {
      "400x400": imageSchema,
    },
  },
});

const productSchema = new Schema({
  sku: { type: String },
  name: String,
  isOnSale: Boolean,
  customerRating: Number,
  customerRatingCount: Number,
  regularPrice: Number,
  salePrice: Number,
  images: [String],
  brandName: String,
  longDescription: String,
  url: { unique: true, required: true, type: String },
  priceDateHistory: [{ Number, Date }],
});

const products = model("products", productSchema);

export default products;
