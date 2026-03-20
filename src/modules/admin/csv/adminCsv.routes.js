const express = require("express");
const router = express.Router();

const controller = require("./adminCsv.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");

const multer = require("multer");

////////////////////////////////////////////////////////////
/// MULTER (MEMORY STORAGE - NO LOCAL DISK)
////////////////////////////////////////////////////////////

const upload = multer({
  storage: multer.memoryStorage(), // ✅ FIXED
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "text/csv" && !file.originalname.endsWith(".csv")) {
      return cb(new Error("Only CSV files allowed"), false);
    }
    cb(null, true);
  },
});

router.post(
  "/upload-csv",
  authMiddleware,
  requireRole("ADMIN"),
  upload.single("file"),
  controller.uploadCSV,
);

module.exports = router;
