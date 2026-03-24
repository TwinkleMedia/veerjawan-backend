import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 data URI to Cloudinary.
 *
 * @param {string} fileDataUri  - base64 data URI  e.g. "data:image/jpeg;base64,..."
 * @param {string} folder       - Cloudinary folder e.g. "membership/MBR-001/passport"
 * @param {string} publicId     - Public ID          e.g. "passport_photo"
 * @returns {Promise<string>}   - Secure URL of the uploaded image
 */
const uploadToCloudinary = (fileDataUri, folder, publicId) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      fileDataUri,
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
  });

export { uploadToCloudinary };