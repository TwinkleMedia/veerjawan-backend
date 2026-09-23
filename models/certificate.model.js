import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Certificate title is required"],
      trim: true,
    },

    imageUrl: {
      type: String,
      required: true,
    },

    // Cloudflare R2 object key
    fileKey: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Certificate = mongoose.model("Certificate", certificateSchema);

export default Certificate;