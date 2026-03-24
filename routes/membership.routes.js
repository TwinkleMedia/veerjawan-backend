import express from "express";
import {
  submitMembership,
  getAllMemberships,
  getMembershipById,
  updateMembership,
  updateYoutubeLink,
  deleteMembership,
} from "../controllers/membership.controller.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
// POST   /api/membership        → Submit new membership (multipart/form-data)
router.post("/", submitMembership);

// ── Admin ─────────────────────────────────────────────────────────────────────
// GET    /api/membership        → Get all memberships
router.get("/", getAllMemberships);

// GET    /api/membership/:id    → Get single membership
router.get("/:id", getMembershipById);

// PUT    /api/membership/:id    → Edit membership
// NOTE: No express.json() here — controller handles both multipart and JSON itself
router.put("/:id", updateMembership);

// PATCH  /api/membership/:id/youtube  → Add / update YouTube link
router.patch("/:id/youtube", express.json(), updateYoutubeLink);

// DELETE /api/membership/:id    → Delete membership
router.delete("/:id", deleteMembership);

export default router;