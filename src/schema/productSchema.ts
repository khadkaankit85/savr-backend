import mongoose from "mongoose";
const { Schema } = mongoose;
const productSchema = new Schema({
  name: String,
});
export default mongoose.model("productDetails", productSchema);
