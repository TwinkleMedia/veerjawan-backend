import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

const connectDB = async () => {
  console.log("MONGO_URI:", process.env.MONGO_URI); // ← add this line
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`DB connection error ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;