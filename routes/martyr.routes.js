import express from "express";
import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import r2 from "../config/r2.js";
import Martyr from "../models/martyr.model.js";

const router = express.Router();

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

// ─────────────────────────────────────────────────────────────
// Convert base64/data URI → Buffer
// ─────────────────────────────────────────────────────────────
const uploadToR2 = async (dataUri, folder, fileName) => {
  if (!dataUri || !dataUri.startsWith("data:")) {
    throw new Error("Invalid file format");
  }

  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid base64 file");
  }

  const mimeType = match[1];
  const base64Data = match[2];

  const buffer = Buffer.from(base64Data, "base64");

  // 1 MB limit
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("FILE_TOO_LARGE");
  }

  const extensionMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
  };

  const extension = extensionMap[mimeType];

  if (!extension) {
    throw new Error("INVALID_FILE_TYPE");
  }

  const key = `${folder}/${fileName}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await r2.send(command);

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  return {
    url: publicUrl,
    publicId: key,
  };
};

// ─────────────────────────────────────────────────────────────
// Delete file from R2
// ─────────────────────────────────────────────────────────────
const deleteFromR2 = async (publicId) => {
  if (!publicId) return;

  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: publicId,
  });

  await r2.send(command);
};

// ─────────────────────────────────────────────────────────────
// GET All Martyrs
// Search + Pagination
// ─────────────────────────────────────────────────────────────
router.get("/martyrs", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);

    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();

    const filter = search
      ? {
          $or: [
            {
              fullName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              unit: {
                $regex: search,
                $options: "i",
              },
            },
            {
              district: {
                $regex: search,
                $options: "i",
              },
            },
            {
              village: {
                $regex: search,
                $options: "i",
              },
            },
            {
              placeOfMartyrdom: {
                $regex: search,
                $options: "i",
              },
            },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      Martyr.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Martyr.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Get Martyrs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// GET Single Martyr
// ─────────────────────────────────────────────────────────────
router.get("/martyrs/:id", async (req, res) => {
  try {
    const martyr = await Martyr.findById(req.params.id).lean();

    if (!martyr) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    return res.json({
      success: true,
      data: martyr,
    });
  } catch (error) {
    console.error("Get Martyr Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// CREATE Martyr
// ─────────────────────────────────────────────────────────────
router.post("/martyrs", async (req, res) => {
  try {
    const {
      photo,
      certificate,
      ...formData
    } = req.body;

    // Photo required
    if (!photo) {
      return res.status(400).json({
        success: false,
        message: "Photo is required",
      });
    }

    // ─────────────────────────────────────────────
    // Upload Photo to R2
    // ─────────────────────────────────────────────
    let photoUpload;

    try {
      photoUpload = await uploadToR2(
        photo,
        "martyrs/photos",
        `photo_${Date.now()}`
      );
    } catch (error) {
      if (error.message === "FILE_TOO_LARGE") {
        return res.status(400).json({
          success: false,
          message: "Photo must be less than 1 MB",
        });
      }

      if (error.message === "INVALID_FILE_TYPE") {
        return res.status(400).json({
          success: false,
          message: "Only JPG, PNG, WEBP, GIF or PDF files are allowed",
        });
      }

      throw error;
    }

    // ─────────────────────────────────────────────
    // Upload Certificate to R2 if provided
    // ─────────────────────────────────────────────
    let certUpload = null;

    if (certificate) {
      try {
        certUpload = await uploadToR2(
          certificate,
          "martyrs/certificates",
          `certificate_${Date.now()}`
        );
      } catch (error) {
        // Delete already uploaded photo
        await deleteFromR2(photoUpload.publicId).catch(() => {});

        if (error.message === "FILE_TOO_LARGE") {
          return res.status(400).json({
            success: false,
            message: "Certificate must be less than 1 MB",
          });
        }

        if (error.message === "INVALID_FILE_TYPE") {
          return res.status(400).json({
            success: false,
            message: "Invalid certificate file type",
          });
        }

        throw error;
      }
    }

    // ─────────────────────────────────────────────
    // Save normal form data + R2 URLs in MongoDB
    // ─────────────────────────────────────────────
    const martyr = await Martyr.create({
      ...formData,

      photo: photoUpload,

      certificate: certUpload,
    });

    return res.status(201).json({
      success: true,
      message: "Martyr saved successfully",
      data: martyr,
    });
  } catch (error) {
    console.error("Create Martyr Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// UPDATE Martyr
// ─────────────────────────────────────────────────────────────
router.put("/martyrs/:id", async (req, res) => {
  try {
    const {
      photo,
      certificate,
      ...formData
    } = req.body;

    const existing = await Martyr.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    // ─────────────────────────────────────────────
    // NEW PHOTO
    // ─────────────────────────────────────────────
    if (photo && photo.startsWith("data:")) {
      let newPhoto;

      try {
        newPhoto = await uploadToR2(
          photo,
          "martyrs/photos",
          `photo_${Date.now()}`
        );
      } catch (error) {
        if (error.message === "FILE_TOO_LARGE") {
          return res.status(400).json({
            success: false,
            message: "Photo must be less than 1 MB",
          });
        }

        if (error.message === "INVALID_FILE_TYPE") {
          return res.status(400).json({
            success: false,
            message: "Invalid photo file type",
          });
        }

        throw error;
      }

      // Delete old photo AFTER new upload succeeds
      if (existing.photo?.publicId) {
        await deleteFromR2(existing.photo.publicId).catch((error) => {
          console.warn(
            "Old photo deletion failed:",
            error.message
          );
        });
      }

      formData.photo = newPhoto;
    }

    // ─────────────────────────────────────────────
    // NEW CERTIFICATE
    // ─────────────────────────────────────────────
    if (certificate && certificate.startsWith("data:")) {
      let newCertificate;

      try {
        newCertificate = await uploadToR2(
          certificate,
          "martyrs/certificates",
          `certificate_${Date.now()}`
        );
      } catch (error) {
        if (error.message === "FILE_TOO_LARGE") {
          return res.status(400).json({
            success: false,
            message: "Certificate must be less than 1 MB",
          });
        }

        if (error.message === "INVALID_FILE_TYPE") {
          return res.status(400).json({
            success: false,
            message: "Invalid certificate file type",
          });
        }

        throw error;
      }

      // Delete old certificate AFTER new upload succeeds
      if (existing.certificate?.publicId) {
        await deleteFromR2(existing.certificate.publicId).catch(
          (error) => {
            console.warn(
              "Old certificate deletion failed:",
              error.message
            );
          }
        );
      }

      formData.certificate = newCertificate;
    }

    // ─────────────────────────────────────────────
    // Update MongoDB
    // ─────────────────────────────────────────────
    const updated = await Martyr.findByIdAndUpdate(
      req.params.id,
      {
        $set: formData,
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    return res.json({
      success: true,
      message: "Martyr updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update Martyr Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE Martyr
// ─────────────────────────────────────────────────────────────
router.delete("/martyrs/:id", async (req, res) => {
  try {
    const martyr = await Martyr.findById(req.params.id);

    if (!martyr) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    // Delete photo from R2
    if (martyr.photo?.publicId) {
      await deleteFromR2(martyr.photo.publicId).catch((error) => {
        console.warn(
          "Photo deletion from R2 failed:",
          error.message
        );
      });
    }

    // Delete certificate from R2
    if (martyr.certificate?.publicId) {
      await deleteFromR2(martyr.certificate.publicId).catch(
        (error) => {
          console.warn(
            "Certificate deletion from R2 failed:",
            error.message
          );
        }
      );
    }

    // Delete MongoDB document
    await martyr.deleteOne();

    return res.json({
      success: true,
      message: "Martyr deleted successfully",
    });
  } catch (error) {
    console.error("Delete Martyr Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

export default router;