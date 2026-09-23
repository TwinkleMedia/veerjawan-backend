import express from "express";

import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { randomUUID } from "crypto";

import r2 from "../config/r2.js";

import Gallery from "../models/Gallery.model.js";

const router = express.Router();


// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const toSlug = (str) =>
  str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");


const getExtension = (fileName) => {
  return fileName.split(".").pop().toLowerCase();
};


const getPublicUrl = (fileKey) => {
  const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("R2_PUBLIC_URL is not configured");
  }

  return `${baseUrl}/${fileKey}`;
};


// ─────────────────────────────────────────────────────────────
// POST /api/gallery/upload-url
//
// Generates a signed R2 upload URL for gallery images
// ─────────────────────────────────────────────────────────────

router.post("/upload-url", async (req, res) => {
  try {
    const { fileName, contentType, title } = req.body;

    if (!fileName || !contentType || !title) {
      return res.status(400).json({
        success: false,
        message: "fileName, contentType and title are required.",
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
        success: false,
        message: "Only JPG, PNG, WEBP and GIF images are allowed.",
      });
    }

    const slug = toSlug(title);

    const extension = getExtension(fileName);

    const fileKey = `galleries/${slug}/images/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 300,
    });

    const publicUrl = getPublicUrl(fileKey);

    return res.json({
      success: true,
      uploadUrl,
      fileKey,
      publicUrl,
    });
  } catch (error) {
    console.error("Gallery R2 upload URL error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate upload URL.",
    });
  }
});


// ─────────────────────────────────────────────────────────────
// POST /api/gallery/upload
//
// Saves gallery information after images have already
// been uploaded directly to R2
// ─────────────────────────────────────────────────────────────

router.post("/upload", async (req, res) => {
  try {
    console.log("Gallery upload body:", {
      title: req.body.title,
      imageCount: req.body.images?.length,
      videoLinks: req.body.videoLinks,
    });

    const {
      title,
      images = [],
      videoLinks = [],
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required.",
      });
    }

    if (images.length === 0 && videoLinks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image or video link is required.",
      });
    }

    const mediaItems = [];

    // ─────────────────────────────────────────────
    // R2 Images
    // ─────────────────────────────────────────────

    for (const img of images) {
      if (!img.fileKey || !img.url) {
        return res.status(400).json({
          success: false,
          message: "Invalid image data.",
        });
      }

      mediaItems.push({
        url: img.url,

        // Store R2 object key
        publicId: img.fileKey,

        type: "image",

        fileName: img.name || "",

        size: img.size || 0,

        isLink: false,
      });
    }


    // ─────────────────────────────────────────────
    // Video Links
    // ─────────────────────────────────────────────

    for (const link of videoLinks) {
      if (!link?.trim()) {
        continue;
      }

      mediaItems.push({
        url: link.trim(),

        // For external videos publicId = URL
        publicId: link.trim(),

        type: "video",

        fileName: link.trim(),

        size: 0,

        isLink: true,
      });
    }


    // ─────────────────────────────────────────────
    // Save Gallery
    // ─────────────────────────────────────────────

    const gallery = await Gallery.create({
      title: title.trim(),
      media: mediaItems,
    });

    return res.status(201).json({
      success: true,
      message: "Gallery uploaded successfully.",
      gallery,
    });

  } catch (error) {
    console.error("Gallery upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
});


// ─────────────────────────────────────────────────────────────
// GET /api/gallery
// ─────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const galleries = await Gallery.find()
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      galleries,
    });

  } catch (error) {
    console.error("Get galleries error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});


// ─────────────────────────────────────────────────────────────
// DELETE /api/gallery/:id
//
// Deletes MongoDB gallery + R2 images
// ─────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  try {
    const gallery = await Gallery.findById(req.params.id);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Gallery not found.",
      });
    }


    // Delete images from R2
    for (const item of gallery.media) {
      if (!item.isLink && item.type === "image") {

        try {
          const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: item.publicId,
          });

          await r2.send(command);

          console.log(
            "Deleted R2 image:",
            item.publicId
          );

        } catch (r2Error) {
          console.error(
            "R2 delete error:",
            item.publicId,
            r2Error
          );
        }
      }
    }


    // Delete gallery from MongoDB
    await gallery.deleteOne();

    return res.json({
      success: true,
      message: "Gallery deleted successfully.",
    });

  } catch (error) {
    console.error("Gallery delete error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});


// ─────────────────────────────────────────────────────────────
// PATCH /api/gallery/:id
//
// Update title
// Delete existing images/videos
// Add new video links
// Add new R2 images
// ─────────────────────────────────────────────────────────────

router.patch("/:id", async (req, res) => {
  try {

    console.log("Gallery patch body:", {
      title: req.body.title,
      deleteMediaIds: req.body.deleteMediaIds,
      addImages: req.body.addImages,
      addVideoLinks: req.body.addVideoLinks,
    });


    const gallery = await Gallery.findById(req.params.id);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Gallery not found.",
      });
    }


    const {
      title,
      deleteMediaIds = [],
      addImages = [],
      addVideoLinks = [],
    } = req.body;


    // ─────────────────────────────────────────────
    // Update title
    // ─────────────────────────────────────────────

    if (title?.trim()) {
      gallery.title = title.trim();
    }


    // ─────────────────────────────────────────────
    // Delete media
    // ─────────────────────────────────────────────

    if (deleteMediaIds.length > 0) {

      const toRemove = gallery.media.filter((media) =>
        deleteMediaIds.includes(media.publicId)
      );


      // Delete R2 images
      for (const item of toRemove) {

        if (!item.isLink && item.type === "image") {

          try {

            const command = new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: item.publicId,
            });

            await r2.send(command);

            console.log(
              "Deleted R2 image:",
              item.publicId
            );

          } catch (r2Error) {

            console.error(
              "R2 delete error:",
              item.publicId,
              r2Error
            );
          }
        }
      }


      // Remove from MongoDB
      gallery.media = gallery.media.filter(
        (media) => !deleteMediaIds.includes(media.publicId)
      );
    }


    // ─────────────────────────────────────────────
    // Add new R2 images
    // ─────────────────────────────────────────────

    if (addImages.length > 0) {

      for (const img of addImages) {

        if (!img.fileKey || !img.url) {
          continue;
        }

        gallery.media.push({
          url: img.url,

          publicId: img.fileKey,

          type: "image",

          fileName: img.name || "",

          size: img.size || 0,

          isLink: false,
        });
      }
    }


    // ─────────────────────────────────────────────
    // Add video links
    // ─────────────────────────────────────────────

    if (addVideoLinks.length > 0) {

      for (const link of addVideoLinks) {

        if (!link?.trim()) {
          continue;
        }

        gallery.media.push({
          url: link.trim(),

          publicId: link.trim(),

          type: "video",

          fileName: link.trim(),

          size: 0,

          isLink: true,
        });
      }
    }


    await gallery.save();

    console.log("Gallery updated:", gallery._id);

    return res.json({
      success: true,
      message: "Gallery updated successfully.",
      gallery,
    });

  } catch (error) {

    console.error("Gallery update error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});


export default router;