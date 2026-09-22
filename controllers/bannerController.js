import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

import r2 from "../config/r2.js";
import Banner from "../models/Banner.js";

// ==========================================
// CREATE BANNER
// Saves R2 image URL + file key in MongoDB
// ==========================================
export const createBanner = async (req, res) => {
  try {
    const { imageUrl, fileKey } = req.body;

    // Validate required fields
    if (!imageUrl || !fileKey) {
      return res.status(400).json({
        error: "Image URL or fileKey missing",
      });
    }

    // Save banner information in MongoDB
    const banner = await Banner.create({
      imageUrl,
      fileKey,
    });

    return res.status(201).json({
      success: true,
      banner,
    });
  } catch (error) {
    console.error("Create banner error:", error);

    return res.status(500).json({
      error: "Failed to save banner",
    });
  }
};

// ==========================================
// GET ALL BANNERS
// ==========================================
export const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({
      createdAt: -1,
    });

    return res.json(banners);
  } catch (error) {
    console.error("Get banners error:", error);

    return res.status(500).json({
      error: "Failed to fetch banners",
    });
  }
};

// ==========================================
// DELETE BANNER
// Deletes image from R2 + record from MongoDB
// ==========================================
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    // Find banner in MongoDB
    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        error: "Banner not found",
      });
    }

    // Make sure fileKey exists
    if (!banner.fileKey) {
      return res.status(400).json({
        error: "Banner fileKey is missing",
      });
    }

    // Delete image from Cloudflare R2
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: banner.fileKey,
    });

    await r2.send(deleteCommand);

    // Delete banner record from MongoDB
    await Banner.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("Delete banner error:", error);

    return res.status(500).json({
      error: "Delete failed",
    });
  }
};

// ==========================================
// GENERATE R2 PRESIGNED UPLOAD URL
// ==========================================
export const getUploadUrl = async (req, res) => {
  try {
    const {
      fileName,
      contentType,
      fileSize,
    } = req.body;

    // --------------------------------------
    // Validate required fields
    // --------------------------------------
    if (!fileName || !contentType) {
      return res.status(400).json({
        error: "fileName and contentType are required",
      });
    }

    // --------------------------------------
    // Validate file size
    // --------------------------------------
    const MAX_FILE_SIZE = 1 * 1024 * 1024;

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: "Image size must be 1 MB or less",
      });
    }

    // --------------------------------------
    // Allowed image types
    // --------------------------------------
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

    // --------------------------------------
    // Get file extension
    // --------------------------------------
    const extension =
      fileName.split(".").pop()?.toLowerCase() || "jpg";

    // --------------------------------------
    // Generate unique R2 object key
    // --------------------------------------
    const fileKey = `banners/${randomUUID()}.${extension}`;

    // --------------------------------------
    // Create R2 upload command
    // --------------------------------------
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
    });

    // --------------------------------------
    // Generate presigned URL
    // --------------------------------------
    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 300,
    });

    // --------------------------------------
    // Return upload URL + file key
    // --------------------------------------
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