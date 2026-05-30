import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";

import donationRoutes from "./routes/donation.routes.js";
import authRoutes from "./routes/authRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import membershipRoutes from "./routes/membership.routes.js";
import membershipAdmin from "./routes/memberShipAdmin.routes.js";
import eventRoutes from "./routes/event.routes.js";
import pdfRoutes from "./routes/pdf.js";
import galleryRoutes from "./routes/gallery.routes.js";
import martyrRoutes from "./routes/martyr.routes.js";
import certificateRoutes from "./routes/certificate.routes.js";

const app = express();

// ─────────────────────────────────────────────
// TRUST PROXY (Important for VPS + NGINX)
// ─────────────────────────────────────────────
app.set("trust proxy", 1);

// ─────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────
app.use(
  cors({
    origin: [
      process.env.CLIENT_URL,
      process.env.CLIENT_URL_WWW,
      process.env.ADMIN_URL,
    ],

    credentials: true,
  }),
);

// ─────────────────────────────────────────────
// BODY PARSER
// ─────────────────────────────────────────────
app.use(express.json({ limit: "100mb" }));

app.use(
  express.urlencoded({
    limit: "100mb",
    extended: true,
  }),
);

// ─────────────────────────────────────────────
// COOKIE PARSER
// ─────────────────────────────────────────────
app.use(cookieParser());

// ─────────────────────────────────────────────
// DATABASE CONNECTION
// ─────────────────────────────────────────────
connectDB();

// ─────────────────────────────────────────────
// HEALTH CHECK ROUTE
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("🚀 Backend API Running Successfully");
});

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────
app.use("/api/auth", authRoutes);

app.use("/api/banner", bannerRoutes);

app.use("/api/membershipAdmin", membershipAdmin);

app.use("/api/membership", membershipRoutes);

app.use("/api/events", eventRoutes);

app.use("/api/donation", donationRoutes);

app.use("/api/gallery", galleryRoutes);

app.use("/api", pdfRoutes);

app.use("/api", martyrRoutes);

app.use("/api", certificateRoutes);

// ─────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
console.log("deploy test 1");

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
