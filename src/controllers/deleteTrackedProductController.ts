import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../schema/userSchema";

interface DeleteTrackedProductRequest extends Request {
  body: {
    userId: string;
    productId: string;
  };
}

export const deleteTrackedProduct = async (
  req: DeleteTrackedProductRequest,
  res: Response,
) => {
  const { userId, productId } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      res.status(403).json({ message: "User not found" });
      return;
    }

    // Filter out the product and reassign the array
    user.bestBuyProducts.pull({ product: productId });

    // Save the updated user document
    await user.save();
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
