import { Request, Response } from "express";
import User from "../schema/userSchema";

//this file will contain all the controllers related to alert, addding and removing alert basically
const addAlertOnAProduct = async (req: Request, res: Response) => {
  const { alertPrice, productId } = req.body;
  const reqFrom = req.session.user;
  if (!reqFrom) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  try {
    await User.updateOne(
      { _id: reqFrom.id, "bestBuyProducts.product": productId },
      { $set: { "bestBuyProducts.$.wantedPrice": alertPrice } },
    );
    //insert the product into this user
    res.status(200).json({ message: "product added to alert successfully" });
  } catch {
    res.status(501).json({ message: "internal server error" });
  }
};

export { addAlertOnAProduct };
