import express from "express";
import mongoose from "mongoose";
import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { randomUUID } from "crypto";

import Membership from "../models/membership.model.js";
import r2 from "../config/r2.js";

const router = express.Router();

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/* ─────────────────────────────────────────────────────────────
   R2 HELPERS
───────────────────────────────────────────────────────────── */

const getR2PublicUrl = (key) => {
  const baseUrl = process.env.R2_PUBLIC_URL;

  if (!baseUrl) {
    throw new Error("R2_PUBLIC_URL is not configured");
  }

  return `${baseUrl.replace(/\/$/, "")}/${key}`;
};

const uploadImageToR2 = async ({
  buffer,
  contentType,
  fileName,
  folder,
}) => {
  if (!buffer || !buffer.length) {
    throw new Error("Image file is empty");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new Error("INVALID_IMAGE_TYPE");
  }

  const extensionMap = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  const extension =
    extensionMap[contentType] ||
    fileName?.split(".").pop()?.toLowerCase() ||
    "jpg";

  const fileKey = `${folder}/${randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileKey,
    Body: buffer,
    ContentType: contentType,
  });

  await r2.send(command);

  return {
    url: getR2PublicUrl(fileKey),
    publicId: fileKey,
  };
};

const deleteImageFromR2 = async (publicId) => {
  if (!publicId) return;

  /*
   * Old records may still contain Cloudinary public IDs.
   * We only attempt R2 deletion when the value looks like
   * an R2 object key.
   */
  if (
    publicId.startsWith("http://") ||
    publicId.startsWith("https://") ||
    publicId.includes("cloudinary")
  ) {
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: publicId,
    });

    await r2.send(command);
  } catch (error) {
    console.warn("R2 image deletion failed:", error.message);
  }
};

/* ─────────────────────────────────────────────────────────────
   MULTIPART PARSER
───────────────────────────────────────────────────────────── */

const parseMultipart = async (req) => {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("multipart/form-data")) {
    return {
      fields: req.body || {},
      files: {},
    };
  }

  const Busboy = (await import("busboy")).default;

  return new Promise((resolve, reject) => {
    let busboy;

    try {
      busboy = Busboy({
        headers: req.headers,
      });
    } catch (error) {
      reject(new Error("Invalid multipart request"));
      return;
    }

    const fields = {};
    const files = {};

    busboy.on("field", (fieldName, value) => {
      fields[fieldName] = value;
    });

    busboy.on("file", (fieldName, fileStream, info) => {
      const {
        filename,
        mimeType,
      } = info;

      const chunks = [];
      let size = 0;
      let tooLarge = false;

      fileStream.on("data", (chunk) => {
        size += chunk.length;

        if (size > MAX_FILE_SIZE) {
          tooLarge = true;
        } else {
          chunks.push(chunk);
        }
      });

      fileStream.on("end", () => {
        files[fieldName] = {
          filename,
          mimeType,
          size,
          buffer: tooLarge ? null : Buffer.concat(chunks),
        };

        if (tooLarge) {
          files[fieldName].tooLarge = true;
        }
      });
    });

    busboy.on("error", (error) => {
      reject(error);
    });

    busboy.on("finish", () => {
      resolve({
        fields,
        files,
      });
    });

    req.pipe(busboy);
  });
};

/* ─────────────────────────────────────────────────────────────
   POST /api/membership
   CREATE MEMBERSHIP
───────────────────────────────────────────────────────────── */

const submitMembership = async (req, res) => {
  try {
    const { fields, files } = await parseMultipart(req);

    const {
      membershipNo,
      date,
      martyrCount,
      fullName,
      rank,
      serviceNumber,
      martyrdomDate,
      placeOfMartyrdom,
      awardsHonors = "",
      operationDescription = "",
      veerNariName = "",
      veerNariEducation = "",
      children = "[]",
      fatherName,
      motherName,
      mobile1,
      mobile2 = "",
      permanentAddress,
      district,
      state,
    } = fields;

    /* ── Required fields ─────────────────────────────── */

    const requiredFields = [
      "membershipNo",
      "date",
      "martyrCount",
      "fullName",
      "rank",
      "serviceNumber",
      "martyrdomDate",
      "placeOfMartyrdom",
      "fatherName",
      "motherName",
      "mobile1",
      "permanentAddress",
      "district",
      "state",
    ];

    const missingFields = requiredFields.filter(
      (field) =>
        fields[field] === undefined ||
        String(fields[field]).trim() === "",
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    /* ── Required images ─────────────────────────────── */

    if (!files.photo) {
      return res.status(400).json({
        success: false,
        message: "Passport Size Photo is required.",
      });
    }

    if (!files.aadharCard) {
      return res.status(400).json({
        success: false,
        message: "Aadhar Card Image is required.",
      });
    }

    if (!files.idCard) {
      return res.status(400).json({
        success: false,
        message: "Martyr Soldier ID Card is required.",
      });
    }

    /* ── Validate images ─────────────────────────────── */

    const imageFiles = [
      {
        field: "photo",
        label: "Passport Size Photo",
        file: files.photo,
      },
      {
        field: "aadharCard",
        label: "Aadhar Card Image",
        file: files.aadharCard,
      },
      {
        field: "idCard",
        label: "Martyr Soldier ID Card",
        file: files.idCard,
      },
    ];

    for (const item of imageFiles) {
      if (item.file.tooLarge || item.file.size > MAX_FILE_SIZE) {
        return res.status(400).json({
          success: false,
          message: `${item.label} must be less than 1 MB.`,
        });
      }

      if (!ALLOWED_IMAGE_TYPES.includes(item.file.mimeType)) {
        return res.status(400).json({
          success: false,
          message: `${item.label} must be JPG, PNG, WEBP or GIF.`,
        });
      }

      if (!item.file.buffer) {
        return res.status(400).json({
          success: false,
          message: `${item.label} could not be processed.`,
        });
      }
    }

    /* ── Check duplicate membership number ───────────── */

    const existingMembership = await Membership.findOne({
      membershipNo: membershipNo.trim(),
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: "Membership number already exists.",
      });
    }

    /* ── Parse children ──────────────────────────────── */

    let parsedChildren = [];

    try {
      parsedChildren =
        typeof children === "string"
          ? JSON.parse(children)
          : children;
    } catch {
      parsedChildren = [];
    }

    /* ──────────────────────────────────────────────────
       UPLOAD TO CLOUDFLARE R2
    ────────────────────────────────────────────────── */

    const membershipFolder = `membership/${membershipNo.trim()}`;

    const passportUpload = await uploadImageToR2({
      buffer: files.photo.buffer,
      contentType: files.photo.mimeType,
      fileName: files.photo.filename,
      folder: `${membershipFolder}/passport`,
    });

    const aadharUpload = await uploadImageToR2({
      buffer: files.aadharCard.buffer,
      contentType: files.aadharCard.mimeType,
      fileName: files.aadharCard.filename,
      folder: `${membershipFolder}/aadhar`,
    });

    const idCardUpload = await uploadImageToR2({
      buffer: files.idCard.buffer,
      contentType: files.idCard.mimeType,
      fileName: files.idCard.filename,
      folder: `${membershipFolder}/idcard`,
    });

    /* ── Save MongoDB ────────────────────────────────── */

    const membership = await Membership.create({
      membershipNo: membershipNo.trim(),
      date,
      martyrCount: Number(martyrCount),
      fullName: fullName.trim(),

      rank,
      serviceNumber: serviceNumber.trim(),
      martyrdomDate,
      placeOfMartyrdom: placeOfMartyrdom.trim(),

      awardsHonors,
      operationDescription,

      veerNariName,
      veerNariEducation,

      children: Array.isArray(parsedChildren)
        ? parsedChildren
        : [],

      fatherName: fatherName.trim(),
      motherName: motherName.trim(),

      mobile1: mobile1.trim(),
      mobile2: mobile2.trim(),

      permanentAddress: permanentAddress.trim(),
      district: district.trim(),
      state: state.trim(),

      passportPhotoUrl: passportUpload.url,
      passportPhotoPublicId: passportUpload.publicId,

      aadharCardUrl: aadharUpload.url,
      aadharCardPublicId: aadharUpload.publicId,

      idCardUrl: idCardUpload.url,
      idCardPublicId: idCardUpload.publicId,

      youtubeLink: "",
    });

    return res.status(201).json({
      success: true,
      message: "Membership submitted successfully.",
      data: membership,
    });
  } catch (error) {
    console.error("Submit Membership Error:", error);

    if (error.message === "IMAGE_TOO_LARGE") {
      return res.status(400).json({
        success: false,
        message: "Each image must be less than 1 MB.",
      });
    }

    if (error.message === "INVALID_IMAGE_TYPE") {
      return res.status(400).json({
        success: false,
        message: "Only JPG, PNG, WEBP and GIF images are allowed.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET ALL MEMBERSHIPS
───────────────────────────────────────────────────────────── */

const getAllMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: memberships.length,
      data: memberships,
    });
  } catch (error) {
    console.error("Get All Memberships Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET MEMBERSHIP BY ID
───────────────────────────────────────────────────────────── */

const getMembershipById = async (req, res) => {
  try {
    const membership = await Membership.findById(
      req.params.id,
    ).lean();

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    console.error("Get Membership Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/* ─────────────────────────────────────────────────────────────
   PUT /api/membership/:id
   UPDATE MEMBERSHIP
───────────────────────────────────────────────────────────── */

const updateMembership = async (req, res) => {
  try {
    const existing = await Membership.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Membership not found",
      });
    }

    const { fields, files } = await parseMultipart(req);

    const updates = {};

    const allowedFields = [
      "membershipNo",
      "date",
      "martyrCount",
      "fullName",
      "rank",
      "serviceNumber",
      "martyrdomDate",
      "placeOfMartyrdom",
      "awardsHonors",
      "operationDescription",
      "veerNariName",
      "veerNariEducation",
      "fatherName",
      "motherName",
      "mobile1",
      "mobile2",
      "permanentAddress",
      "district",
      "state",
    ];

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        updates[field] = fields[field];
      }
    }

    /* ── Children ────────────────────────────────────── */

    if (fields.children !== undefined) {
      try {
        updates.children =
          typeof fields.children === "string"
            ? JSON.parse(fields.children)
            : fields.children;
      } catch {
        updates.children = [];
      }
    }

    /* ── Membership number ───────────────────────────── */

    const finalMembershipNo =
      fields.membershipNo?.trim() ||
      existing.membershipNo;

    const membershipFolder =
      `membership/${finalMembershipNo}`;

    /* ──────────────────────────────────────────────────
       PASSPORT PHOTO
    ────────────────────────────────────────────────── */

    if (files.photo) {
      if (files.photo.tooLarge || files.photo.size > MAX_FILE_SIZE) {
        return res.status(400).json({
          success: false,
          message: "Passport Size Photo must be less than 1 MB.",
        });
      }

      if (!ALLOWED_IMAGE_TYPES.includes(files.photo.mimeType)) {
        return res.status(400).json({
          success: false,
          message:
            "Passport Size Photo must be JPG, PNG, WEBP or GIF.",
        });
      }

      const newPassport = await uploadImageToR2({
        buffer: files.photo.buffer,
        contentType: files.photo.mimeType,
        fileName: files.photo.filename,
        folder: `${membershipFolder}/passport`,
      });

      await deleteImageFromR2(
        existing.passportPhotoPublicId,
      );

      updates.passportPhotoUrl = newPassport.url;
      updates.passportPhotoPublicId =
        newPassport.publicId;
    }

    /* ──────────────────────────────────────────────────
       AADHAR CARD
    ────────────────────────────────────────────────── */

    if (files.aadharCard) {
      if (
        files.aadharCard.tooLarge ||
        files.aadharCard.size > MAX_FILE_SIZE
      ) {
        return res.status(400).json({
          success: false,
          message: "Aadhar Card Image must be less than 1 MB.",
        });
      }

      if (
        !ALLOWED_IMAGE_TYPES.includes(
          files.aadharCard.mimeType,
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Aadhar Card Image must be JPG, PNG, WEBP or GIF.",
        });
      }

      const newAadhar = await uploadImageToR2({
        buffer: files.aadharCard.buffer,
        contentType: files.aadharCard.mimeType,
        fileName: files.aadharCard.filename,
        folder: `${membershipFolder}/aadhar`,
      });

      await deleteImageFromR2(
        existing.aadharCardPublicId,
      );

      updates.aadharCardUrl = newAadhar.url;
      updates.aadharCardPublicId =
        newAadhar.publicId;
    }

    /* ──────────────────────────────────────────────────
       MARTYR SOLDIER ID CARD
    ────────────────────────────────────────────────── */

    if (files.idCard) {
      if (
        files.idCard.tooLarge ||
        files.idCard.size > MAX_FILE_SIZE
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Martyr Soldier ID Card must be less than 1 MB.",
        });
      }

      if (
        !ALLOWED_IMAGE_TYPES.includes(
          files.idCard.mimeType,
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Martyr Soldier ID Card must be JPG, PNG, WEBP or GIF.",
        });
      }

      const newIdCard = await uploadImageToR2({
        buffer: files.idCard.buffer,
        contentType: files.idCard.mimeType,
        fileName: files.idCard.filename,
        folder: `${membershipFolder}/idcard`,
      });

      await deleteImageFromR2(
        existing.idCardPublicId,
      );

      updates.idCardUrl = newIdCard.url;
      updates.idCardPublicId =
        newIdCard.publicId;
    }

    /* ── Convert numeric field ───────────────────────── */

    if (updates.martyrCount !== undefined) {
      updates.martyrCount = Number(updates.martyrCount);
    }

    const updated = await Membership.findByIdAndUpdate(
      req.params.id,
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Membership updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update Membership Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/* ─────────────────────────────────────────────────────────────
   PATCH /api/membership/:id/youtube
───────────────────────────────────────────────────────────── */

const updateYoutubeLink = async (req, res) => {
  try {
    const { youtubeLink = "" } = req.body;

    const membership =
      await Membership.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            youtubeLink: youtubeLink.trim(),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      ).lean();

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "YouTube link updated successfully",
      data: membership,
    });
  } catch (error) {
    console.error("Update YouTube Link Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/* ─────────────────────────────────────────────────────────────
   DELETE /api/membership/:id
───────────────────────────────────────────────────────────── */

const deleteMembership = async (req, res) => {
  try {
    const membership = await Membership.findById(
      req.params.id,
    );

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership not found",
      });
    }

    /* ── Delete R2 images ────────────────────────────── */

    await Promise.all([
      deleteImageFromR2(
        membership.passportPhotoPublicId,
      ),

      deleteImageFromR2(
        membership.aadharCardPublicId,
      ),

      deleteImageFromR2(
        membership.idCardPublicId,
      ),
    ]);

    /* ── Delete MongoDB record ───────────────────────── */

    await membership.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Membership deleted successfully",
    });
  } catch (error) {
    console.error("Delete Membership Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/* ─────────────────────────────────────────────────────────────
   EXPORT
───────────────────────────────────────────────────────────── */

export {
  submitMembership,
  getAllMemberships,
  getMembershipById,
  updateMembership,
  updateYoutubeLink,
  deleteMembership,
};