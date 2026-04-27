import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
import Certificate from "../models/certificate.model.js";

/**
 * POST /api/upload-certificate
 * Accepts multipart/form-data with fields:
 *   - title  (string)
 *   - image  (file)
 *
 * Strategy (no multer):
 *   The raw request stream is collected with express.raw / manual buffer,
 *   then we parse the multipart body ourselves using the built-in busboy
 *   package that ships with Node ≥ 18 (or install busboy separately).
 */
import Busboy from "busboy";

export const uploadCertificate = (req, res) => {
  // ── 1. Set up Busboy to parse the incoming multipart stream ────────────
  let busboy;
  try {
    busboy = Busboy({ headers: req.headers });
  } catch (err) {
    return res.status(400).json({ message: "Invalid multipart request" });
  }

  let title = "";
  let fileBuffer = null;
  let fileMimeType = "";
  let fileName = "";
  let fileSizeBytes = 0;

  const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

  // ── 2. Collect text fields ─────────────────────────────────────────────
  busboy.on("field", (fieldname, value) => {
    if (fieldname === "title") {
      title = value.trim();
    }
  });

  // ── 3. Collect the file as a Buffer ────────────────────────────────────
  busboy.on("file", (_fieldname, fileStream, info) => {
    fileMimeType = info.mimeType;
    fileName = info.filename;
    const chunks = [];

    fileStream.on("data", (chunk) => {
      fileSizeBytes += chunk.length;

      // Abort early if file exceeds limit
      if (fileSizeBytes > MAX_SIZE) {
        fileStream.destroy();
        busboy.emit("error", new Error("FILE_TOO_LARGE"));
      } else {
        chunks.push(chunk);
      }
    });

    fileStream.on("end", () => {
      if (fileSizeBytes <= MAX_SIZE) {
        fileBuffer = Buffer.concat(chunks);
      }
    });
  });

  // ── 4. Handle parse errors (including our custom FILE_TOO_LARGE) ───────
  busboy.on("error", (err) => {
    if (err.message === "FILE_TOO_LARGE") {
      return res
        .status(400)
        .json({ message: "Image must be less than 2 MB" });
    }
    console.error("Busboy error:", err);
    return res.status(500).json({ message: "File parsing failed" });
  });

  // ── 5. After all parts are parsed → validate → upload → save ──────────
  busboy.on("finish", async () => {
    try {
      // Validate fields
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }
      if (!fileBuffer) {
        return res
          .status(400)
          .json({ message: "Image is required and must be under 2 MB" });
      }

      // Convert buffer to base64 data URI for Cloudinary helper
      const base64DataUri = `data:${fileMimeType};base64,${fileBuffer.toString("base64")}`;

      // Build a URL-safe public ID from the title + timestamp
      const sanitizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 60);
      const publicId = `${sanitizedTitle}_${Date.now()}`;

      // Upload to Cloudinary  →  folder: "certificates"
      const { url, publicId: cloudinaryPublicId } = await uploadToCloudinary(
        base64DataUri,
        "certificates", // ← Cloudinary folder
        publicId,
        "image"
      );

      // Save to MongoDB
      const certificate = await Certificate.create({
        title,
        imageUrl: url,
        cloudinaryPublicId,
      });

      return res.status(201).json({
        message: "Certificate uploaded successfully",
        certificate,
      });
    } catch (err) {
      console.error("Certificate upload error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  });

  // ── 6. Pipe the request into Busboy ────────────────────────────────────
  req.pipe(busboy);
};

/**
 * GET /api/certificates
 * Returns all certificates (newest first)
 */
export const getAllCertificates = async (_req, res) => {
  try {
    const certificates = await Certificate.find().sort({ createdAt: -1 });
    return res.status(200).json({ certificates });
  } catch (err) {
    console.error("Fetch certificates error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PUT /api/certificates/:id
 * Update title and/or image of an existing certificate.
 * Accepts multipart/form-data:
 *   - title  (string, required)
 *   - image  (file, optional — omit to keep the existing image)
 */
export const updateCertificate = (req, res) => {
  let busboy;
  try {
    busboy = Busboy({ headers: req.headers });
  } catch {
    return res.status(400).json({ message: "Invalid multipart request" });
  }

  const MAX_SIZE = 2 * 1024 * 1024;
  let title = "";
  let fileBuffer = null;
  let fileMimeType = "";
  let fileSizeBytes = 0;

  busboy.on("field", (fieldname, value) => {
    if (fieldname === "title") title = value.trim();
  });

  busboy.on("file", (_fieldname, fileStream, info) => {
    fileMimeType = info.mimeType;
    const chunks = [];

    fileStream.on("data", (chunk) => {
      fileSizeBytes += chunk.length;
      if (fileSizeBytes > MAX_SIZE) {
        fileStream.destroy();
        busboy.emit("error", new Error("FILE_TOO_LARGE"));
      } else {
        chunks.push(chunk);
      }
    });

    fileStream.on("end", () => {
      if (fileSizeBytes <= MAX_SIZE) {
        fileBuffer = Buffer.concat(chunks);
      }
    });
  });

  busboy.on("error", (err) => {
    if (err.message === "FILE_TOO_LARGE") {
      return res.status(400).json({ message: "Image must be less than 2 MB" });
    }
    console.error("Busboy error:", err);
    return res.status(500).json({ message: "File parsing failed" });
  });

  busboy.on("finish", async () => {
    try {
      const { id } = req.params;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      // Find the existing certificate
      const existing = await Certificate.findById(id);
      if (!existing) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      const updates = { title };

      // If a new image was provided, upload it and delete the old one
      if (fileBuffer) {
        // Upload new image to Cloudinary
        const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60);
        const publicId = `${sanitizedTitle}_${Date.now()}`;
        const base64DataUri = `data:${fileMimeType};base64,${fileBuffer.toString("base64")}`;

        const { url, publicId: newCloudinaryPublicId } = await uploadToCloudinary(
          base64DataUri,
          "certificates",
          publicId,
          "image"
        );

        // Delete old image from Cloudinary (non-blocking — don't fail if it errors)
        if (existing.cloudinaryPublicId) {
          deleteFromCloudinary(existing.cloudinaryPublicId).catch((e) =>
            console.warn("Old image deletion failed:", e.message)
          );
        }

        updates.imageUrl = url;
        updates.cloudinaryPublicId = newCloudinaryPublicId;
      }

      const certificate = await Certificate.findByIdAndUpdate(id, updates, { new: true });

      return res.status(200).json({ message: "Certificate updated successfully", certificate });
    } catch (err) {
      console.error("Certificate update error:", err);
      return res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  req.pipe(busboy);
};

/**
 * DELETE /api/certificates/:id
 * Deletes the certificate from MongoDB and removes the image from Cloudinary.
 */
export const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    // Remove image from Cloudinary
    if (certificate.cloudinaryPublicId) {
      await deleteFromCloudinary(certificate.cloudinaryPublicId).catch((e) =>
        console.warn("Cloudinary deletion failed:", e.message)
      );
    }

    // Remove from DB
    await Certificate.findByIdAndDelete(id);

    return res.status(200).json({ message: "Certificate deleted successfully" });
  } catch (err) {
    console.error("Certificate delete error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};