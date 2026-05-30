import express from "express";
import { createOrder, getAllDonations, verifyPayment } from "../controllers/donation.controller.js";

const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.get("/all", getAllDonations);

export default router;