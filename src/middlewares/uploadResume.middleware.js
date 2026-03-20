const multer = require("multer");
const path = require("path");

////////////////////////////////////////////////////////////
/// FILE FILTER
////////////////////////////////////////////////////////////

function fileFilter(req, file, cb) {
  const allowedExtensions = [".pdf", ".doc", ".docx", ".txt", ".zip"];

  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error("Unsupported resume format"), false);
  }

  cb(null, true);
}

////////////////////////////////////////////////////////////
/// MULTER INSTANCE (MEMORY STORAGE)
////////////////////////////////////////////////////////////

const uploadResume = multer({
  storage: multer.memoryStorage(), // ✅ no local storage
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = uploadResume;
