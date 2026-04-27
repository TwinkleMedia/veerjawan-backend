import express from "express";
import Martyr from "../models/martyr.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";

const router = express.Router();

// ── GET All Martyrs (with search + pagination) ────────────────────────────────
router.get("/martyrs", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const search = req.query.search?.trim();
    const filter = search
      ? {
          $or: [
            { fullName:       { $regex: search, $options: "i" } },
            { unit:           { $regex: search, $options: "i" } },
            { district:       { $regex: search, $options: "i" } },
            { village:        { $regex: search, $options: "i" } },
            { placeOfMartyrdom: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      Martyr.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Martyr.countDocuments(filter),
    ]);

    res.json({ success: true, data, total, page, limit });
  } catch (error) {
    console.error("Get Martyrs Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ── GET Single Martyr ─────────────────────────────────────────────────────────
router.get("/martyrs/:id", async (req, res) => {
  try {
    const martyr = await Martyr.findById(req.params.id).lean();
    if (!martyr) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: martyr });
  } catch (error) {
    console.error("Get Martyr Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ── CREATE Martyr ─────────────────────────────────────────────────────────────
router.post("/martyrs", async (req, res) => {
  try {
    const { photo, certificate, ...formData } = req.body;

    if (!photo) {
      return res.status(400).json({ message: "Photo is required" });
    }

    const photoUpload = await uploadToCloudinary(photo, "martyrs/photos", `photo_${Date.now()}`);

    let certUpload = null;
    if (certificate) {
      certUpload = await uploadToCloudinary(certificate, "martyrs/certificates", `certificate_${Date.now()}`);
    }

    const martyr = await Martyr.create({
      ...formData,
      photo:       photoUpload,
      certificate: certUpload,
    });

    res.status(201).json({ success: true, message: "Martyr saved successfully", data: martyr });
  } catch (error) {
    console.error("Create Martyr Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ── UPDATE Martyr ─────────────────────────────────────────────────────────────
router.put("/martyrs/:id", async (req, res) => {
  try {
    const { photo, certificate, ...formData } = req.body;

    const existing = await Martyr.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    // If a new photo (base64) is provided, upload and replace
    if (photo && photo.startsWith("data:")) {
      // Optionally delete old photo from Cloudinary
      if (existing.photo?.publicId) {
        await deleteFromCloudinary(existing.photo.publicId).catch(() => {});
      }
      formData.photo = await uploadToCloudinary(photo, "martyrs/photos", `photo_${Date.now()}`);
    }

    // If a new certificate (base64) is provided, upload and replace
    if (certificate && certificate.startsWith("data:")) {
      if (existing.certificate?.publicId) {
        await deleteFromCloudinary(existing.certificate.publicId).catch(() => {});
      }
      formData.certificate = await uploadToCloudinary(certificate, "martyrs/certificates", `certificate_${Date.now()}`);
    }

    const updated = await Martyr.findByIdAndUpdate(
      req.params.id,
      { $set: formData },
      { new: true, runValidators: true }
    ).lean();

    res.json({ success: true, message: "Martyr updated successfully", data: updated });
  } catch (error) {
    console.error("Update Martyr Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ── DELETE Martyr ─────────────────────────────────────────────────────────────
router.delete("/martyrs/:id", async (req, res) => {
  try {
    const martyr = await Martyr.findById(req.params.id);
    if (!martyr) return res.status(404).json({ success: false, message: "Not found" });

    // Delete Cloudinary assets
    if (martyr.photo?.publicId) {
      await deleteFromCloudinary(martyr.photo.publicId).catch(() => {});
    }
    if (martyr.certificate?.publicId) {
      await deleteFromCloudinary(martyr.certificate.publicId).catch(() => {});
    }

    await martyr.deleteOne();

    res.json({ success: true, message: "Martyr deleted successfully" });
  } catch (error) {
    console.error("Delete Martyr Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default router;