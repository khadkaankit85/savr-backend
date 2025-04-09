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
  ehf: Number,
  saleStartDate: Date,
  saleEndDate: Date,
  customerRating: Number,
  customerRatingCount: Number,
  sku: { type: String },
  name: String,
  isOnSale: Boolean,
  saving: Number,
  priceWithoutEhf: Number,
  priceWithEhf: Number,
  isMarketplace: Boolean,
  isAdvertised: Boolean,
  isOnlineOnly: Boolean,
  regularPrice: Array,
  isClearance: Boolean,
  additionalImages: [String],
  altLangSeoText: String,
  brandName: String,
  bundleProducts: [String],
  grade: String,
  hasFrenchContent: Boolean,
  isMachineTranslated: Boolean,
  isPreorderable: Boolean,
  isSpecialDelivery: Boolean,
  longDescription: String,
  media: mediaSchema,
  url: { unique: true, required: true, type: String },
  priceDateHistory: [{ Number, Date }],
});

const bestBuy_products = model("bestBuy_products", productSchema);

export default bestBuy_products;
