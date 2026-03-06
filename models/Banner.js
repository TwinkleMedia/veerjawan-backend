import mongoose from "mongoose";

const BannerSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  public_id: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Banner", BannerSchema);