import mongoose  from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    date:        { type: String, required: true },
    time:        { type: String, required: true },
    address:     { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },

    image: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
    },
  },
  { timestamps: true } // ⚠️ also fix this (you wrote timeseries ❌)
);
const Event = mongoose.model("Event",eventSchema);
export default Event;