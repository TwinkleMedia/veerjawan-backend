import mongoose from "mongoose";

const BannerSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },

    fileKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Banner", BannerSchema);