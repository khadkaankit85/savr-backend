export interface BestBuyProductScraped {
  storeName: "BestBuy"; // Identifier for BestBuy
  storeProductId: string;
  sku: string;
  name: string;
  priceWithoutEhf: number;
  priceWithEhf: number;
  regularPrice: number;
  isOnSale: boolean;
  isMarketplace: boolean;
  isClearance: boolean;
  additionalImages?: string[]; // Optional as some products may not have images
  brandName?: string;
  customerRating?: number;
  customerRatingCount?: number;
  saving?: number;
  saleStartDate?: string; // Optional in case the product isn't on sale
  saleEndDate?: string;
  isAdvertised?: boolean;
  isOnlineOnly?: boolean;
  altLangSeoText?: string;
  bundleProducts?: any[]; // Optional as many products don’t have bundled items
  grade?: string;
  hasFrenchContent?: boolean;
  isMachineTranslated?: boolean;
  isPreorderable?: boolean;
  isSpecialDelivery?: boolean;
  longDescription?: string; // Optional in case a product doesn't have a long description
  ehf?: number; // Optional as not all products have environmental handling fees
}

export interface BestBuyProductStoreDetail {
  storeName: "BestBuy"; // Store name is static for BestBuy
  storeProductId: string; // Unique product ID for BestBuy
  originalPrice: number; // Original price of the product
  discountedPrice?: number; // Discounted price (optional if no discount is available)
  saleStartDate?: Date; // Start date of the sale (optional)
  saleEndDate?: Date; // End date of the sale (optional)
  isOnSale: boolean; // Indicates whether the product is on sale
  isMarketplace: boolean; // Whether the product is from the marketplace or not
  isClearance: boolean; // Whether the product is on clearance
  customerRating?: number; // Average customer rating
  customerRatingCount?: number; // Total number of customer ratings
  additionalImages: string[]; // Array of image URLs related to the product
}

export interface Product {
  name: string;
  storeProductId: string;
  storeDetails: BestBuyProductStoreDetail[]; // Union of multiple store-specific types
  priceDetail: {
    date: string; // ISO Date
    originalPrice: number;
    discountedPrice?: number;
  }[];
  originalLink?: string;
}
