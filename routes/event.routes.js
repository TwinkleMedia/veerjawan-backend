import express from "express";

import {
  getEventUploadUrl,
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} from "../controllers/event.controller.js";

const router = express.Router();

// ─────────────────────────────────────────────
// POST /api/events/upload-url
// Generate Cloudflare R2 upload URL
// ─────────────────────────────────────────────

router.post(
  "/upload-url",
  getEventUploadUrl
);

// ─────────────────────────────────────────────
// POST /api/events
// Create event
// ─────────────────────────────────────────────

router.post(
  "/",
  createEvent
);

// ─────────────────────────────────────────────
// GET /api/events
// Get all events
// ─────────────────────────────────────────────

router.get(
  "/",
  getAllEvents
);

// ─────────────────────────────────────────────
// GET /api/events/:id
// Get single event
// ─────────────────────────────────────────────

router.get(
  "/:id",
  getEventById
);

// ─────────────────────────────────────────────
// PUT /api/events/:id
// Update event
// ─────────────────────────────────────────────

router.put(
  "/:id",
  updateEvent
);

// ─────────────────────────────────────────────
// DELETE /api/events/:id
// Delete event
// ─────────────────────────────────────────────

router.delete(
  "/:id",
  deleteEvent
);

export default router;