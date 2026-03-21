const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const unzipper = require("unzipper");
const crypto = require("crypto");
const axios = require("axios");

const pLimit = require("p-limit").default;
const { uploadToR2 } = require("../../../utils/uploadToR2");

const openai = require("../../../config/openai");
const prisma = require("../../../config/prisma");

const candidateService = require("../services/candidate.service");
const { extractTextFromPDF } = require("../../../utils/visionAsync");
const limit = pLimit(process.env.AI_CONCURRENCY || 5);
const os = require("os");

async function downloadToTempFile(url, fileName) {
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);

  const res = await axios.get(url, {
    responseType: "stream",
  });

  const writer = fs.createWriteStream(tempPath);

  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return tempPath;
}

////////////////////////////////////////////////////////////
/// HELPERS
////////////////////////////////////////////////////////////

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function withOpenAITimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("OpenAI timeout")), ms),
    ),
  ]);
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

async function countZipFiles(filePath) {
  try {
    const directory = await unzipper.Open.file(filePath);

    return directory.files.filter((entry) => {
      const ext = path.extname(entry.path).toLowerCase();
      return [".pdf", ".doc", ".docx", ".txt"].includes(ext);
    }).length;
  } catch (err) {
    console.error("ZIP count failed:", err);
    return 0;
  }
}

////////////////////////////////////////////////////////////
/// AI PARSER
////////////////////////////////////////////////////////////

async function callOpenAI(prompt) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert resume parser. Always return clean structured JSON.",
      },
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

    ////////////////////////////////////////////////////////////
    /// BASIC EXTRACTION (BOOST ACCURACY)
    ////////////////////////////////////////////////////////////

    const basic = extractBasicInfo(resumeText);

    ////////////////////////////////////////////////////////////
    /// STRONG PROMPT
    ////////////////////////////////////////////////////////////

    const prompt = `
Extract structured candidate data from the resume text.

Return STRICT JSON with the following fields:

{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "currentLocation": string | null,
  "preferredLocations": string | null,
  "hometown": string | null,
  "pincode": string | null,
  "experience": [
  {
    "company": string | null,
    "role": string | null,
    "startDate": string | null,
    "endDate": string | null
  }
],
  "totalExperience": number | null,
  "currentCompany": string | null,
  "currentDesignation": string | null,
  "department": string | null,
  "industry": string | null,

  "skills": string,

  "currentSalary": number | null,
  "expectedSalary": number | null,
  "noticePeriodDays": number | null,

  "highestQualification": string | null
}

Rules:
- DO NOT guess → return null if not present
- Experience must be number in years (e.g. 2.5)
- Salary must be yearly INR number (e.g. 600000)
- Skills must be comma separated, lowercase, no duplicates
- Phone must contain only digits
- If fresher → totalExperience = 0
- Extract ALL work experiences (ignore education/internships if clearly marked)
- Dates can be formats like: "Jan 2022", "2022-01", "March 2023", "Present"
- If endDate is current → use "Present"
- If no experience found → return empty array []

Known extracted info:
email: ${basic.email || "null"}
phone: ${basic.phone || "null"}

Resume:
${resumeText.slice(0, 12000)}
`;

    ////////////////////////////////////////////////////////////
    /// RETRY LOGIC
    ////////////////////////////////////////////////////////////

    for (let i = 0; i < 2; i++) {
      const result = await withOpenAITimeout(callOpenAI(prompt), 20000);
      if (result) return result;
    }

    return null;
  } catch (error) {
    console.error("AI parsing failed:", error);
    return null;
  }
}

async function withVisionTimeout(promise, ms = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Vision timeout")), ms),
    ),
  ]);
}

////////////////////////////////////////////////////////////
/// PROCESS SINGLE
////////////////////////////////////////////////////////////

async function processSingleResume(file, index) {
  let tempPath = null;

  try {
    ////////////////////////////////////////////////////////////
    /// VALIDATE
    ////////////////////////////////////////////////////////////

    if (!file.url) {
      return {
        row: index + 1,
        fileName: file.originalname,
        status: "error",
        error: "Missing file URL",

        name: null,
        email: null,
        phone: null,
      };
    }

    ////////////////////////////////////////////////////////////
    /// DOWNLOAD FROM R2 → TEMP FILE
    ////////////////////////////////////////////////////////////

    tempPath = await downloadToTempFile(file.url, file.originalname);

    ////////////////////////////////////////////////////////////
    /// PARSE
    ////////////////////////////////////////////////////////////

    let rawText = await parseResume({
      originalname: file.originalname,
      path: tempPath,
    });

    let text = cleanResumeText(rawText);

    ////////////////////////////////////////////////////////////
    /// VISION FALLBACK
    ////////////////////////////////////////////////////////////

    const ext = path.extname(file.originalname).toLowerCase();
    const wordCount = text ? text.split(/\s+/).length : 0;
    const isWeakText = !text || text.length < 500 || wordCount < 50;

    if (ext === ".pdf" && isWeakText) {
      console.log(`⚡ Using Vision OCR for: ${file.originalname}`);

      try {
        const visionText = await withVisionTimeout(
          extractTextFromPDF(tempPath, file.originalname),
          30000,
        );

        if (visionText && visionText.length > 200) {
          text = cleanResumeText(visionText);
        }
      } catch (err) {
        console.warn("Vision OCR failed:", err.message);
      }
    }

    ////////////////////////////////////////////////////////////
    /// VALIDATION
    ////////////////////////////////////////////////////////////

    if (!text || text.length < 200) {
      return {
        row: index + 1,
        fileName: file.originalname,
        status: "error",
        error: "Empty or unreadable resume",

        name: null,
        email: null,
        phone: null,
      };
    }

    const hash = generateHash(text);
    const basic = extractBasicInfo(text);

    if (!basic.email && !basic.phone) {
      return {
        row: index + 1,
        fileName: file.originalname,
        status: "skipped",
        reason: "No contact info",

        name: null,
        email: basic.email || null,
        phone: basic.phone || null,
      };
    }

    ////////////////////////////////////////////////////////////
    /// AI PARSING
    ////////////////////////////////////////////////////////////

    let candidateData = await extractCandidateData(text);

    if (!candidateData) {
      candidateData = {
        name: null,
        email: basic.email,
        phone: basic.phone,
      };
    }

    ////////////////////////////////////////////////////////////
    /// SAVE
    ////////////////////////////////////////////////////////////

    const result = await candidateService.createOrFindCandidate(
      candidateData,
      "ADMIN_RESUME_UPLOAD",
      {
        resumeUrl: file.url,
        resumeText: text.slice(0, 2000),
        resumeHash: hash,
      },
    );

    if (!result) {
      return {
        row: index + 1,
        fileName: file.originalname,
        status: "skipped",
        reason: "Invalid candidate",

        name: candidateData?.name || null,
        email: candidateData?.email || basic.email || null,
        phone: candidateData?.phone || basic.phone || null,
      };
    }

    ////////////////////////////////////////////////////////////
    /// FINAL SUCCESS RESPONSE
    ////////////////////////////////////////////////////////////

    const candidate = result.candidate;

    return {
      row: index + 1,
      fileName: file.originalname,
      status: result.isNew ? "created" : "duplicate",
      candidateId: candidate.id,

      // ✅ BASIC INFO (IMPORTANT)
      name: candidate.name || candidateData?.name || null,
      email: candidate.email || candidateData?.email || basic.email || null,
      phone: candidate.phone || candidateData?.phone || basic.phone || null,

      // 🔥 OPTIONAL ENHANCEMENTS (VERY USEFUL FOR UI)
      experience: candidate.totalExperience ?? null,
      currentCompany: candidate.currentCompany ?? null,
      currentDesignation: candidate.currentDesignation ?? null,
      skills: candidate.skills ?? null,
    };
  } catch (error) {
    return {
      row: index + 1,
      fileName: file.originalname,
      status: "error",
      error: error.message,

      name: null,
      email: null,
      phone: null,
    };
  } finally {
    ////////////////////////////////////////////////////////////
    /// CLEANUP TEMP FILE
    ////////////////////////////////////////////////////////////

    if (tempPath) {
      try {
        await fs.promises.unlink(tempPath);
      } catch (err) {
        console.warn("Temp cleanup failed:", tempPath);
      }
    }
  }
}

////////////////////////////////////////////////////////////
/// MAIN PROCESSOR
////////////////////////////////////////////////////////////

async function safeUnlink(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    console.warn("File delete failed:", filePath);
  }
}

async function processResumes(files, jobId, job, total) {
  const processed = [];
  let index = 0;

  for (const file of files) {
    await prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        currentFile: file.originalname,
      },
    });

    const ext = path.extname(file.originalname).toLowerCase();
    let results = [];

    try {
      ////////////////////////////////////////////////////////////
      /// ZIP FILE
      ////////////////////////////////////////////////////////////
      if (ext === ".zip") {
        if (!file.url) {
          console.error("ZIP missing URL");
          continue;
        }

        const tempZipPath = await downloadToTempFile(
          file.url,
          file.originalname,
        );

        const extracted = await extractZip(tempZipPath);

        results = await Promise.all(
          extracted.map((f, i) =>
            limit(async () => {
              await prisma.uploadJob.update({
                where: { id: jobId },
                data: { currentFile: f.originalname },
              });

              // upload extracted file to R2
              const r2Url = await uploadToR2({
                path: f.path,
                originalname: f.originalname,
              });

              return processSingleResume(
                {
                  originalname: f.originalname,
                  url: r2Url,
                },
                index + i,
              );
            }),
          ),
        );

        // cleanup extracted files
        for (const f of extracted) {
          await safeUnlink(f.path);
        }

        // cleanup temp zip
        await safeUnlink(tempZipPath);

        index += extracted.length;
      }

      ////////////////////////////////////////////////////////////
      /// NORMAL FILE
      ////////////////////////////////////////////////////////////
      else {
        const result = await limit(() => processSingleResume(file, index));

        results = [result];
        index++;
      }

      ////////////////////////////////////////////////////////////
      /// STORE RESULTS
      ////////////////////////////////////////////////////////////
      processed.push(...results);

      ////////////////////////////////////////////////////////////
      /// COUNT STATUS
      ////////////////////////////////////////////////////////////
      let created = 0;
      let duplicate = 0;
      let skipped = 0;
      let error = 0;

      for (const r of results) {
        if (r.status === "created") created++;
        else if (r.status === "duplicate") duplicate++;
        else if (r.status === "skipped") skipped++;
        else if (r.status === "error") error++;
      }

      ////////////////////////////////////////////////////////////
      /// 🔥 UPDATE DB PROGRESS
      ////////////////////////////////////////////////////////////
      await prisma.uploadJob.update({
        where: { id: jobId },
        data: {
          processed: { increment: results.length },
          created: { increment: created },
          duplicate: { increment: duplicate },
          skipped: { increment: skipped },
          error: { increment: error },
        },
      });

      ////////////////////////////////////////////////////////////
      /// 🔥 UPDATE BULLMQ PROGRESS (REAL-TIME)
      ////////////////////////////////////////////////////////////
      if (job && total) {
        await job.updateProgress({
          current: index,
          total,
          percentage: Math.round((index / total) * 100),
        });
      }
    } catch (err) {
      console.error("Processing error:", err.message);
    }
  }

  ////////////////////////////////////////////////////////////
  /// FINAL STATUS
  ////////////////////////////////////////////////////////////
  await prisma.uploadJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      results: processed,
      currentFile: "Completed",
    },
  });

  ////////////////////////////////////////////////////////////
  /// FINAL BULLMQ PROGRESS
  ////////////////////////////////////////////////////////////
  if (job && total) {
    await job.updateProgress({
      current: total,
      total,
      percentage: 100,
    });
  }

  return processed;
}

module.exports = {
  processResumes,
  countZipFiles,
};
