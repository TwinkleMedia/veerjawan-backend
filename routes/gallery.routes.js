import express from "express";
import { uploadToCloudinary } from "../config/cloudinary.js";
import Gallery from "../models/Gallery.model.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

const toSlug = (str) =>
  str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const makePublicId = (fileName) => {
  const base = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, "_");
  return `${base}_${Date.now()}`;
};

// ── POST /api/gallery/upload ────────────────────────────────────────────────
router.post("/upload", async (req, res) => {
  try {
    const { title, images = [], videos = [] } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required." });
    }

    if (images.length === 0 && videos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image or video is required.",
      });
    }

    const slug = toSlug(title);
    const mediaItems = [];

    for (const img of images) {
      const folder = `galleries/${slug}/images`;
      const publicId = makePublicId(img.name);

      const { url, publicId: cloudPublicId } = await uploadToCloudinary(
        img.data,
        folder,
        publicId,
        "image"
      );

      mediaItems.push({
        url,
        publicId: cloudPublicId,
        type: "image",
        fileName: img.name,
        size: img.size,
      });
    }

    for (const vid of videos) {
      const folder = `galleries/${slug}/videos`;
      const publicId = makePublicId(vid.name);

      const { url, publicId: cloudPublicId } = await uploadToCloudinary(
        vid.data,
        folder,
        publicId,
        "video"
      );

      mediaItems.push({
        url,
        publicId: cloudPublicId,
        type: "video",
        fileName: vid.name,
        size: vid.size,
      });
    }

    const gallery = await Gallery.create({ title: title.trim(), media: mediaItems });

    return res.status(201).json({
      success: true,
      message: "Gallery uploaded successfully.",
      gallery,
    });
  } catch (err) {
    console.error("Gallery upload error:", err);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
});

// ── GET /api/gallery ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const galleries = await Gallery.find().sort({ createdAt: -1 });
    return res.json({ success: true, galleries });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ── DELETE /api/gallery/:id ─────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const gallery = await Gallery.findById(req.params.id);
    if (!gallery) {
      return res.status(404).json({ success: false, message: "Gallery not found." });
    }

    for (const item of gallery.media) {
      await cloudinary.uploader.destroy(item.publicId, {
        resource_type: item.type === "video" ? "video" : "image",
      });
    }

    await gallery.deleteOne();
    return res.json({ success: true, message: "Gallery deleted." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ── PATCH /api/gallery/:id ──────────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const gallery = await Gallery.findById(req.params.id);
    if (!gallery) {
      return res.status(404).json({ success: false, message: "Gallery not found." });
    }

    const { title, deleteMediaIds = [] } = req.body;

    if (title?.trim()) {
      gallery.title = title.trim();
    }

    if (deleteMediaIds.length > 0) {
      const toRemove = gallery.media.filter((m) => deleteMediaIds.includes(m.publicId));

      for (const item of toRemove) {
        await cloudinary.uploader.destroy(item.publicId, {
          resource_type: item.type === "video" ? "video" : "image",
        });
      }

      gallery.media = gallery.media.filter((m) => !deleteMediaIds.includes(m.publicId));
    }

    await gallery.save();

    return res.json({
      success: true,
      message: "Gallery updated.",
      gallery,
    });
  } catch (err) {
    console.error("Gallery update error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;