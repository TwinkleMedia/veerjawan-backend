import Event from "../models/Event.model.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import parseMultipart from "../utils/parseMultipart.js";

// ── POST /api/events ──────────────────────────────────────────────────────────
// Create new event (multipart/form-data — image required)
const createEvent = async (req, res) => {
  try {
    const { fields, files } = await parseMultipart(req);

    const { title, date, time, address, description = "" } = fields;

    // Validate required fields
    const missing = ["title", "date", "time", "address"].filter(
      (k) => !fields[k] || String(fields[k]).trim() === ""
    );
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(", ")}` });
    }

    if (!files.image) {
      return res.status(400).json({ success: false, message: "Event image is required." });
    }

    // Upload image to Cloudinary
    const imageUrl = await uploadToCloudinary(
      files.image.dataUri,
      "events",
      `event_${Date.now()}`
    );

    const event = await Event.create({
      title: title.trim(),
      date,
      time,
      address: address.trim(),
      description,
      imageUrl,
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully.",
      data: event,
    });
  } catch (error) {
    console.error("createEvent error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── GET /api/events ───────────────────────────────────────────────────────────
// Get all events (newest first)
const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 }).select("-__v");
    return res.status(200).json({ success: true, count: events.length, data: events });
  } catch (error) {
    console.error("getAllEvents error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── GET /api/events/:id ───────────────────────────────────────────────────────
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("-__v");
    if (!event) return res.status(404).json({ success: false, message: "Event not found." });
    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    console.error("getEventById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── PUT /api/events/:id ───────────────────────────────────────────────────────
// Update event — handles both JSON (no image change) and multipart (with new image)
const updateEvent = async (req, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    let fields = {};
    let files  = {};

    if (contentType.includes("multipart/form-data")) {
      const parsed = await parseMultipart(req);
      fields = parsed.fields;
      files  = parsed.files;
    } else {
      fields = req.body;
    }

    const allowedFields = ["title", "date", "time", "address", "description"];
    const updates = {};
    allowedFields.forEach((f) => {
      if (fields[f] !== undefined) updates[f] = fields[f];
    });

    // Upload new image if provided
    if (files.image) {
      updates.imageUrl = await uploadToCloudinary(
        files.image.dataUri,
        "events",
        `event_${req.params.id}`
      );
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update." });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!event) return res.status(404).json({ success: false, message: "Event not found." });

    return res.status(200).json({ success: true, message: "Event updated.", data: event });
  } catch (error) {
    console.error("updateEvent error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── DELETE /api/events/:id ────────────────────────────────────────────────────
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Event not found." });
    return res.status(200).json({ success: true, message: `Event "${event.title}" deleted.` });
  } catch (error) {
    console.error("deleteEvent error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

export { createEvent, getAllEvents, getEventById, updateEvent, deleteEvent };