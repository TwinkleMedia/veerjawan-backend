import mongoose from "mongoose";

const martyrSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },

    dob: {
      type: Date,
      required: true,
    },

    unit: {
      type: String,
      required: true,
    },

    enrollmentDate: {
      type: Date,
      required: true,
    },

    martyrdomDate: {
      type: Date,
      required: true,
    },

    placeOfMartyrdom: {
      type: String,
      required: true,
    },

    incidentDescription: {
      type: String,
      required: true,
    },

    wifeName: {
      type: String,
    },

    numberOfSons: {
      type: Number,
    },

    parentsDetails: {
      type: String,
    },

    village: {
      type: String,
      required: true,
    },

    postOffice: {
      type: String,
      required: true,
    },

    taluka: {
      type: String,
      required: true,
    },

    district: {
      type: String,
      required: true,
    },

    // Cloudflare R2 photo
    photo: {
      url: {
        type: String,
        required: true,
      },

      // R2 object key
      // Example: martyrs/photos/photo_1727160000000.jpg
      publicId: {
        type: String,
        required: true,
      },
    },

    youtubeLink: {
      type: String,
      default: "",
      trim: true,
    },

    // Cloudflare R2 certificate
    certificate: {
      url: {
        type: String,
      },

      // R2 object key
      // Example: martyrs/certificates/certificate_1727160000000.jpg
      publicId: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Martyr", martyrSchema);