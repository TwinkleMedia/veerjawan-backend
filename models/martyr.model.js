import mongoose from "mongoose";

const martyrSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    dob: { type: Date, required: true },
    unit: { type: String, required: true },
    enrollmentDate: { type: Date, required: true },
    martyrdomDate: { type: Date, required: true },
    placeOfMartyrdom: { type: String, required: true },
    incidentDescription: { type: String, required: true },

    wifeName: String,
    numberOfSons: Number,
    parentsDetails: String,

    village: { type: String, required: true },
    postOffice: { type: String, required: true },
    taluka: { type: String, required: true },
    district: { type: String, required: true },

    photo: {
      url: String,
      publicId: String,
    },

    certificate: {
      url: String,
      publicId: String,
    },
  },
  { timestamps: true }
);


export default mongoose.model("Martyr", martyrSchema);