const express = require("express");
const router = express.Router();

const controller = require("./adminCandidate.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");

////////////////////////////////////////////////////////
// GET CANDIDATES (LIST)
////////////////////////////////////////////////////////

router.get("/", authMiddleware, requireRole("ADMIN"), controller.getCandidates);

////////////////////////////////////////////////////////
// GET SINGLE CANDIDATE
////////////////////////////////////////////////////////

router.get(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  controller.getCandidateById,
);

module.exports = router;
