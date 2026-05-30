import express from "express";
import { createOrder, getAllDonations,deleteDonation, verifyPayment } from "../controllers/donation.controller.js";

const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.get("/all", getAllDonations);
router.delete("/:id", deleteDonation);

export default router;