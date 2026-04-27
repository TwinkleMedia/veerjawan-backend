import express from "express";
import {
  uploadCertificate,
  getAllCertificates,
  deleteCertificate,
  updateCertificate

} from "../controllers/certificate.controller.js";

const router = express.Router();

// POST  /api/upload-certificate   — upload a new certificate
router.post("/upload-certificate", uploadCertificate);

// GET   /api/certificates         — fetch all certificates
router.get("/certificates", getAllCertificates);

// PUT /api/certificates/:id
router.put("/certificates/:id", updateCertificate);

// DELETE /api/certificates/:id  
router.delete("/certificates/:id", deleteCertificate);

export default router;