import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import membershipRoutes from "./routes/membership.routes.js";
import membershipAdmin from "./routes/memberShipAdmin.routes.js";
import eventRoutes from "./routes/event.routes.js";
import pdfRoutes from "./routes/pdf.js"
import galleryRoutes from "./routes/gallery.routes.js"
const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));



app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.use(cookieParser());

connectDB();

app.use("/api/auth",            authRoutes);
app.use("/api/banner",          bannerRoutes);
app.use("/api/membershipAdmin", membershipAdmin);
app.use("/api/membership",      membershipRoutes);
app.use("/api/events",          eventRoutes);
app.use("/api/gallery",galleryRoutes)
app.use("/api", pdfRoutes)

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});