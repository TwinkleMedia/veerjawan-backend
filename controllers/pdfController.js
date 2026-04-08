import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import axios from "axios"; // ✅ NEW
import Membership from "../models/Membership.model.js";

const H = 841.89;
const SIZE = 12;
const ABOVE = 14;

export const downloadMemberPdf = async (req, res) => {
  try {
    const member = await Membership.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // ── Load PDF Template ─────────────────────────────
    const pdfPath = path.join(process.cwd(), "templates", "Veer Nari_Form.pdf");
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const page = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const BLACK = rgb(0, 0, 0);

    // ── Draw function ─────────────────────────────────
    const draw = (text, x, underlineTop, size = SIZE) => {
      if (!text) return;
      const y = H - underlineTop - size + ABOVE;
      page.drawText(String(text), { x, y, size, font, color: BLACK });
    };

    // ─────────────────────────────────────────────────
    // 🖼️ PROFILE PHOTO FROM CLOUDINARY (FINAL FIX)
    // ─────────────────────────────────────────────────
    if (member.passportPhotoUrl) {
      try {
        const response = await axios.get(member.passportPhotoUrl, {
          responseType: "arraybuffer",
        });

        const imageBytes = response.data;

        let image;

        // Some Cloudinary URLs don’t have extension → default JPG
        if (member.passportPhotoUrl.toLowerCase().includes(".png")) {
          image = await pdfDoc.embedPng(imageBytes);
        } else {
          image = await pdfDoc.embedJpg(imageBytes);
        }

        // 🎯 Exact box alignment
        const boxWidth = 100;
        const boxHeight = 90;

        const x = 450; // move right
        const y = H - 190 - boxHeight; // move up

        // Maintain aspect ratio
        const dims = image.scale(1);
        const ratio = Math.min(boxWidth / dims.width, boxHeight / dims.height);

        const imgWidth = dims.width * ratio;
        const imgHeight = dims.height * ratio;

        page.drawImage(image, {
          x: x + (boxWidth - imgWidth) / 2,
          y: y + (boxHeight - imgHeight) / 2,
          width: imgWidth,
          height: imgHeight,
        });
      } catch (err) {
        console.log("❌ Image load failed:", err.message);
      }
    }

    // ───────── DRAW DATA ─────────

    draw(member.membershipNo, 90, 258.54);
    draw(member.date, 297, 258.54);

    draw(member.martyrCount?.toString(), 221, 295.39);

    draw(member.fullName, 84, 322.06);

    draw(member.rank, 195, 351.91);
    draw(member.serviceNumber, 412, 351.91);

    draw(member.placeOfMartyrdom, 142, 380.92);
    draw(member.martyrdomDate, 412, 380.92);

    draw(member.awardsHonors, 170, 411.18);

    const op = member.operationDescription || "";
    draw(op.slice(0, 28), 326, 440.69);
    draw(op.slice(28, 88), 28, 471.87);
    draw(op.slice(88, 148), 28, 500.21);

    draw(member.veerNariName, 113, 529.13);
    draw(member.veerNariEducation, 412, 529.13);

    const children = member.children || [];
    const [c1, c2, c3, c4] = children;

    if (c1?.name)
      draw(
        `${c1.name}${c1.education ? ` (${c1.education})` : ""}`,
        108,
        558.55,
      );
    if (c2?.name)
      draw(
        `${c2.name}${c2.education ? ` (${c2.education})` : ""}`,
        354,
        558.55,
      );
    if (c3?.name) draw(`३) ${c3.name}`, 108, 543);
    if (c4?.name) draw(`४) ${c4.name}`, 310, 543);

    draw(member.fatherName, 122, 588.06);
    draw(member.motherName, 398, 588.06);

    draw(member.mobile1, 108, 617.56);
    draw(member.mobile2, 354, 617.56);

    const addr = member.permanentAddress || "";
    draw(addr.slice(0, 62), 115, 647.07);
    draw(addr.slice(62, 134), 28, 675.42);

    draw(member.district, 72, 703.77);
    draw(member.state, 354, 703.77);

    // ── Save PDF ──────────────────────────────────────
    const pdfBytes = await pdfDoc.save();

    const safeFileName = (member.fullName || "VeerNariForm")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFileName}.pdf"`,
    );
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("PDF generation error:", error);
    res
      .status(500)
      .json({ message: "PDF generation failed", error: error.message });
  }
};
