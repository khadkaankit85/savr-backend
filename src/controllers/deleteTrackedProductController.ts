import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from "../schema/userSchema";

interface DeleteTrackedProductRequest extends Request {
    body: {
        userId: string;
        productId: string;
    };
}

export const deleteTrackedProduct = async (req: DeleteTrackedProductRequest, res: Response) => {
    const { userId, productId } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.bestBuyProducts = user.bestBuyProducts.filter(
            (id: mongoose.Types.ObjectId) => id.toString() !== productId
        );

        await user.save();
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};