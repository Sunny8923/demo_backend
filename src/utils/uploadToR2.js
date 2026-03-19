const { PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
const r2 = require("../config/r2");

async function uploadToR2(file) {
  try {
    ////////////////////////////////////////////////////////////
    /// CREATE FILE STREAM
    ////////////////////////////////////////////////////////////
    const fileStream = fs.createReadStream(file.path);

    ////////////////////////////////////////////////////////////
    /// UNIQUE KEY (FOLDER STRUCTURE)
    ////////////////////////////////////////////////////////////
    const key = `resumes/${Date.now()}-${path.basename(file.originalname)}`;

    ////////////////////////////////////////////////////////////
    /// UPLOAD TO R2
    ////////////////////////////////////////////////////////////
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: fileStream,
        ContentType: file.mimetype,
      }),
    );

    ////////////////////////////////////////////////////////////
    /// RETURN PUBLIC URL
    ////////////////////////////////////////////////////////////
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error("R2 upload failed:", err);
    return null;
  }
}

module.exports = {
  uploadToR2,
};
