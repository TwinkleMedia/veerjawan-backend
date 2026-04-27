import { v2 as cloudinary } from "cloudinary";

// ── Configure Cloudinary ────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Upload Base64 File to Cloudinary ────────────────────
/**
 * Upload a base64 data URI to Cloudinary.
 *
 * @param {string} fileDataUri  - base64 string (data:image/jpeg;base64,...)
 * @param {string} folder       - folder name
 * @param {string} publicId     - file name
 * @returns {Promise<{url: string, publicId: string}>}
 */
export const uploadToCloudinary = (fileDataUri, folder, publicId, resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      public_id: publicId,
      overwrite: true,
      resource_type: resourceType,
    };

    // Only apply image transformations for non-video uploads
    if (resourceType !== "video") {
      uploadOptions.transformation = [
        { quality: "auto", fetch_format: "auto" },
      ];
    }

    cloudinary.uploader.upload(
      fileDataUri,
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
  });
};

export const deleteFromCloudinary = (publicId) =>
  cloudinary.uploader.destroy(publicId);
// ── DEFAULT EXPORT (IMPORTANT FIX) ──────────────────────
export default cloudinary;