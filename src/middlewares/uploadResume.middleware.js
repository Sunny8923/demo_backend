const multer = require("multer");
const path = require("path");
const fs = require("fs");

////////////////////////////////////////////////////////////
/// CREATE UPLOAD DIRECTORY
////////////////////////////////////////////////////////////

const uploadDir = path.join(__dirname, "../../../../uploads/resumes");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

////////////////////////////////////////////////////////////
/// STORAGE CONFIG
////////////////////////////////////////////////////////////

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

////////////////////////////////////////////////////////////
/// FILE FILTER
////////////////////////////////////////////////////////////

function fileFilter(req, file, cb) {
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Unsupported resume format"));
  }

  cb(null, true);
}

////////////////////////////////////////////////////////////
/// MULTER INSTANCE
////////////////////////////////////////////////////////////

const uploadResume = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = uploadResume;
