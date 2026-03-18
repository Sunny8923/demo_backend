const express = require("express");
const router = express.Router();

const controller = require("./adminCandidate.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");

////////////////////////////////////////////////////////
// GET CANDIDATES (WITH FILTERS)
////////////////////////////////////////////////////////

router.get("/", authMiddleware, requireRole("ADMIN"), controller.getCandidates);

module.exports = router;
