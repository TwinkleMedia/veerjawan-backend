import cloudinary from "../config/cloudinary.js";
import MemberShipAdmin from "../models/MemberShipAdmin.model.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import axios from "axios";

// ── PDF Constants ─────────────────────────────────────────────────────────────
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
// @desc    Register a new volunteer member
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
  passportPhoto,
  aadharCard,
  panCard,
} = req.body;

    // ── Required field validation ─────────────────────────────────────────────
    if (!membershipNumber || !date || !fullName || !dob ||
        !address || !pincode || !district || !state || !mobile1) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    // ── Duplicate membership number check ─────────────────────────────────────
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

    // ── Upload documents to Cloudinary ────────────────────────────────────────
  const [passportResult, aadharResult, panResult] = await Promise.all([
  passportPhoto
    ? uploadToCloudinary(passportPhoto, folder, "passport_photo")
    : Promise.resolve({ url: "", publicId: "" }),

  aadharCard
    ? uploadToCloudinary(aadharCard, folder, "aadhar_card")
    : Promise.resolve({ url: "", publicId: "" }),

  panCard
    ? uploadToCloudinary(panCard, folder, "pan_card")
    : Promise.resolve({ url: "", publicId: "" }),
]);

    const member = await MemberShipAdmin.create({
      membershipNumber:  membershipNumber.trim(),
      date,
      fullName:          fullName.trim(),
      dob,
      address:           address.trim(),
      pincode:           pincode.trim(),
      district:          district.trim(),
      state,
      mobile1:           mobile1.trim(),
      mobile2:           mobile2?.trim()           || "",
      email:             email?.trim()             || "",
      occupation:        occupation?.trim()        || "",
      education:         education?.trim()         || "",
      maritalStatus:     maritalStatus             || "",
      isAssociated:      isAssociated              || "",
      organizationName:  organizationName?.trim()  || "",
      briefDescription:  briefDescription?.trim()  || "",
      aadharCard:        aadharResult,
      passportPhoto:    passportResult,
      panCard:           panResult,
    });

    return res.status(201).json({
      success: true,
      message: "Volunteer registered successfully.",
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
    const { aadharCard, panCard, passportPhoto, ...rest } = req.body; // ← extract passportPhoto

    const [aadharResult, panResult, passportResult] = await Promise.all([
      aadharCard    ? uploadToCloudinary(aadharCard,    folder, "aadhar_card")    : Promise.resolve(null),
      panCard       ? uploadToCloudinary(panCard,       folder, "pan_card")       : Promise.resolve(null),
      passportPhoto ? uploadToCloudinary(passportPhoto, folder, "passport_photo") : Promise.resolve(null), // ← add this
    ]);

    const updatePayload = {
      ...rest,
      ...(aadharResult    && { aadharCard:    aadharResult }),
      ...(panResult       && { panCard:       panResult }),
      ...(passportResult  && { passportPhoto: passportResult }), // ← add this
    };

    const updated = await MemberShipAdmin.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, message: "Member updated successfully.", data: updated });
  } catch (err) {
    console.error("updateMember error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete member + Cloudinary assets
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

    deleteAsset(member.aadharCard?.publicId);
    deleteAsset(member.panCard?.publicId);

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
    if (!member) return res.status(404).json({ success: false, message: "Member not found." });

    const pdfPath = path.join(process.cwd(), "templates", "VJG_MembershipForm.pdf");
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const page  = pdfDoc.getPages()[0];
    const font  = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const BLACK = rgb(0, 0, 0);

    const H     = 841.89;
    const SIZE  = 10;
    const ABOVE = 13;

    const draw = (text, x, underlineTop, size = SIZE) => {
      if (!text) return;
      const y = H - underlineTop - size + ABOVE;
      page.drawText(String(text), { x, y, size, font, color: BLACK });
    };

    const trunc = (str, maxChars) => (str || "").slice(0, maxChars);

    const fmtDate = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      if (isNaN(dt)) return String(d);
      return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
    };

    // ── Passport Photo ─────────────────────────────────────────────────────────
    // Box in PDF: x=448.2, y_bottom=556.6, width=99.2, height=127.5 (pdf-lib coords)
   // ── Passport Photo ─────────────────────────────────────────────────────────
if (member.passportPhoto?.url) {
  try {
    let photoUrl = member.passportPhoto.url;
    if (photoUrl.includes("cloudinary.com")) {
      photoUrl = photoUrl.replace("/upload/", "/upload/f_jpg,q_90/");
    }

    const response = await axios.get(photoUrl, {
      responseType: "arraybuffer",
    });

    // ✅ THE FIX: convert ArrayBuffer → Buffer so pdf-lib can read it
    const imageBytes = Buffer.from(response.data);

    // Check actual magic bytes to decide format
    const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8;
    const isPng  = imageBytes[0] === 0x89 && imageBytes[1] === 0x50;

    let image;
    if (isPng) {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (isJpeg) {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      console.log("❌ Unknown format, first bytes:", imageBytes.slice(0, 4).toString("hex"));
      throw new Error("Unsupported image format");
    }

    const boxWidth  = 99.2;
    const boxHeight = 127.5;
    const x = 448.2;
    const y = H - 285.3;

    const dims  = image.scale(1);
    const ratio = Math.min(boxWidth / dims.width, boxHeight / dims.height);

    page.drawImage(image, {
      x: x + (boxWidth  - dims.width  * ratio) / 2,
      y: y + (boxHeight - dims.height * ratio) / 2,
      width:  dims.width  * ratio,
      height: dims.height * ratio,
    });

  } catch (err) {
    console.log("❌ Passport photo load failed:", err.message);
  }
}
    // Row 1 — Membership number & Date
    draw(trunc(member.membershipNumber, 20),     89,  258.5);
    draw(fmtDate(member.date),                  296,  258.5);

    // Row 2 — Full name
    draw(trunc(member.fullName, 40),            140,  285.2);

    // Row 3 — DOB
    draw(fmtDate(member.dob),                   390,  315.1);

    // Row 4 & 5 — Address (split across 2 lines)
    const fullAddress = `${member.address || ""}, ${member.pincode || ""}`;
    draw(trunc(fullAddress, 55),                113,  344.1);
    if (fullAddress.length > 55) {
      draw(trunc(fullAddress.slice(55), 70),     28,  372.4);
    }

    // Row 6 — Pincode
    draw(trunc(member.pincode, 15),             376,  400.8);

    // Row 7 — District & State
    draw(trunc(member.district, 28),             71,  435.0);
    draw(trunc(member.state, 20),               353,  435.0);

    // Row 8 — Mobile 1 & Mobile 2
    draw(trunc(member.mobile1, 18),             107,  469.3);
    draw(trunc(member.mobile2 || "", 18),       353,  469.3);

    // Row 9 — Email
    draw(trunc(member.email || "", 50),          64,  498.7);

    // Row 10 — Occupation
    draw(trunc(member.occupation || "", 50),     76,  528.2);

    // Row 11 — Education & Marital status
    draw(trunc(member.education || "", 28),      70,  557.7);
    draw(trunc(member.maritalStatus || "", 14), 424,  557.7);

    // Row 12 — Is associated with other org?
    draw(trunc(member.isAssociated || "", 30),  246,  587.2);

    // Row 13 — Organization name (only if associated)
    if (member.isAssociated === "Yes") {
      draw(trunc(member.organizationName || "", 55), 77, 616.7);
    }

    // Row 14 & 15 — Brief description (split across 2 lines)
    const desc = member.briefDescription || "";
    draw(trunc(desc, 52),                       119,  643.9);
    draw(trunc(desc.slice(52), 70),              28,  671.1);

    // ── Save and send ──────────────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save();
    const safeFileName = (member.fullName || "Member")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}_Volunteer.pdf"`);
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error("downloadMemberPdf error:", error);
    return res.status(500).json({ success: false, message: "PDF generation failed.", error: error.message });
  }
};
