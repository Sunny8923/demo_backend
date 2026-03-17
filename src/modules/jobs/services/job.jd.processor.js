const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const unzipper = require("unzipper");
const pLimit = require("p-limit").default;

const jobAIParser = require("./job.ai.parser");

////////////////////////////////////////////////////////////
/// CREATE JD DIR
////////////////////////////////////////////////////////////

const jdDir = "uploads/jds";

if (!fs.existsSync(jdDir)) {
  fs.mkdirSync(jdDir, { recursive: true });
}

////////////////////////////////////////////////////////////
/// CONFIG
////////////////////////////////////////////////////////////

const limit = pLimit(process.env.AI_CONCURRENCY || 5);

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
/// ZIP EXTRACTION
////////////////////////////////////////////////////////////

async function extractZip(filePath) {
  const extractedFiles = [];

  const directory = await unzipper.Open.file(filePath);

  for (const entry of directory.files) {
    const ext = path.extname(entry.path).toLowerCase();

    if (![".pdf", ".docx", ".doc", ".txt"].includes(ext)) continue;

    const outputPath =
      jdDir + "/" + Date.now() + "-" + entry.path.replace(/[\/\\]/g, "_");

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

    // delete file after reading
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
      fullText: text, // ✅ IMPORTANT
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

    if (ext === ".zip") {
      const extracted = await extractZip(file.path);

      const parsedResults = await Promise.all(
        extracted.map((f, i) => limit(() => processSingleJD(f, index + i))),
      );

      results.push(...parsedResults);
      index += extracted.length;

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } else {
      const result = await limit(() => processSingleJD(file, index));
      results.push(result);
      index++;
    }
  }

  return { results };
}

module.exports = {
  processJobJDs,
};
