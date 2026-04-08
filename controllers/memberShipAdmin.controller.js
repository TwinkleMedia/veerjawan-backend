import cloudinary from "../config/cloudinary.js";
import MemberShipAdmin from "../models/MemberShipAdmin.model.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import axios from "axios";

// ── PDF Constants (top-level — accessible everywhere in this file) ────────────
const H     = 841.89;
const SIZE  = 11;
const ABOVE = 14;

// ── Date formatter → DD/MM/YYYY ───────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
};

// ── Cloudinary upload helper ──────────────────────────────────────────────────
const uploadToCloudinary = (fileDataUri, folder, publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      fileDataUri,
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: "auto",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a new member
// @route   POST /api/membershipAdmin
// ─────────────────────────────────────────────────────────────────────────────
export const createMember = async (req, res) => {
  try {
    const {
      membershipNumber, date, fullName, dob,
      address, pincode, district, state,
      mobile1, mobile2, email,
      occupation, education, maritalStatus,
      isAssociated, organizationName, briefDescription,
      photo, aadharCard, soldierIdCard,
    } = req.body;

    if (!membershipNumber || !date || !fullName || !dob || !address ||
        !pincode || !district || !state || !mobile1) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    const existing = await MemberShipAdmin.findOne({
      membershipNumber: membershipNumber.trim(),
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Membership number "${membershipNumber}" is already registered.`,
      });
    }

    const folder = `memberships/${membershipNumber.trim().replace(/\s+/g, "_")}`;

    const [photoResult, aadharResult, soldierResult] = await Promise.all([
      photo         ? uploadToCloudinary(photo,         folder, "passport_photo")  : Promise.resolve({ url: "", publicId: "" }),
      aadharCard    ? uploadToCloudinary(aadharCard,    folder, "aadhar_card")     : Promise.resolve({ url: "", publicId: "" }),
      soldierIdCard ? uploadToCloudinary(soldierIdCard, folder, "soldier_id_card") : Promise.resolve({ url: "", publicId: "" }),
    ]);

    const member = await MemberShipAdmin.create({
      membershipNumber: membershipNumber.trim(),
      date,
      fullName: fullName.trim(),
      dob,
      address: address.trim(),
      pincode: pincode.trim(),
      district: district.trim(),
      state,
      mobile1: mobile1.trim(),
      mobile2: mobile2?.trim() || "",
      email: email?.trim() || "",
      occupation: occupation?.trim() || "",
      education: education?.trim() || "",
      maritalStatus: maritalStatus || "",
      isAssociated: isAssociated || "",
      organizationName: organizationName?.trim() || "",
      briefDescription: briefDescription?.trim() || "",
      photo: photoResult,
      aadharCard: aadharResult,
      soldierIdCard: soldierResult,
    });

    return res.status(201).json({
      success: true,
      message: "Membership registered successfully.",
      data: member,
    });
  } catch (err) {
    console.error("createMember error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all members
// @route   GET /api/membershipAdmin
// ─────────────────────────────────────────────────────────────────────────────
export const getAllMembers = async (req, res) => {
  try {
    const members = await MemberShipAdmin.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: members });
  } catch (err) {
    console.error("getAllMembers error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get member by ID
// @route   GET /api/membershipAdmin/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getMemberById = async (req, res) => {
  try {
    const member = await MemberShipAdmin.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found." });
    }
    return res.status(200).json({ success: true, data: member });
  } catch (err) {
    console.error("getMemberById error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update member
// @route   PUT /api/membershipAdmin/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateMember = async (req, res) => {
  try {
    const member = await MemberShipAdmin.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found." });
    }

    const folder = `memberships/${member.membershipNumber.replace(/\s+/g, "_")}`;
    const { photo, aadharCard, soldierIdCard, ...rest } = req.body;

    const [photoResult, aadharResult, soldierResult] = await Promise.all([
      photo         ? uploadToCloudinary(photo,         folder, "passport_photo")  : Promise.resolve(null),
      aadharCard    ? uploadToCloudinary(aadharCard,    folder, "aadhar_card")     : Promise.resolve(null),
      soldierIdCard ? uploadToCloudinary(soldierIdCard, folder, "soldier_id_card") : Promise.resolve(null),
    ]);

    const updatePayload = {
      ...rest,
      ...(photoResult   && { photo: photoResult }),
      ...(aadharResult  && { aadharCard: aadharResult }),
      ...(soldierResult && { soldierIdCard: soldierResult }),
    };

    const updated = await MemberShipAdmin.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Member updated successfully.",
      data: updated,
    });
  } catch (err) {
    console.error("updateMember error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete member
// @route   DELETE /api/membershipAdmin/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteMember = async (req, res) => {
  try {
    const member = await MemberShipAdmin.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found." });
    }

    const deletePromises = [];
    const deleteAsset = (publicId) => {
      if (publicId) {
        deletePromises.push(
          cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => {})
        );
      }
    };

    deleteAsset(member.photo?.publicId);
    deleteAsset(member.aadharCard?.publicId);
    deleteAsset(member.soldierIdCard?.publicId);

    const folder = `memberships/${member.membershipNumber.replace(/\s+/g, "_")}`;
    deletePromises.push(cloudinary.api.delete_folder(folder).catch(() => {}));

    await Promise.all(deletePromises);
    await member.deleteOne();

    return res.status(200).json({ success: true, message: "Member deleted successfully." });
  } catch (err) {
    console.error("deleteMember error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Generate & download filled membership PDF
// @route   GET /api/membershipAdmin/:id/pdf
// ─────────────────────────────────────────────────────────────────────────────
export const downloadMemberPdf = async (req, res) => {
  try {
    const member = await MemberShipAdmin.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found." });
    }

    // ── Load PDF template ─────────────────────────────────────────────────────
    const pdfPath = path.join(process.cwd(), "templates", "Veer Nari_Form.pdf");
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const page  = pdfDoc.getPages()[0];
    const font  = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const BLACK = rgb(0, 0, 0);

    // ── Draw helper (uses H, SIZE, ABOVE from top-level constants) ────────────
    const draw = (text, x, underlineTop, size = SIZE) => {
      if (!text) return;
      const y = H - underlineTop - size + ABOVE;
      page.drawText(String(text), { x, y, size, font, color: BLACK });
    };

    // ── Passport photo ────────────────────────────────────────────────────────
    // ── Passport photo ────────────────────────────────────────────────────────
if (member.photo?.url) {
  try {
    const jpgUrl = member.photo.url.replace("/upload/", "/upload/f_jpg/");
    const response = await axios.get(jpgUrl, { responseType: "arraybuffer" });
    const image = await pdfDoc.embedJpg(response.data);

    // Exact box coordinates matching the form's photo box
    const boxX      = 448;   // left edge of box
    const boxY      = 568;   // bottom edge of box (PDF coords from bottom)
    const boxWidth  = 100;    // box width
    const boxHeight = 110
    ;   // box height — fills the full box now

    const dims = image.scale(1);
    const ratio = Math.min(boxWidth / dims.width, boxHeight / dims.height);
    const imgW = dims.width  * ratio;
    const imgH = dims.height * ratio;

    page.drawImage(image, {
      x: boxX + (boxWidth  - imgW) / 2,
      y: boxY + (boxHeight - imgH) / 2,
      width:  imgW,
      height: imgH,
    });
  } catch (err) {
    console.log("Photo embed failed:", err.message);
  }
}
    // ── Fill form fields ──────────────────────────────────────────────────────
    draw(member.membershipNumber,      90,  258.54);
    draw(fmtDate(member.date),        297,  258.54);

    draw(member.fullName,              84,  322.06);

    const desc = member.briefDescription || "";
    draw(desc.slice(0, 28),           326,  440.69);
    draw(desc.slice(28, 88),           28,  471.87);
    draw(desc.slice(88, 148),          28,  500.21);

    draw(member.fullName,             113,  529.13);
    draw(member.education,            412,  529.13);

    draw(member.mobile1,              108,  617.56);
    draw(member.mobile2,              354,  617.56);

    const fullAddress = `${member.address || ""}, ${member.pincode || ""}`;
    draw(fullAddress.slice(0, 62),    115,  647.07);
    draw(fullAddress.slice(62, 134),   28,  675.42);

    draw(member.district,              72,  703.77);
    draw(member.state,                354,  703.77);

    // ── Save and send ─────────────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save();
    const safeFileName = (member.fullName || "Member")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}_Membership.pdf"`);
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error("downloadMemberPdf error:", error);
    return res.status(500).json({
      success: false,
      message: "PDF generation failed.",
      error: error.message,
    });
  }
};