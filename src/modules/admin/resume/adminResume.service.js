const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const unzipper = require("unzipper");

const pLimit = require("p-limit").default;

const openai = require("../../../config/openai");
const prisma = require("../../../config/prisma");

const limit = pLimit(5);

////////////////////////////////////////////////////////////
/// CLEAN RESUME TEXT
////////////////////////////////////////////////////////////

function cleanResumeText(text) {
  if (!text) return "";

  return text
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\t/g, " ")
    .replace(/Page \d+ of \d+/gi, "")
    .replace(/[•●▪]/g, "-")
    .trim();
}

////////////////////////////////////////////////////////////
/// PDF PARSER
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

////////////////////////////////////////////////////////////
/// DOCX PARSER
////////////////////////////////////////////////////////////

async function parseDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  } catch (error) {
    console.error("DOCX parsing failed:", error);
    return "";
  }
}

////////////////////////////////////////////////////////////
/// TXT PARSER
////////////////////////////////////////////////////////////

function parseTXT(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("TXT parsing failed:", error);
    return "";
  }
}

////////////////////////////////////////////////////////////
/// PARSE RESUME
////////////////////////////////////////////////////////////

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
/// AI RESUME PARSER
////////////////////////////////////////////////////////////

async function extractCandidateData(resumeText) {
  try {
    if (!resumeText || resumeText.length < 50) return null;

    const prompt = `
Extract candidate information from the resume text.

Return ONLY valid JSON.

{
"name": "",
"email": "",
"phone": "",
"currentLocation": "",
"totalExperience": number,
"skills": [],
"currentCompany": "",
"currentDesignation": "",
"highestQualification": ""
}

Resume Text:
${resumeText.substring(0, 12000)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You extract structured data from resumes.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = completion.choices[0].message.content;

    return JSON.parse(content);
  } catch (error) {
    console.error("AI resume parsing failed:", error);
    return null;
  }
}

////////////////////////////////////////////////////////////
/// SAVE CANDIDATE
////////////////////////////////////////////////////////////

async function saveCandidate(candidateData, resumeText, filePath) {
  try {
    if (!candidateData) return null;

    const email = candidateData.email || "";
    const phone = candidateData.phone || "";

    if (!email && !phone) return null;

    const existing = await prisma.candidate.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existing) return existing;

    const candidate = await prisma.candidate.create({
      data: {
        name: candidateData.name || "Unknown",
        email,
        phone,
        currentLocation: candidateData.currentLocation || null,
        totalExperience: candidateData.totalExperience
          ? Number(candidateData.totalExperience)
          : null,
        skills: candidateData.skills ? candidateData.skills.join(", ") : null,
        currentCompany: candidateData.currentCompany || null,
        currentDesignation: candidateData.currentDesignation || null,
        highestQualification: candidateData.highestQualification || null,
        resumeUrl: filePath,
        resumeText,
        source: "ADMIN_RESUME_UPLOAD",
      },
    });

    return candidate;
  } catch (error) {
    console.error("Candidate save failed:", error);
    return null;
  }
}

////////////////////////////////////////////////////////////
/// PROCESS SINGLE RESUME
////////////////////////////////////////////////////////////

async function processSingleResume(file) {
  try {
    const rawText = await parseResume(file);

    const text = cleanResumeText(rawText);

    const candidateData = await extractCandidateData(text);

    const savedCandidate = await saveCandidate(candidateData, text, file.path);

    return {
      fileName: file.originalname,
      candidate: candidateData,
      candidateId: savedCandidate ? savedCandidate.id : null,
    };
  } catch (error) {
    console.error("Resume processing failed:", error);

    return {
      fileName: file.originalname,
      error: "Failed to process",
    };
  }
}

////////////////////////////////////////////////////////////
/// MAIN PROCESSOR
////////////////////////////////////////////////////////////

async function processResumes(files) {
  const parsedResults = [];

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === ".zip") {
      const extractedFiles = await extractZip(file.path);

      const results = await Promise.all(
        extractedFiles.map((f) => limit(() => processSingleResume(f))),
      );

      parsedResults.push(...results);
    } else {
      const result = await limit(() => processSingleResume(file));

      parsedResults.push(result);
    }
  }

  return parsedResults;
}

module.exports = {
  processResumes,
};
