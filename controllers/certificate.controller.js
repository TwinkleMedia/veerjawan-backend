import Busboy from "busboy";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import r2 from "../config/r2.js";
import Certificate from "../models/certificate.model.js";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const getExtension = (fileName) => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif"];

  if (!allowedExtensions.includes(extension)) {
    return "jpg";
  }

  return extension;
};

/*
|--------------------------------------------------------------------------
| POST /api/upload-certificate
|--------------------------------------------------------------------------
| Upload a new certificate
| multipart/form-data:
|   title -> string
|   image -> file
|--------------------------------------------------------------------------
*/

export const uploadCertificate = (req, res) => {
  let busboy;

  try {
    busboy = Busboy({
      headers: req.headers,
    });
  } catch (err) {
    console.error("Busboy initialization error:", err);

    return res.status(400).json({
      message: "Invalid multipart request",
    });
  }

  let title = "";
  let fileBuffer = null;
  let fileMimeType = "";
  let fileName = "";
  let fileSizeBytes = 0;
  let fileTooLarge = false;

  busboy.on("field", (fieldname, value) => {
    if (fieldname === "title") {
      title = value.trim();
    }
  });

  busboy.on("file", (_fieldname, fileStream, info) => {
    fileMimeType = info.mimeType;
    fileName = info.filename;

    if (!ALLOWED_TYPES.includes(fileMimeType)) {
      fileStream.resume();

      busboy.emit(
        "customError",
        new Error("INVALID_FILE_TYPE")
      );

      return;
    }

    const chunks = [];

    fileStream.on("data", (chunk) => {
      fileSizeBytes += chunk.length;

      if (fileSizeBytes > MAX_SIZE) {
        fileTooLarge = true;
        fileStream.resume();
        return;
      }

      chunks.push(chunk);
    });

    fileStream.on("end", () => {
      if (!fileTooLarge) {
        fileBuffer = Buffer.concat(chunks);
      }
    });
  });

  busboy.on("customError", (err) => {
    if (err.message === "INVALID_FILE_TYPE") {
      return res.status(400).json({
        message: "Only JPG, PNG, WEBP and GIF images are allowed",
      });
    }
  });

  busboy.on("error", (err) => {
    console.error("Busboy error:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "File parsing failed",
      });
    }
  });

  busboy.on("finish", async () => {
    try {
      if (fileTooLarge) {
        return res.status(400).json({
          message: "Image must be less than 2 MB",
        });
      }

      if (!title) {
        return res.status(400).json({
          message: "Title is required",
        });
      }

      if (!fileBuffer) {
        return res.status(400).json({
          message: "Image is required",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Generate R2 file key
      |--------------------------------------------------------------------------
      */

      const extension = getExtension(fileName);

      const fileKey = `certificates/${randomUUID()}.${extension}`;

      /*
      |--------------------------------------------------------------------------
      | Upload to Cloudflare R2
      |--------------------------------------------------------------------------
      */

      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: fileMimeType,
      });

      await r2.send(uploadCommand);

      /*
      |--------------------------------------------------------------------------
      | Build public URL
      |--------------------------------------------------------------------------
      */

      const imageUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

      /*
      |--------------------------------------------------------------------------
      | Save certificate in MongoDB
      |--------------------------------------------------------------------------
      */

      const certificate = await Certificate.create({
        title,
        imageUrl,
        fileKey,
      });

      return res.status(201).json({
        success: true,
        message: "Certificate uploaded successfully",
        certificate,
      });
    } catch (err) {
      console.error("Certificate upload error:", err);

      return res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  });

  req.pipe(busboy);
};

/*
|--------------------------------------------------------------------------
| GET /api/certificates
|--------------------------------------------------------------------------
| Get all certificates
|--------------------------------------------------------------------------
*/

export const getAllCertificates = async (_req, res) => {
  try {
    const certificates = await Certificate.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      certificates,
    });
  } catch (err) {
    console.error("Fetch certificates error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/certificates/:id
|--------------------------------------------------------------------------
| Update certificate title and/or image
|--------------------------------------------------------------------------
*/

export const updateCertificate = (req, res) => {
  let busboy;

  try {
    busboy = Busboy({
      headers: req.headers,
    });
  } catch (err) {
    console.error("Busboy initialization error:", err);

    return res.status(400).json({
      message: "Invalid multipart request",
    });
  }

  let title = "";
  let fileBuffer = null;
  let fileMimeType = "";
  let fileName = "";
  let fileSizeBytes = 0;
  let fileTooLarge = false;

  busboy.on("field", (fieldname, value) => {
    if (fieldname === "title") {
      title = value.trim();
    }
  });

  busboy.on("file", (_fieldname, fileStream, info) => {
    fileMimeType = info.mimeType;
    fileName = info.filename;

    if (!ALLOWED_TYPES.includes(fileMimeType)) {
      fileStream.resume();

      busboy.emit(
        "customError",
        new Error("INVALID_FILE_TYPE")
      );

      return;
    }

    const chunks = [];

    fileStream.on("data", (chunk) => {
      fileSizeBytes += chunk.length;

      if (fileSizeBytes > MAX_SIZE) {
        fileTooLarge = true;
        fileStream.resume();
        return;
      }

      chunks.push(chunk);
    });

    fileStream.on("end", () => {
      if (!fileTooLarge) {
        fileBuffer = Buffer.concat(chunks);
      }
    });
  });

  busboy.on("customError", (err) => {
    if (err.message === "INVALID_FILE_TYPE") {
      if (!res.headersSent) {
        return res.status(400).json({
          message:
            "Only JPG, PNG, WEBP and GIF images are allowed",
        });
      }
    }
  });

  busboy.on("error", (err) => {
    console.error("Busboy error:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "File parsing failed",
      });
    }
  });

  busboy.on("finish", async () => {
    try {
      if (fileTooLarge) {
        return res.status(400).json({
          message: "Image must be less than 2 MB",
        });
      }

      if (!title) {
        return res.status(400).json({
          message: "Title is required",
        });
      }

      const { id } = req.params;

      /*
      |--------------------------------------------------------------------------
      | Find existing certificate
      |--------------------------------------------------------------------------
      */

      const existing = await Certificate.findById(id);

      if (!existing) {
        return res.status(404).json({
          message: "Certificate not found",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Update title
      |--------------------------------------------------------------------------
      */

      const updates = {
        title,
      };

      /*
      |--------------------------------------------------------------------------
      | If new image was uploaded
      |--------------------------------------------------------------------------
      */

      if (fileBuffer) {
        const extension = getExtension(fileName);

        const newFileKey = `certificates/${randomUUID()}.${extension}`;

        /*
        |--------------------------------------------------------------------------
        | Upload new image to R2
        |--------------------------------------------------------------------------
        */

        const uploadCommand = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: newFileKey,
          Body: fileBuffer,
          ContentType: fileMimeType,
        });

        await r2.send(uploadCommand);

        /*
        |--------------------------------------------------------------------------
        | New public URL
        |--------------------------------------------------------------------------
        */

        const newImageUrl = `${process.env.R2_PUBLIC_URL}/${newFileKey}`;

        updates.imageUrl = newImageUrl;
        updates.fileKey = newFileKey;

        /*
        |--------------------------------------------------------------------------
        | Delete old image from R2
        |--------------------------------------------------------------------------
        */

        if (existing.fileKey) {
          try {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: existing.fileKey,
            });

            await r2.send(deleteCommand);

            console.log(
              "Old certificate image deleted from R2:",
              existing.fileKey
            );
          } catch (deleteError) {
            console.warn(
              "Old R2 image deletion failed:",
              deleteError.message
            );
          }
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Update MongoDB
      |--------------------------------------------------------------------------
      */

      const certificate = await Certificate.findByIdAndUpdate(
        id,
        updates,
        {
          new: true,
          runValidators: true,
        }
      );

      return res.status(200).json({
        success: true,
        message: "Certificate updated successfully",
        certificate,
      });
    } catch (err) {
      console.error("Certificate update error:", err);

      return res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  });

  req.pipe(busboy);
};

/*
|--------------------------------------------------------------------------
| DELETE /api/certificates/:id
|--------------------------------------------------------------------------
| Delete certificate from MongoDB + R2
|--------------------------------------------------------------------------
*/

export const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    /*
    |--------------------------------------------------------------------------
    | Find certificate
    |--------------------------------------------------------------------------
    */

    const certificate = await Certificate.findById(id);

    if (!certificate) {
      return res.status(404).json({
        message: "Certificate not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Delete image from R2
    |--------------------------------------------------------------------------
    */

    if (certificate.fileKey) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: certificate.fileKey,
        });

        await r2.send(deleteCommand);

        console.log(
          "Certificate image deleted from R2:",
          certificate.fileKey
        );
      } catch (deleteError) {
        console.warn(
          "R2 image deletion failed:",
          deleteError.message
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Delete MongoDB document
    |--------------------------------------------------------------------------
    */

    await Certificate.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Certificate deleted successfully",
    });
  } catch (err) {
    console.error("Certificate delete error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};