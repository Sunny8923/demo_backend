const { Storage } = require("@google-cloud/storage");
const vision = require("@google-cloud/vision");

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");

const storage = new Storage({ credentials });
const visionClient = new vision.ImageAnnotatorClient({ credentials });

const bucketName = process.env.GCS_BUCKET;
const bucket = storage.bucket(bucketName);

///////////////////////////////////////////////////////////
/// 1. Upload PDF to GCS
///////////////////////////////////////////////////////////
async function uploadToGCS(localPath, fileName) {
  const destination = `uploads/${Date.now()}-${fileName}`;

  await bucket.upload(localPath, {
    destination,
  });

  return `gs://${bucketName}/${destination}`;
}

///////////////////////////////////////////////////////////
/// 2. Run Async OCR
///////////////////////////////////////////////////////////
async function runVisionOCR(gcsUri) {
  const outputPrefix = `output/${Date.now()}/`;

  const request = {
    requests: [
      {
        inputConfig: {
          gcsSource: { uri: gcsUri },
          mimeType: "application/pdf",
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        outputConfig: {
          gcsDestination: {
            uri: `gs://${bucketName}/${outputPrefix}`,
          },
          batchSize: 1,
        },
      },
    ],
  };

  const [operation] = await visionClient.asyncBatchAnnotateFiles(request);

  await operation.promise();

  return outputPrefix;
}

///////////////////////////////////////////////////////////
/// 3. Read OCR Output
///////////////////////////////////////////////////////////
async function readVisionOutput(outputPrefix) {
  const [files] = await bucket.getFiles({
    prefix: outputPrefix,
  });

  let fullText = "";

  for (const file of files) {
    const [content] = await file.download();
    const json = JSON.parse(content.toString());

    json.responses.forEach((res) => {
      if (res.fullTextAnnotation?.text) {
        fullText += res.fullTextAnnotation.text + "\n";
      }
    });
  }

  return fullText;
}

///////////////////////////////////////////////////////////
/// 4. MAIN FUNCTION (USE THIS)
///////////////////////////////////////////////////////////
async function extractTextFromPDF(filePath, fileName) {
  try {
    const gcsUri = await uploadToGCS(filePath, fileName);

    const outputPrefix = await runVisionOCR(gcsUri);

    const text = await readVisionOutput(outputPrefix);

    try {
      await cleanupFiles(gcsUri, outputPrefix);
    } catch (e) {
      console.warn("Cleanup skipped");
    } // 🔥 ADD THIS

    return text;
  } catch (err) {
    console.error("Vision Async OCR failed:", err.message);
    return "";
  }
}

async function cleanupFiles(gcsUri, outputPrefix) {
  try {
    const filePath = gcsUri.replace(`gs://${bucketName}/`, "");

    // delete uploaded PDF
    await bucket
      .file(filePath)
      .delete()
      .catch(() => {});

    // delete output files
    const [files] = await bucket.getFiles({ prefix: outputPrefix });

    await Promise.all(files.map((f) => f.delete().catch(() => {})));
  } catch (err) {
    console.warn("Cleanup failed:", err.message);
  }
}

module.exports = {
  extractTextFromPDF,
};
