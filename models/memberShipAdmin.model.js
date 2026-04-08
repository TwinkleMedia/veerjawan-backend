import mongoose from "mongoose";

const memberShipAdminSchema = new mongoose.Schema(
  {
    // ── Basic Details ──────────────────────────────────────────
    membershipNumber: {
      type:     String,
      required: [true, "Membership number is required"],
      unique:   true,
      trim:     true,
    },
    date: {
      type:     Date,
      required: [true, "Date is required"],
    },
    fullName: {
      type:     String,
      required: [true, "Full name is required"],
      trim:     true,
    },
    dob: {
      type:     Date,
      required: [true, "Date of birth is required"],
    },

    // ── Address Details ────────────────────────────────────────
    address: {
      type:     String,
      required: [true, "Address is required"],
      trim:     true,
    },
    pincode: {
      type:     String,
      required: [true, "Pincode is required"],
      trim:     true,
    },
    district: {
      type:     String,
      required: [true, "District is required"],
      trim:     true,
    },
    state: {
      type:     String,
      required: [true, "State is required"],
      trim:     true,
    },

    // ── Contact Details ────────────────────────────────────────
    mobile1: {
      type:     String,
      required: [true, "Primary mobile number is required"],
      trim:     true,
    },
    mobile2: {
      type:    String,
      trim:    true,
      default: "",
    },
    email: {
      type:      String,
      trim:      true,
      lowercase: true,
      default:   "",
    },

    // ── Personal Information ───────────────────────────────────
    occupation: {
      type:    String,
      trim:    true,
      default: "",
    },
    education: {
      type:    String,
      trim:    true,
      default: "",
    },
    maritalStatus: {
      type:    String,
      enum:    ["Married", "Unmarried", ""],
      default: "",
    },

    // ── Additional Information ─────────────────────────────────
    isAssociated: {
      type:    String,
      enum:    ["Yes", "No", ""],
      default: "",
    },
    organizationName: {
      type:    String,
      trim:    true,
      default: "",
    },
    briefDescription: {
      type:    String,
      trim:    true,
      default: "",
    },

    // ── Documents (Cloudinary URLs + Public IDs) ───────────────
    photo: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    aadharCard: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    soldierIdCard: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

const MemberShipAdmin = mongoose.model("MemberShipAdmin", memberShipAdminSchema);
export default MemberShipAdmin;