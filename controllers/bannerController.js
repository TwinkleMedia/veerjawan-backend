
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import r2 from "../config/r2.js";
import Banner from "../models/Banner.js";
// import cloudinary from "../config/cloudinary.js"; // ✅ import the default export

export const createBanner = async (req, res) => {
  try {
    const { imageUrl, public_id } = req.body;

    if (!imageUrl || !public_id) {
      return res.status(400).json({ error: "Image URL or public_id missing" });
    }

    const banner = await Banner.create({ imageUrl, public_id });
    res.json({ success: true, banner });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save banner" });
  }
};

export const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch banners" });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ error: "Banner not found" });
    }

    // ✅ Now cloudinary is properly available
    await cloudinary.uploader.destroy(banner.public_id);

    await Banner.findByIdAndDelete(id);

    res.json({ success: true, message: "Banner deleted successfully" });

  } catch (error) {
    console.error(error); // ✅ now you'll see the real error in terminal
    res.status(500).json({ error: "Delete failed" });
  }
};


export const getUploadUrl = async (req, res) => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({
        error: "fileName and contentType are required",
      });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({
        error: "Only JPG, PNG, WEBP and GIF images are allowed",
      });
    }

    const extension = fileName.split(".").pop().toLowerCase();

    const fileKey = `banners/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 300,
    });

    return res.json({
      success: true,
      uploadUrl,
      fileKey,
    });
  } catch (error) {
    console.error("R2 upload URL error:", error);

    return res.status(500).json({
      error: "Failed to generate upload URL",
    });
  }
};