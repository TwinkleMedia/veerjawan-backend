import express from "express";
import Volunteer from "../models/Volunteer.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const volunteer = new Volunteer(req.body);
    await volunteer.save();

    res.json({
      success: true,
      message: "Volunteer Registered Successfully",
      data: volunteer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


// ── GET /api/volunteers — Fetch all volunteers ──
router.get("/", async (req, res) => {
  try {
    const { search, state, city, interest } = req.query;

    // Build dynamic filter
    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }

    if (state) filter.state = { $regex: state, $options: "i" };
    if (city) filter.city = { $regex: city, $options: "i" };
    if (interest) filter.interests = { $in: [interest] };

    const volunteers = await Volunteer.find(filter)
      .sort({ createdAt: -1 })  // newest first
      .select("-__v");           // exclude mongoose version key

    res.json({
      success: true,
      count: volunteers.length,
      data: volunteers,
    });

  } catch (error) {
    console.error("GET /volunteers error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// ── GET /api/volunteers/:id — Fetch single volunteer ──
router.get("/:id", async (req, res) => {
  try {
    const volunteer = await Volunteer.findById(req.params.id).select("-__v");

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found",
      });
    }

    res.json({
      success: true,
      data: volunteer,
    });

  } catch (error) {
    console.error("GET /volunteers/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// ── DELETE /api/volunteers/:id — Delete a volunteer ──
router.delete("/:id", async (req, res) => {
  try {
    const volunteer = await Volunteer.findByIdAndDelete(req.params.id);

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found",
      });
    }

    res.json({
      success: true,
      message: "Volunteer deleted successfully",
    });

  } catch (error) {
    console.error("DELETE /volunteers/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


// ── PUT /api/volunteers/:id — Update volunteer ──
// ── PUT /api/volunteers/:id — Update volunteer ──
router.put("/:id", async (req, res) => {
  try {

    const updatedVolunteer = await Volunteer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedVolunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found",
      });
    }

    res.json({
      success: true,
      message: "Volunteer updated successfully",
      data: updatedVolunteer,
    });

  } catch (error) {
    console.error("PUT /volunteers/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

export default router;
