import Event from "../models/Event.model.js";

import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { randomUUID } from "crypto";

import r2 from "../config/r2.js";

// ─────────────────────────────────────────────────────────────
// R2 PUBLIC URL
// ─────────────────────────────────────────────────────────────

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// ─────────────────────────────────────────────────────────────
// ALLOWED IMAGE TYPES
// ─────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Maximum image size: 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;


// ─────────────────────────────────────────────────────────────
// POST /api/events/upload-url
//
// Generate a presigned URL for direct R2 upload
// ─────────────────────────────────────────────────────────────

const getEventUploadUrl = async (req, res) => {
  try {
    const {
      fileName,
      contentType,
      fileSize,
    } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({
        success: false,
        message: "fileName and contentType are required.",
      });
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
      return res.status(400).json({
        success: false,
        message:
          "Only JPG, PNG, WEBP and GIF images are allowed.",
      });
    }

    // Validate file size
    if (fileSize && Number(fileSize) > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Event image must be less than 5 MB.",
      });
    }

    // Get extension
    const extension =
      fileName.split(".").pop()?.toLowerCase() || "jpg";

    // Create unique R2 file key
    const fileKey = `events/${randomUUID()}.${extension}`;

    // Create R2 upload command
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
    });

    // Generate presigned URL
    const uploadUrl = await getSignedUrl(
      r2,
      command,
      {
        expiresIn: 300,
      }
    );

    // Public image URL
    const imageUrl =
      `${R2_PUBLIC_URL}/${fileKey}`;

    return res.status(200).json({
      success: true,
      uploadUrl,
      fileKey,
      imageUrl,
    });

  } catch (error) {
    console.error(
      "getEventUploadUrl error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate upload URL.",
    });
  }
};


// ─────────────────────────────────────────────────────────────
// POST /api/events
//
// Create event after image has been uploaded to R2
// ─────────────────────────────────────────────────────────────

const createEvent = async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      address,
      description = "",
      bookingLink = "",
      image,
    } = req.body;

    // Validate required fields
    const missing = [
      "title",
      "date",
      "time",
      "address",
    ].filter(
      (field) =>
        !req.body[field] ||
        String(req.body[field]).trim() === ""
    );

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // Validate image
    if (
      !image ||
      !image.url ||
      !image.publicId
    ) {
      return res.status(400).json({
        success: false,
        message: "Event image is required.",
      });
    }

    // Create event
    const event = await Event.create({
      title: title.trim(),
      date,
      time,
      address: address.trim(),
      description: description?.trim() || "",
      bookingLink: bookingLink?.trim() || "",
      image: {
        url: image.url,
        publicId: image.publicId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully.",
      data: event,
    });

  } catch (error) {
    console.error(
      "createEvent error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


// ─────────────────────────────────────────────────────────────
// GET /api/events
// ─────────────────────────────────────────────────────────────

const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .sort({ createdAt: -1 })
      .select("-__v");

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });

  } catch (error) {
    console.error(
      "getAllEvents error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


// ─────────────────────────────────────────────────────────────
// GET /api/events/:id
// ─────────────────────────────────────────────────────────────

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(
      req.params.id
    ).select("-__v");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: event,
    });

  } catch (error) {
    console.error(
      "getEventById error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


// ─────────────────────────────────────────────────────────────
// PUT /api/events/:id
//
// Update event.
// Image is optional.
//
// If image is supplied:
// Frontend uploads image to R2 first,
// then sends image.url + image.publicId here.
// ─────────────────────────────────────────────────────────────

const updateEvent = async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      address,
      description,
      bookingLink,
      image,
    } = req.body;

    const event = await Event.findById(
      req.params.id
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    const updates = {};

    // Normal fields
    if (title !== undefined) {
      updates.title = String(title).trim();
    }

    if (date !== undefined) {
      updates.date = date;
    }

    if (time !== undefined) {
      updates.time = time;
    }

    if (address !== undefined) {
      updates.address = String(address).trim();
    }

    if (description !== undefined) {
      updates.description =
        String(description).trim();
    }

    if (bookingLink !== undefined) {
      updates.bookingLink =
        String(bookingLink).trim();
    }

    // ─────────────────────────────────────────────
    // New image
    // ─────────────────────────────────────────────

    if (image) {

      if (!image.url || !image.publicId) {
        return res.status(400).json({
          success: false,
          message:
            "Both image URL and image public ID are required.",
        });
      }

      updates.image = {
        url: image.url,
        publicId: image.publicId,
      };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update.",
      });
    }

    const oldImageKey =
      event.image?.publicId;

    const updatedEvent =
      await Event.findByIdAndUpdate(
        req.params.id,
        {
          $set: updates,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select("-__v");

    // ─────────────────────────────────────────────
    // Delete old R2 image
    // Only after DB update succeeds
    // ─────────────────────────────────────────────

    if (
      image &&
      oldImageKey &&
      oldImageKey !== image.publicId
    ) {
      try {

        const deleteCommand =
          new DeleteObjectCommand({
            Bucket:
              process.env.R2_BUCKET_NAME,

            Key: oldImageKey,
          });

        await r2.send(deleteCommand);

        console.log(
          "Old event image deleted from R2:",
          oldImageKey
        );

      } catch (deleteError) {

        console.warn(
          "Old R2 image deletion failed:",
          deleteError.message
        );

      }
    }

    return res.status(200).json({
      success: true,
      message: "Event updated successfully.",
      data: updatedEvent,
    });

  } catch (error) {

    console.error(
      "updateEvent error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


// ─────────────────────────────────────────────────────────────
// DELETE /api/events/:id
// ─────────────────────────────────────────────────────────────

const deleteEvent = async (req, res) => {
  try {

    const event = await Event.findById(
      req.params.id
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // ─────────────────────────────────────────────
    // Delete image from Cloudflare R2
    // ─────────────────────────────────────────────

    if (event.image?.publicId) {

      try {

        const deleteCommand =
          new DeleteObjectCommand({
            Bucket:
              process.env.R2_BUCKET_NAME,

            Key: event.image.publicId,
          });

        await r2.send(deleteCommand);

        console.log(
          "Event image deleted from R2:",
          event.image.publicId
        );

      } catch (deleteError) {

        console.warn(
          "R2 image deletion failed:",
          deleteError.message
        );

      }
    }

    // ─────────────────────────────────────────────
    // Delete event from MongoDB
    // ─────────────────────────────────────────────

    await Event.findByIdAndDelete(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message:
        `Event "${event.title}" deleted successfully.`,
    });

  } catch (error) {

    console.error(
      "deleteEvent error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export {
  getEventUploadUrl,
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};