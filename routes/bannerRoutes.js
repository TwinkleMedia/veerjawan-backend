import express from "express";
import {
  createBanner,
  getBanners,
  deleteBanner,
  getUploadUrl,
} from "../controllers/bannerController.js";

const router = express.Router();

router.post("/upload-url", getUploadUrl);
router.post("/", createBanner);
router.get("/", getBanners);
router.delete("/:id", deleteBanner);

export default router;