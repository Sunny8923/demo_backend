const multer = require("multer");
const path = require("path");

// store uploaded files temporarily
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== "text/csv") {
      return cb(new Error("Only CSV files allowed"));
    }
    cb(null, true);
  },
});

module.exports = upload;
