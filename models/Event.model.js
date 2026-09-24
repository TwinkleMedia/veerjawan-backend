import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: String,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    bookingLink: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      url: {
        type: String,
        required: true,
      },

      // For Cloudflare R2 this stores the R2 object key
      // Example: events/abc123.jpg
      publicId: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;