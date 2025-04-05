import mongoose from "mongoose";
const { Schema, model } = mongoose;

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
  sku: { unique: true, required: true, type: String },
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
