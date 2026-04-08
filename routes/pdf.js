import express from  "express"
import { downloadMemberPdf } from "../controllers/pdfController.js"

const router = express.Router();

// generate pdf
router.get("/generate-pdf/:id",downloadMemberPdf);

export default router;
