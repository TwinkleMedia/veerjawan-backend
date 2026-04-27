import express from "express";
import { createOrder, getAllDonations, verifyPayment } from "../controllers/donation.controller.js";

const router = express.Router();

// Create Razorpay order
router.post("/create-order", createOrder);

// Verify payment after success
router.post("/verify-payment", verifyPayment);

router.get("/all",getAllDonations)


export default router;