import mongoose from "mongoose";

const volunteerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },

    dob: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
    },

    email: {
      type: String,
      required: true,
    },

    mobile: {
      type: String,
      required: true,
    },

    alternateMobile: {
      type: String,
    },

    address1: {
      type: String,
    },

    address2: {
      type: String,
    },

    city: {
      type: String,
    },

    state: {
      type: String,
    },

    pincode: {
      type: Number,
    },

    interests: [
      {
        type: String,
      },
    ],

    skills: {
      type: String,
    },

    availability: {
      type: String,
    },

    location: {
      type: String,
    },

    occupation: {
      type: String,
    },
  },
  { timestamps: true }
);

const Volunteer = mongoose.model("Volunteer", volunteerSchema);

export default Volunteer;