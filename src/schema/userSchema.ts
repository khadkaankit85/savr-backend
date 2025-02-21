import mongoose from "mongoose";
const {Schema}=mongoose;
const userSchema=new Schema({
    name:String,
    password:String,
    email:String,


})
export default mongoose.model("UserDetails",userSchema)