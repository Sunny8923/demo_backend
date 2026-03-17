const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const unzipper = require("unzipper");
const crypto = require("crypto");

const pLimit = require("p-limit").default;

const openai = require("../../../config/openai");
const prisma = require("../../../config/prisma");

const candidateService = require("../services/candidate.service");

const limit = pLimit(process.env.AI_CONCURRENCY || 5);

////////////////////////////////////////////////////////////
/// HELPERS
////////////////////////////////////////////////////////////

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function extractBasicInfo(text) {
  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const phoneMatch = text.match(/\+?\d[\d\s-]{8,15}/);

  return {
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
  };
}

function generateHash(text) {
  return crypto.createHash("md5").update(text).digest("hex");
}

////////////////////////////////////////////////////////////
/// CLEAN TEXT
////////////////////////////////////////////////////////////

function cleanResumeText(text) {
  if (!text) return "";

  return text
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/Page \d+ of \d+/gi, "")
    .replace(/[•●▪]/g, "-")
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
    console.error("PDF parsing failed:", error);
    return "";
  }
}

async function parseDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  } catch (error) {
    console.error("DOCX parsing failed:", error);
    return "";
  }
}

function parseTXT(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("TXT parsing failed:", error);
    return "";
  }
}

async function parseResume(file) {
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

    const safeName = entry.path.replace(/[\/\\]/g, "_");
    const outputPath = "uploads/resumes/" + Date.now() + "-" + safeName;

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
/// AI PARSER
////////////////////////////////////////////////////////////

async function callOpenAI(prompt) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are an expert resume parser." },
      { role: "user", content: prompt },
    ],
  });

  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch {
    return null;
  }
}

async function extractCandidateData(resumeText) {
  try {
    if (!resumeText || resumeText.length < 300) return null;

    const prompt = `Extract structured data from resume.`;

    for (let i = 0; i < 2; i++) {
      const result = await callOpenAI(prompt);
      if (result) return result;
    }

    return null;
  } catch (error) {
    console.error("AI parsing failed:", error);
    return null;
  }
}

////////////////////////////////////////////////////////////
/// PROCESS SINGLE
////////////////////////////////////////////////////////////

async function processSingleResume(file, index) {
  try {
    const rawText = await parseResume(file);
    const text = cleanResumeText(rawText);

    if (!text || text.length < 200) {
      return {
        row: index + 1,
        fileName: file.originalname,
        status: "error",
        error: "Empty resume",
      };
    }

    const hash = generateHash(text);

    const existingByHash = await prisma.candidate.findFirst({
      where: { resumeHash: hash },
    });

    if (existingByHash) {
      return {
        row: index + 1,
        fileName: file.originalname,
        status: "duplicate",
        candidateId: existingByHash.id,
      };
    }

    const basic = extractBasicInfo(text);

    if (!basic.email && !basic.phone) {
      return {
        row: index + 1,
        fileName: file.originalname,
        status: "skipped",
        reason: "No contact info",
      };
    }

    let candidateData = await extractCandidateData(text);

    if (!candidateData) {
      candidateData = {
        name: null,
        email: basic.email,
        phone: basic.phone,
      };
    }

    const result = await candidateService.createOrFindCandidate(
      candidateData,
      "ADMIN_RESUME_UPLOAD",
      {
        resumeUrl: file.path,
        resumeText: text,
        resumeHash: hash,
      },
    );

    if (!result) {
      return {
        row: index + 1,
        fileName: file.originalname,
        status: "skipped",
        reason: "Invalid candidate",
      };
    }

    return {
      row: index + 1,
      fileName: file.originalname,
      status: result.isNew ? "created" : "duplicate",
      candidateId: result.candidate.id,
    };
  } catch (error) {
    return {
      row: index + 1,
      fileName: file.originalname,
      status: "error",
      error: error.message,
    };
  }
}

////////////////////////////////////////////////////////////
/// MAIN PROCESSOR
////////////////////////////////////////////////////////////

async function processResumes(files) {
  const processed = [];

  let index = 0;

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === ".zip") {
      const extracted = await extractZip(file.path);

      const results = await Promise.all(
        extracted.map((f, i) => limit(() => processSingleResume(f, index + i))),
      );

      processed.push(...results);
      index += extracted.length;

      fs.unlinkSync(file.path);
    } else {
      const result = await limit(() => processSingleResume(file, index));

      processed.push(result);
      index++;
    }
  }

  ////////////////////////////////////////////////////////////
  /// SUMMARY
  ////////////////////////////////////////////////////////////

  const summary = {
    total: processed.length,
    created: processed.filter((r) => r.status === "created").length,
    duplicate: processed.filter((r) => r.status === "duplicate").length,
    skipped: processed.filter((r) => r.status === "skipped").length,
    error: processed.filter((r) => r.status === "error").length,
  };

  return { summary, results: processed };
}

module.exports = {
  processResumes,
};
