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
  // ehf: Number,
  // saleStartDate: Date,
  // saleEndDate: Date,
  sku: { type: String },
  name: String,
  isOnSale: Boolean,
  customerRating: Number,
  customerRatingCount: Number,
  // saving: Number,
  // priceWithoutEhf: Number,
  // priceWithEhf: Number,
  // isMarketplace: Boolean,
  // isAdvertised: Boolean,
  // isOnlineOnly: Boolean,
  regularPrice: Number,
  salePrice: Number,
  // isClearance: Boolean,
  images: [String],
  // altLangSeoText: String,
  brandName: String,
  // bundleProducts: [String],
  // grade: String,
  // hasFrenchContent: Boolean,
  // isMachineTranslated: Boolean,
  // isPreorderable: Boolean,
  // isSpecialDelivery: Boolean,
  longDescription: String,
  // media: mediaSchema,
  url: { unique: true, required: true, type: String },
  priceDateHistory: [{ Number, Date }],
});

const products = model("products", productSchema);

export default products;
