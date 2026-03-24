import Banner from "../models/Banner.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

export const createBanner = async (req, res) => {
  try {

    const { imageUrl, public_id } = req.body;

    if (!imageUrl || !public_id) {
      return res.status(400).json({
        error: "Image URL or public_id missing",
      });
    }

    const banner = await Banner.create({
      imageUrl,
      public_id,
    });

    res.json({
      success: true,
      banner,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to save banner",
    });
  }
};

export const getBanners = async (req, res) => {

  try {

    const banners = await Banner.find().sort({ createdAt: -1 });

    res.json(banners);

  } catch (error) {

    res.status(500).json({
      error: "Failed to fetch banners",
    });

  }
};

export const deleteBanner = async (req, res) => {

  try {

    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        error: "Banner not found",
      });
    }

    await cloudinary.uploader.destroy(banner.public_id);

    await Banner.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Banner deleted successfully",
    });

  } catch (error) {

    res.status(500).json({
      error: "Delete failed",
    });

  }
};