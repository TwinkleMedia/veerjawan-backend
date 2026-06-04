import Membership from "../models/Membership.model.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import parseMultipart from "../utils/parseMultipart.js";
import cloudinary from "../config/cloudinary.js";

// ── Helper: human-readable byte size ─────────────────────────────────────────
const toKB = (dataUri = "") =>
  ((dataUri.length * 0.75) / 1024).toFixed(0) + " KB";

// ── POST /api/membership ──────────────────────────────────────────────────────
const submitMembership = async (req, res) => {
  console.log("[submitMembership] ── Request received ──────────────────────");
  try {
    // ── 1. Parse multipart ──────────────────────────────────────────────────
    console.log("[submitMembership] Step 1: Parsing multipart...");
    const { fields, files } = await parseMultipart(req);
    console.log("[submitMembership] Fields received:", Object.keys(fields));
    console.log("[submitMembership] Files received:", Object.keys(files));
    console.log(
      "[submitMembership] Approximate file sizes:",
      Object.fromEntries(
        Object.entries(files).map(([k, v]) => [k, toKB(v.dataUri)])
      )
    );

    // ── 2. Destructure fields ───────────────────────────────────────────────
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
      children: childrenRaw,
      fatherName,
      motherName,
      mobile1,
      mobile2 = "",
      permanentAddress,
      district,
      state,
    } = fields;

    // ── 3. Validate required text fields ───────────────────────────────────
    console.log("[submitMembership] Step 3: Validating required text fields...");
    const requiredTextFields = {
      membershipNo,
      date,
      martyrCount,
      fullName,
      rank,
      serviceNumber,
      martyrdomDate,
      placeOfMartyrdom,
      fatherName,
      motherName,
      mobile1,
      permanentAddress,
      district,
      state,
    };
    const missingFields = Object.entries(requiredTextFields)
      .filter(([, v]) => !v || String(v).trim() === "")
      .map(([k]) => k);

    if (missingFields.length > 0) {
      console.warn("[submitMembership] Missing text fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }
    console.log("[submitMembership] Text fields OK.");

    // ── 4. Validate required files ─────────────────────────────────────────
    console.log("[submitMembership] Step 4: Validating required files...");
    const missingFiles = ["photo", "aadharCard", "idCard"].filter(
      (k) => !files[k]
    );
    if (missingFiles.length > 0) {
      const labels = {
        photo: "Passport Photo",
        aadharCard: "Aadhar Card",
        idCard: "Soldier ID Card",
      };
      console.warn("[submitMembership] Missing files:", missingFiles);
      return res.status(400).json({
        success: false,
        message: `Missing required files: ${missingFiles
          .map((k) => labels[k])
          .join(", ")}`,
      });
    }
    console.log("[submitMembership] Files OK.");

    // ── 5. Check duplicate membershipNo ────────────────────────────────────
    console.log(
      "[submitMembership] Step 5: Checking duplicate membershipNo:",
      membershipNo.trim()
    );
    const existing = await Membership.findOne({
      membershipNo: membershipNo.trim(),
    });
    if (existing) {
      console.warn(
        "[submitMembership] Duplicate membershipNo found:",
        membershipNo
      );
      return res.status(409).json({
        success: false,
        message: `Membership No. "${membershipNo}" already exists.`,
      });
    }
    console.log("[submitMembership] membershipNo is unique.");

    // ── 6. Upload to Cloudinary ─────────────────────────────────────────────
    console.log("[submitMembership] Step 6: Uploading files to Cloudinary...");
    const folderBase = `membership/${membershipNo.trim()}`;

    let photoResult, aadharResult, idCardResult;
    try {
      [photoResult, aadharResult, idCardResult] = await Promise.all([
        uploadToCloudinary(
          files.photo.dataUri,
          `${folderBase}/passport`,
          "passport_photo"
        ),
        uploadToCloudinary(
          files.aadharCard.dataUri,
          `${folderBase}/aadhar`,
          "aadhar_card"
        ),
        uploadToCloudinary(
          files.idCard.dataUri,
          `${folderBase}/idcard`,
          "soldier_id_card"
        ),
      ]);
      console.log("[submitMembership] Cloudinary upload success:", {
        photo: photoResult.url,
        aadhar: aadharResult.url,
        idCard: idCardResult.url,
      });
    } catch (uploadErr) {
      console.error(
        "[submitMembership] Cloudinary upload FAILED:",
        uploadErr?.message || uploadErr
      );
      return res.status(500).json({
        success: false,
        message: "File upload failed. Please try again.",
      });
    }

    // ── 7. Parse children JSON ──────────────────────────────────────────────
    console.log("[submitMembership] Step 7: Parsing children...");
    let children = [];
    if (childrenRaw) {
      try {
        const parsed = JSON.parse(childrenRaw);
        children = Array.isArray(parsed)
          ? parsed.filter(({ name, education }) => name || education)
          : [];
      } catch (parseErr) {
        console.warn(
          "[submitMembership] Failed to parse children JSON — defaulting to []:",
          parseErr?.message
        );
        children = [];
      }
    }
    console.log("[submitMembership] Children count:", children.length);

    // ── 8. Save to DB ───────────────────────────────────────────────────────
    console.log("[submitMembership] Step 8: Saving to database...");
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
      children,
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      mobile1: mobile1.trim(),
      mobile2,
      permanentAddress: permanentAddress.trim(),
      district: district.trim(),
      state: state.trim(),
      passportPhotoUrl: photoResult.url,
      passportPhotoPublicId: photoResult.publicId,
      aadharCardUrl: aadharResult.url,
      aadharCardPublicId: aadharResult.publicId,
      idCardUrl: idCardResult.url,
      idCardPublicId: idCardResult.publicId,
    });
    console.log(
      "[submitMembership] Saved to DB. _id:",
      membership._id,
      "| membershipNo:",
      membership.membershipNo
    );

    // ── 9. Respond ──────────────────────────────────────────────────────────
    console.log("[submitMembership] ── Done (201) ──────────────────────────");
    return res.status(201).json({
      success: true,
      message: "Membership application submitted successfully.",
      data: {
        id: membership._id,
        membershipNo: membership.membershipNo,
        passportPhotoUrl: membership.passportPhotoUrl,
        aadharCardUrl: membership.aadharCardUrl,
        idCardUrl: membership.idCardUrl,
      },
    });
  } catch (error) {
    console.error("[submitMembership] Unhandled ERROR:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Membership number already exists.",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

// ── GET /api/membership ───────────────────────────────────────────────────────
const getAllMemberships = async (req, res) => {
  console.log("[getAllMemberships] Request received");
  try {
    const memberships = await Membership.find()
      .sort({ createdAt: -1 })
      .select("-__v");
    console.log("[getAllMemberships] Returning", memberships.length, "records");
    return res.status(200).json({
      success: true,
      count: memberships.length,
      data: memberships,
    });
  } catch (error) {
    console.error("[getAllMemberships] ERROR:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

// ── GET /api/membership/:id ───────────────────────────────────────────────────
const getMembershipById = async (req, res) => {
  console.log("[getMembershipById] id:", req.params.id);
  try {
    const membership = await Membership.findById(req.params.id).select("-__v");
    if (!membership) {
      console.warn("[getMembershipById] Not found:", req.params.id);
      return res
        .status(404)
        .json({ success: false, message: "Membership not found." });
    }
    console.log("[getMembershipById] Found:", membership.membershipNo);
    return res.status(200).json({ success: true, data: membership });
  } catch (error) {
    console.error("[getMembershipById] ERROR:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

// ── PUT /api/membership/:id ───────────────────────────────────────────────────
const updateMembership = async (req, res) => {
  console.log("[updateMembership] id:", req.params.id);
  try {
    const contentType = req.headers["content-type"] || "";
    let fields = {};
    let files = {};

    if (contentType.includes("multipart/form-data")) {
      console.log("[updateMembership] Parsing multipart...");
      const parsed = await parseMultipart(req);
      fields = parsed.fields;
      files = parsed.files;
    } else {
      console.log("[updateMembership] Using JSON body");
      fields = req.body;
    }

    console.log("[updateMembership] Fields to update:", Object.keys(fields));
    console.log("[updateMembership] Files to update:", Object.keys(files));

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
      "children",
      "fatherName",
      "motherName",
      "mobile1",
      "mobile2",
      "permanentAddress",
      "district",
      "state",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (fields[field] !== undefined) {
        if (field === "children" && typeof fields[field] === "string") {
          try {
            updates[field] = JSON.parse(fields[field]);
          } catch {
            updates[field] = [];
          }
        } else {
          updates[field] = fields[field];
        }
      }
    });

    let membershipNo = fields.membershipNo?.trim();
    if (!membershipNo) {
      const existing = await Membership.findById(req.params.id).select(
        "membershipNo"
      );
      membershipNo = existing?.membershipNo;
    }
    const folderBase = `membership/${membershipNo}`;

    if (files.photo) {
      console.log("[updateMembership] Uploading new passport photo...");
      const result = await uploadToCloudinary(
        files.photo.dataUri,
        `${folderBase}/passport`,
        "passport_photo"
      );
      updates.passportPhotoUrl = result.url;
      updates.passportPhotoPublicId = result.publicId;
      console.log("[updateMembership] New passport photo URL:", result.url);
    }
    if (files.aadharCard) {
      console.log("[updateMembership] Uploading new aadhar card...");
      const result = await uploadToCloudinary(
        files.aadharCard.dataUri,
        `${folderBase}/aadhar`,
        "aadhar_card"
      );
      updates.aadharCardUrl = result.url;
      updates.aadharCardPublicId = result.publicId;
      console.log("[updateMembership] New aadhar card URL:", result.url);
    }
    if (files.idCard) {
      console.log("[updateMembership] Uploading new ID card...");
      const result = await uploadToCloudinary(
        files.idCard.dataUri,
        `${folderBase}/idcard`,
        "soldier_id_card"
      );
      updates.idCardUrl = result.url;
      updates.idCardPublicId = result.publicId;
      console.log("[updateMembership] New ID card URL:", result.url);
    }

    if (Object.keys(updates).length === 0) {
      console.warn("[updateMembership] No valid fields to update");
      return res.status(400).json({
        success: false,
        message: "No valid fields to update.",
      });
    }

    const membership = await Membership.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!membership) {
      console.warn("[updateMembership] Not found:", req.params.id);
      return res
        .status(404)
        .json({ success: false, message: "Membership not found." });
    }

    console.log("[updateMembership] Updated successfully:", membership.membershipNo);
    return res.status(200).json({
      success: true,
      message: "Membership updated successfully.",
      data: membership,
    });
  } catch (error) {
    console.error("[updateMembership] ERROR:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Membership number already exists.",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

// ── PATCH /api/membership/:id/youtube ────────────────────────────────────────
const updateYoutubeLink = async (req, res) => {
  console.log("[updateYoutubeLink] id:", req.params.id, "| link:", req.body?.youtubeLink);
  try {
    const { youtubeLink } = req.body;
    if (
      youtubeLink &&
      !youtubeLink.includes("youtube.com") &&
      !youtubeLink.includes("youtu.be")
    ) {
      console.warn("[updateYoutubeLink] Invalid YouTube URL:", youtubeLink);
      return res
        .status(400)
        .json({ success: false, message: "Invalid YouTube URL." });
    }

    const membership = await Membership.findByIdAndUpdate(
      req.params.id,
      { $set: { youtubeLink: youtubeLink || "" } },
      { new: true }
    ).select("_id fullName membershipNo youtubeLink");

    if (!membership) {
      console.warn("[updateYoutubeLink] Not found:", req.params.id);
      return res
        .status(404)
        .json({ success: false, message: "Membership not found." });
    }

    console.log("[updateYoutubeLink] Updated for:", membership.membershipNo);
    return res.status(200).json({
      success: true,
      message: "YouTube link updated.",
      data: membership,
    });
  } catch (error) {
    console.error("[updateYoutubeLink] ERROR:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

// ── DELETE /api/membership/:id ────────────────────────────────────────────────
const deleteMembership = async (req, res) => {
  console.log("[deleteMembership] id:", req.params.id);
  try {
    const membership = await Membership.findById(req.params.id);
    if (!membership) {
      console.warn("[deleteMembership] Not found:", req.params.id);
      return res
        .status(404)
        .json({ success: false, message: "Membership not found." });
    }

    console.log(
      "[deleteMembership] Deleting Cloudinary assets for:",
      membership.membershipNo
    );
    await Promise.all([
      membership.passportPhotoPublicId
        ? cloudinary.uploader
            .destroy(membership.passportPhotoPublicId)
            .catch((e) =>
              console.warn(
                "[deleteMembership] Could not delete passportPhoto from Cloudinary:",
                e?.message
              )
            )
        : Promise.resolve(),
      membership.aadharCardPublicId
        ? cloudinary.uploader
            .destroy(membership.aadharCardPublicId)
            .catch((e) =>
              console.warn(
                "[deleteMembership] Could not delete aadharCard from Cloudinary:",
                e?.message
              )
            )
        : Promise.resolve(),
      membership.idCardPublicId
        ? cloudinary.uploader
            .destroy(membership.idCardPublicId)
            .catch((e) =>
              console.warn(
                "[deleteMembership] Could not delete idCard from Cloudinary:",
                e?.message
              )
            )
        : Promise.resolve(),
    ]);

    await membership.deleteOne();

    console.log(
      "[deleteMembership] Deleted successfully:",
      membership.membershipNo
    );
    return res.status(200).json({
      success: true,
      message: `Membership "${membership.membershipNo}" deleted successfully.`,
    });
  } catch (error) {
    console.error("[deleteMembership] ERROR:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

export {
  submitMembership,
  getAllMemberships,
  getMembershipById,
  updateMembership,
  updateYoutubeLink,
  deleteMembership,
};