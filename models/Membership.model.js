import mongoose from "mongoose";

const childSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    education: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const membershipSchema = new mongoose.Schema(
  {
    // ── 01 Basic Information ──────────────────────────────────────────────

    membershipNo: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    date: {
      type: String,
      required: true,
    },

    martyrCount: {
      type: Number,
      required: true,
      min: 1,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    // ── 02 Martyr Soldier Details ─────────────────────────────────────────

    rank: {
      type: String,
      required: true,
    },

    serviceNumber: {
      type: String,
      required: true,
      trim: true,
    },

    martyrdomDate: {
      type: String,
      required: true,
    },

    placeOfMartyrdom: {
      type: String,
      required: true,
      trim: true,
    },

    awardsHonors: {
      type: String,
      trim: true,
      default: "",
    },

    operationDescription: {
      type: String,
      trim: true,
      default: "",
    },

    // ── 03 Family Details ─────────────────────────────────────────────────

    veerNariName: {
      type: String,
      trim: true,
      default: "",
    },

    veerNariEducation: {
      type: String,
      trim: true,
      default: "",
    },

    children: {
      type: [childSchema],
      default: [],
    },

    fatherName: {
      type: String,
      required: true,
      trim: true,
    },

    motherName: {
      type: String,
      required: true,
      trim: true,
    },

    // ── 04 Contact Details ────────────────────────────────────────────────

    mobile1: {
      type: String,
      required: true,
      trim: true,
    },

    mobile2: {
      type: String,
      trim: true,
      default: "",
    },

    permanentAddress: {
      type: String,
      required: true,
      trim: true,
    },

    district: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    // ── 05 Cloudflare R2 Image URLs / Object Keys ─────────────────────────

    passportPhotoUrl: {
      type: String,
      required: true,
    },

    passportPhotoPublicId: {
      type: String,
      required: true,
    },

    aadharCardUrl: {
      type: String,
      required: true,
    },

    aadharCardPublicId: {
      type: String,
      required: true,
    },

    idCardUrl: {
      type: String,
      required: true,
    },

    idCardPublicId: {
      type: String,
      required: true,
    },

    // ── 06 YouTube ────────────────────────────────────────────────────────

    youtubeLink: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Membership = mongoose.model("Membership", membershipSchema);

export default Membership;