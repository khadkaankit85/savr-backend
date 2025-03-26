import mongoose from "mongoose";
import { BestBuyProductStoreDetail } from "../types/product";

const { Schema } = mongoose;

const productSchema = new Schema({
  name: { type: String, required: true },

  // Unique product ID given by the store
  storeProductId: { type: String, required: true, unique: true },

  // Store-specific details (can hold details from multiple stores)
  storeDetails: [
    {
      storeName: { type: String, required: true }, // e.g., "BestBuy", "Amazon"
      storeProductId: { type: String, required: true }, // Store's unique ID
      originalPrice: { type: Number, required: true },
      discountedPrice: { type: Number },
      saleStartDate: { type: Date },
      saleEndDate: { type: Date },
      isOnSale: { type: Boolean, default: false },
      isMarketplace: { type: Boolean, default: false },
      isClearance: { type: Boolean, default: false },
      customerRating: { type: Number },
      customerRatingCount: { type: Number },
      additionalImages: [{ type: String }], // Array of image URLs
    },
  ],

  // Historical price details (across all stores)
  priceDetail: [
    {
      date: { type: Date, required: true },
      originalPrice: { type: Number, required: true },
      discountedPrice: { type: Number },
    },
  ],

  // Original product link from the store
  originalLink: { type: String },
});

// Apply the interface to the schema
export interface Product extends mongoose.Document {
  name: string;
  storeProductId: string;
  storeDetails: BestBuyProductStoreDetail[]; // Here we define the storeDetails type
  priceDetail: {
    date: Date;
    originalPrice: number;
    discountedPrice?: number;
  }[];
  originalLink?: string;
}

const ProductModel = mongoose.model<Product>("Product", productSchema);

export default ProductModel;
