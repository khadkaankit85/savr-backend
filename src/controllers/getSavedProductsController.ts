import { Request, Response } from "express";
import bestBuy_products from "../models/bestBuyData";
import User from "../schema/userSchema";

export const getSavedProducts = async(req: Request, res: Response)=>{
    try{
        const userSession = req.session.user?.id
        const user = await User.findById(userSession)

        if (!user){
            res.status(404).json({message: "User not found"})
            return;
        }


        const productDetails = await bestBuy_products.find({
            _id: {$in: user.bestBuyProducts}
        });

        res.status(200).json({ products: productDetails})
    } catch (error){
        res.status(500).json({message: "Error fetching data"})
    }
}