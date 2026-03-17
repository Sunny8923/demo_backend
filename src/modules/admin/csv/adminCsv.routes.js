const express = require("express");
const router = express.Router();

const controller = require("./adminCsv.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");

const multer = require("multer");

const upload = multer({ dest: "uploads/csv/" });

router.post(
  "/upload-csv",
  authMiddleware,
  requireRole("ADMIN"),
  upload.single("file"),
  controller.uploadCSV,
);

module.exports = router;
