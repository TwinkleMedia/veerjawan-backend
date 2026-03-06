import express from "express";
import {
  createBanner,
  getBanners,
  deleteBanner
} from "../controllers/bannerController.js";

const router = express.Router();

router.post("/", createBanner);

router.get("/", getBanners);

router.delete("/:id", deleteBanner);

export default router;