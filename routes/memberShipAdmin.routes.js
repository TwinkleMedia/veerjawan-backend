import express from "express";
import {
  createMember,
  getAllMembers,
  getMemberById,
  updateMember,
  deleteMember,
  downloadMemberPdf,

} from "../controllers/memberShipAdmin.controller.js";

const router = express.Router();

router.post("/",      createMember);   // POST   /api/membership
router.get("/",       getAllMembers);  // GET    /api/membership
router.get("/:id/pdf", downloadMemberPdf); // GET /api/membershipAdmin/:id/pdf
router.get("/:id",    getMemberById); // GET    /api/membership/:id
router.put("/:id",    updateMember);  // PUT    /api/membership/:id
router.delete("/:id", deleteMember); // DELETE /api/membership/:id
export default router;