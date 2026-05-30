import express from "express";
import { createOrder, getAllDonations, verifyPayment, deleteDonation } from "../controllers/donation.controller.js";

const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.get("/all", getAllDonations);
router.post("/delete/:id", deleteDonation);  // ← POST instead of DELETE

export default router;