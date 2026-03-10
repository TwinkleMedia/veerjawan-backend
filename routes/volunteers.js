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

export default router;