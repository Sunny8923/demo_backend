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
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // ✅ 10MB limit (adjustable)
  },
  fileFilter: (req, file, cb) => {
    const allowed =
      file.mimetype === "text/csv" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || // xlsx
      file.mimetype === "application/vnd.ms-excel" || // xls
      file.originalname.match(/\.(csv|xlsx|xls)$/);

    if (!allowed) {
      return cb(new Error("Only CSV/XLS/XLSX files allowed"), false);
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
