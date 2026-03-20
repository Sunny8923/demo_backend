const { PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
const r2 = require("../config/r2");

async function uploadToR2(file) {
  try {
    ////////////////////////////////////////////////////////////
    /// DETERMINE FILE BODY (BUFFER OR STREAM)
    ////////////////////////////////////////////////////////////
    let body;

    if (file.buffer) {
      // multer memory storage
      body = file.buffer;
    } else if (file.path) {
      // zip extracted or disk file
      body = fs.createReadStream(file.path);
    } else {
      throw new Error("Invalid file: no buffer or path");
    }

    ////////////////////////////////////////////////////////////
    /// GENERATE UNIQUE KEY
    ////////////////////////////////////////////////////////////
    const key = `resumes/${Date.now()}-${path.basename(file.originalname)}`;

    ////////////////////////////////////////////////////////////
    /// FALLBACK MIME TYPE (IMPORTANT FOR ZIP FILES)
    ////////////////////////////////////////////////////////////
    let contentType = file.mimetype;

    if (!contentType) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === ".pdf") contentType = "application/pdf";
      else if (ext === ".doc") contentType = "application/msword";
      else if (ext === ".docx")
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (ext === ".txt") contentType = "text/plain";
      else if (ext === ".zip") contentType = "application/zip";
      else contentType = "application/octet-stream";
    }

    ////////////////////////////////////////////////////////////
    /// UPLOAD TO R2
    ////////////////////////////////////////////////////////////
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    ////////////////////////////////////////////////////////////
    /// RETURN PUBLIC URL
    ////////////////////////////////////////////////////////////
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error("R2 upload failed:", err.message);
    return null;
  }
}

module.exports = {
  uploadToR2,
};
