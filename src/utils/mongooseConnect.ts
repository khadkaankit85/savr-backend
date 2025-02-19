import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectToDatabase = async () => {
    if (mongoose.connection.readyState === 0) {
        try {
            await mongoose.connect(`mongodb+srv://mattazz:${process.env.MONGODB_PASSWORD}@testing.h0pbt.mongodb.net/savr?retryWrites=true&w=majority&appName=Testing`, {
            });
            console.log('Connected to database');
        } catch (error) {
            console.error('Error connecting to database:', error);
            throw error;
        }
    }
};

const closeDatabaseConnection = async () => {
    if (mongoose.connection.readyState !== 0) {
        try {
            await mongoose.connection.close();
            console.log('Disconnected from database');
        } catch (error) {
            console.error('Error disconnecting from database:', error);
            throw error;
        }
    }
};

export  { connectToDatabase, closeDatabaseConnection }