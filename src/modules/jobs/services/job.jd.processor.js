const fs = require("fs");
const path = require("path");
const os = require("os");
const mammoth = require("mammoth");
const unzipper = require("unzipper");
const pLimit = require("p-limit").default;
const axios = require("axios");

const { uploadToR2 } = require("../../../utils/uploadToR2");
const jobAIParser = require("./job.ai.parser");

////////////////////////////////////////////////////////////
/// CONFIG
////////////////////////////////////////////////////////////

const limit = pLimit(process.env.AI_CONCURRENCY || 5);

////////////////////////////////////////////////////////////
/// DOWNLOAD R2 → TEMP FILE
////////////////////////////////////////////////////////////

async function downloadToTempFile(url, fileName) {
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);

  const res = await axios.get(url, { responseType: "stream" });

  const writer = fs.createWriteStream(tempPath);

  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return tempPath;
}

////////////////////////////////////////////////////////////
/// CLEAN TEXT
////////////////////////////////////////////////////////////

function cleanText(text) {
  if (!text) return "";

  return text
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();
}

////////////////////////////////////////////////////////////
/// PARSERS
////////////////////////////////////////////////////////////

async function parsePDF(filePath) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjs.getDocument({ data }).promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item) => item.str);
      text += strings.join(" ") + "\n";
    }

    return text;
  } catch (error) {
    console.error("JD PDF parsing failed:", error);
    return "";
  }
}

async function parseDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  } catch (error) {
    console.error("JD DOCX parsing failed:", error);
    return "";
  }
}

function parseTXT(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("JD TXT parsing failed:", error);
    return "";
  }
}

async function parseJDFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".pdf") return await parsePDF(file.path);
  if (ext === ".docx" || ext === ".doc") return await parseDOCX(file.path);
  if (ext === ".txt") return parseTXT(file.path);

  return "";
}

////////////////////////////////////////////////////////////
/// ZIP EXTRACTION (TEMP FILES)
////////////////////////////////////////////////////////////

async function extractZip(filePath) {
  const extractedFiles = [];

  const directory = await unzipper.Open.file(filePath);

  for (const entry of directory.files) {
    const ext = path.extname(entry.path).toLowerCase();

    if (![".pdf", ".docx", ".doc", ".txt"].includes(ext)) continue;

    const safeName = entry.path.replace(/[\/\\]/g, "_");

    const outputPath = path.join(os.tmpdir(), `${Date.now()}-${safeName}`);

    await new Promise((resolve, reject) => {
      entry
        .stream()
        .pipe(fs.createWriteStream(outputPath))
        .on("finish", resolve)
        .on("error", reject);
    });

    extractedFiles.push({
      originalname: entry.path,
      path: outputPath,
    });
  }

  return extractedFiles;
}

////////////////////////////////////////////////////////////
/// PROCESS SINGLE JD
////////////////////////////////////////////////////////////

async function processSingleJD(file, index) {
  try {
    const rawText = await parseJDFile(file);
    const text = cleanText(rawText);

    // cleanup
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    if (!text || text.length < 200) {
      return {
        index,
        fileName: file.originalname,
        status: "error",
        error: "Empty or invalid JD",
      };
    }

    const parsed = await jobAIParser.parseJobFromText(text);

    if (!parsed) {
      return {
        index,
        fileName: file.originalname,
        status: "error",
        error: "AI parsing failed",
      };
    }

    return {
      index,
      fileName: file.originalname,
      status: "parsed",
      data: parsed,
      rawTextPreview: text.slice(0, 2000),
      fullText: text,
    };
  } catch (error) {
    return {
      index,
      fileName: file.originalname,
      status: "error",
      error: error.message,
    };
  }
}

////////////////////////////////////////////////////////////
/// MAIN PROCESSOR
////////////////////////////////////////////////////////////

async function processJobJDs(files) {
  const results = [];
  let index = 0;

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();

    //////////////////////////////////////////////////////
    // UPLOAD → R2
    //////////////////////////////////////////////////////
    const r2Url = await uploadToR2(file);

    if (!r2Url) {
      results.push({
        index,
        fileName: file.originalname,
        status: "error",
        error: "R2 upload failed",
      });
      index++;
      continue;
    }

    const tempPath = await downloadToTempFile(r2Url, file.originalname);

    try {
      //////////////////////////////////////////////////////
      // ZIP FILE
      //////////////////////////////////////////////////////
      if (ext === ".zip") {
        const extracted = await extractZip(tempPath);

        const parsedResults = await Promise.all(
          extracted.map((f, i) => limit(() => processSingleJD(f, index + i))),
        );

        results.push(...parsedResults);
        index += extracted.length;

        // cleanup extracted
        for (const f of extracted) {
          try {
            fs.unlinkSync(f.path);
          } catch {}
        }
      }

      //////////////////////////////////////////////////////
      // NORMAL FILE
      //////////////////////////////////////////////////////
      else {
        const result = await limit(() =>
          processSingleJD(
            {
              originalname: file.originalname,
              path: tempPath,
            },
            index,
          ),
        );

        results.push(result);
        index++;
      }
    } catch (err) {
      console.error("JD processing error:", err.message);
    }

    //////////////////////////////////////////////////////
    // CLEANUP MAIN TEMP FILE
    //////////////////////////////////////////////////////
    try {
      fs.unlinkSync(tempPath);
    } catch {}
  }

  return { results };
}

////////////////////////////////////////////////////////////

module.exports = {
  processJobJDs,
};
