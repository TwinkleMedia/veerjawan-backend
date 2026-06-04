import express from "express";
import { generateReceipt } from "../controllers/receipt.controller.js";

const router = express.Router();

router.get("/donation/receipt/:id", generateReceipt);

export default router;