import Membership from "../models/Membership.model.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import parseMultipart from "../utils/parseMultipart.js";

// ── POST /api/membership ──────────────────────────────────────────────────────
// Submit new membership (public form — multipart/form-data)
const submitMembership = async (req, res) => {
  try {
    const { fields, files } = await parseMultipart(req);

    const {
      membershipNo, date, martyrCount, fullName,
      rank, serviceNumber, martyrdomDate, placeOfMartyrdom,
      awardsHonors = "", operationDescription = "",
      veerNariName = "", veerNariEducation = "",
      children: childrenRaw,
      fatherName, motherName,
      mobile1, mobile2 = "",
      permanentAddress, district, state,
    } = fields;

    // Validate required text fields
    const requiredTextFields = {
      membershipNo, date, martyrCount, fullName, rank,
      serviceNumber, martyrdomDate, placeOfMartyrdom,
      fatherName, motherName, mobile1, permanentAddress, district, state,
    };
    const missingFields = Object.entries(requiredTextFields)
      .filter(([, v]) => !v || String(v).trim() === "")
      .map(([k]) => k);

    if (missingFields.length > 0) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missingFields.join(", ")}` });
    }

    // Validate required files
    const missingFiles = ["photo", "aadharCard", "idCard"].filter((k) => !files[k]);
    if (missingFiles.length > 0) {
      const labels = { photo: "Passport Photo", aadharCard: "Aadhar Card", idCard: "Soldier ID Card" };
      return res.status(400).json({
        success: false,
        message: `Missing required files: ${missingFiles.map((k) => labels[k]).join(", ")}`,
      });
    }

    // Check duplicate membershipNo
    const existing = await Membership.findOne({ membershipNo: membershipNo.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Membership No. "${membershipNo}" already exists.` });
    }

    // Upload to Cloudinary — separate sub-folders per submission
    const folderBase = `membership/${membershipNo.trim()}`;
    const [passportPhotoUrl, aadharCardUrl, idCardUrl] = await Promise.all([
      uploadToCloudinary(files.photo.dataUri,      `${folderBase}/passport`, "passport_photo"),
      uploadToCloudinary(files.aadharCard.dataUri, `${folderBase}/aadhar`,   "aadhar_card"),
      uploadToCloudinary(files.idCard.dataUri,     `${folderBase}/idcard`,   "soldier_id_card"),
    ]);

    // Parse children JSON
    let children = [];
    if (childrenRaw) {
      try {
        const parsed = JSON.parse(childrenRaw);
        children = Array.isArray(parsed) ? parsed.filter(({ name, education }) => name || education) : [];
      } catch { children = []; }
    }

    // Save to DB
    const membership = await Membership.create({
      membershipNo: membershipNo.trim(), date,
      martyrCount: Number(martyrCount), fullName: fullName.trim(),
      rank, serviceNumber: serviceNumber.trim(), martyrdomDate,
      placeOfMartyrdom: placeOfMartyrdom.trim(), awardsHonors, operationDescription,
      veerNariName, veerNariEducation, children,
      fatherName: fatherName.trim(), motherName: motherName.trim(),
      mobile1: mobile1.trim(), mobile2,
      permanentAddress: permanentAddress.trim(),
      district: district.trim(), state: state.trim(),
      passportPhotoUrl, aadharCardUrl, idCardUrl,
    });

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
    console.error("submitMembership error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Membership number already exists." });
    }
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── GET /api/membership ───────────────────────────────────────────────────────
// Get all memberships (admin table)
const getAllMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find().sort({ createdAt: -1 }).select("-__v");
    return res.status(200).json({ success: true, count: memberships.length, data: memberships });
  } catch (error) {
    console.error("getAllMemberships error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── GET /api/membership/:id ───────────────────────────────────────────────────
// Get single membership
const getMembershipById = async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id).select("-__v");
    if (!membership) return res.status(404).json({ success: false, message: "Membership not found." });
    return res.status(200).json({ success: true, data: membership });
  } catch (error) {
    console.error("getMembershipById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── PUT /api/membership/:id ───────────────────────────────────────────────────
// Edit membership (admin only)
// Handles BOTH:
//   - application/json   → text fields only (no image change)
//   - multipart/form-data → text fields + optional new images
const updateMembership = async (req, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    let fields = {};
    let files  = {};

    if (contentType.includes("multipart/form-data")) {
      // New images were uploaded — parse raw multipart body
      const parsed = await parseMultipart(req);
      fields = parsed.fields;
      files  = parsed.files;
    } else {
      // No new images — body is plain JSON (already parsed by express.json middleware)
      fields = req.body;
    }

    // Allowed editable text fields
    const allowedFields = [
      "membershipNo", "date", "martyrCount", "fullName",
      "rank", "serviceNumber", "martyrdomDate", "placeOfMartyrdom",
      "awardsHonors", "operationDescription",
      "veerNariName", "veerNariEducation", "children",
      "fatherName", "motherName",
      "mobile1", "mobile2", "permanentAddress", "district", "state",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (fields[field] !== undefined) {
        // children arrives as JSON string in multipart, object in JSON body
        if (field === "children" && typeof fields[field] === "string") {
          try { updates[field] = JSON.parse(fields[field]); } catch { updates[field] = []; }
        } else {
          updates[field] = fields[field];
        }
      }
    });

    // Upload any new/changed images to Cloudinary
    // Use existing membershipNo for folder path — fall back to DB lookup if not in fields
    let membershipNo = fields.membershipNo?.trim();
    if (!membershipNo) {
      const existing = await Membership.findById(req.params.id).select("membershipNo");
      membershipNo = existing?.membershipNo;
    }
    const folderBase = `membership/${membershipNo}`;

    if (files.photo) {
      updates.passportPhotoUrl = await uploadToCloudinary(
        files.photo.dataUri, `${folderBase}/passport`, "passport_photo"
      );
    }
    if (files.aadharCard) {
      updates.aadharCardUrl = await uploadToCloudinary(
        files.aadharCard.dataUri, `${folderBase}/aadhar`, "aadhar_card"
      );
    }
    if (files.idCard) {
      updates.idCardUrl = await uploadToCloudinary(
        files.idCard.dataUri, `${folderBase}/idcard`, "soldier_id_card"
      );
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update." });
    }

    const membership = await Membership.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!membership) return res.status(404).json({ success: false, message: "Membership not found." });

    return res.status(200).json({
      success: true,
      message: "Membership updated successfully.",
      data: membership,
    });
  } catch (error) {
    console.error("updateMembership error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Membership number already exists." });
    }
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── PATCH /api/membership/:id/youtube ────────────────────────────────────────
// Add or update YouTube link (admin only)
const updateYoutubeLink = async (req, res) => {
  try {
    const { youtubeLink } = req.body;
    if (youtubeLink && !youtubeLink.includes("youtube.com") && !youtubeLink.includes("youtu.be")) {
      return res.status(400).json({ success: false, message: "Invalid YouTube URL." });
    }
    const membership = await Membership.findByIdAndUpdate(
      req.params.id,
      { $set: { youtubeLink: youtubeLink || "" } },
      { new: true }
    ).select("_id fullName membershipNo youtubeLink");

    if (!membership) return res.status(404).json({ success: false, message: "Membership not found." });

    return res.status(200).json({ success: true, message: "YouTube link updated.", data: membership });
  } catch (error) {
    console.error("updateYoutubeLink error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ── DELETE /api/membership/:id ────────────────────────────────────────────────
// Delete membership (admin only)
const deleteMembership = async (req, res) => {
  try {
    const membership = await Membership.findByIdAndDelete(req.params.id);
    if (!membership) return res.status(404).json({ success: false, message: "Membership not found." });
    return res.status(200).json({
      success: true,
      message: `Membership "${membership.membershipNo}" deleted successfully.`,
    });
  } catch (error) {
    console.error("deleteMembership error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
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