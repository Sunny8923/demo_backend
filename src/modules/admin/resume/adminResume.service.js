const fs = require("fs");
const path = require("path");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const mammoth = require("mammoth");
const unzipper = require("unzipper");
const openai = require("../../../config/openai");
const prisma = require("../../../config/prisma");

////////////////////////////////////////////////////////////
/// EXTRACT TEXT FROM PDF
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
/// EXTRACT TEXT FROM DOCX
////////////////////////////////////////////////////////////

async function parseDOCX(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

////////////////////////////////////////////////////////////
/// EXTRACT TEXT FROM TXT
////////////////////////////////////////////////////////////

function parseTXT(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

////////////////////////////////////////////////////////////
/// PARSE SINGLE RESUME
////////////////////////////////////////////////////////////

async function parseResume(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".pdf") {
    return await parsePDF(file.path);
  }

  if (ext === ".docx" || ext === ".doc") {
    return await parseDOCX(file.path);
  }

  if (ext === ".txt") {
    return parseTXT(file.path);
  }

  return "";
}

////////////////////////////////////////////////////////////
/// EXTRACT ZIP FILE
////////////////////////////////////////////////////////////

async function extractZip(filePath) {
  const extractedFiles = [];

  const directory = await unzipper.Open.file(filePath);

  for (const entry of directory.files) {
    const fileName = entry.path;
    const ext = path.extname(fileName).toLowerCase();

    ```
if (![".pdf", ".docx", ".doc", ".txt"].includes(ext)) {
  continue;
}

const safeName = fileName.replace(/[\/\\]/g, "_");

const outputPath =
  "uploads/resumes/" + Date.now() + "-" + safeName;

await new Promise((resolve, reject) => {
  entry
    .stream()
    .pipe(fs.createWriteStream(outputPath))
    .on("finish", resolve)
    .on("error", reject);
});

extractedFiles.push({
  originalname: fileName,
  path: outputPath,
});
```;
  }

  return extractedFiles;
}

////////////////////////////////////////////////////////////
/// AI PARSE RESUME
////////////////////////////////////////////////////////////

async function extractCandidateData(resumeText) {
  if (!resumeText || resumeText.length < 50) {
    return null;
  }

  const prompt = `
Extract candidate information from the resume text below.

Return ONLY valid JSON.

{
"name": "",
"email": "",
"phone": "",
"currentLocation": "",
"totalExperience": number,
"skills": "",
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
    messages: [
      {
        role: "system",
        content: "You are an expert resume parser. Return clean JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  let response = completion.choices[0].message.content;

  response = response.replace(/`json/g, "").replace(/`/g, "").trim();

  try {
    return JSON.parse(response);
  } catch (err) {
    console.log("AI JSON parse failed:", response);
    return null;
  }
}

////////////////////////////////////////////////////////////
/// SAVE CANDIDATE
////////////////////////////////////////////////////////////

async function saveCandidate(candidateData, resumeText, filePath) {
  if (!candidateData) return null;

  const email = candidateData.email || "";
  const phone = candidateData.phone || "";

  if (!email && !phone) return null;

  const existing = await prisma.candidate.findFirst({
    where: {
      OR: [{ email: email }, { phone: phone }],
    },
  });

  if (existing) {
    return existing;
  }

  const candidate = await prisma.candidate.create({
    data: {
      name: candidateData.name || "Unknown",
      email,
      phone,

      currentLocation: candidateData.currentLocation || null,

      totalExperience: candidateData.totalExperience
        ? Number(candidateData.totalExperience)
        : null,

      skills: candidateData.skills || null,
      currentCompany: candidateData.currentCompany || null,
      currentDesignation: candidateData.currentDesignation || null,
      highestQualification: candidateData.highestQualification || null,

      resumeUrl: filePath,
      resumeText: resumeText,

      source: "ADMIN_RESUME_UPLOAD",
    },
  });

  return candidate;
}

////////////////////////////////////////////////////////////
/// MAIN SERVICE FUNCTION
////////////////////////////////////////////////////////////

async function processResumes(files) {
  const parsedResults = [];

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();

    ////////////////////////////////////////////////////////
    /// ZIP FILE HANDLING
    ////////////////////////////////////////////////////////

    if (ext === ".zip") {
      const extractedFiles = await extractZip(file.path);

      for (const extractedFile of extractedFiles) {
        const text = await parseResume(extractedFile);

        const candidateData = await extractCandidateData(text);

        const savedCandidate = await saveCandidate(
          candidateData,
          text,
          extractedFile.path,
        );

        parsedResults.push({
          fileName: extractedFile.originalname,
          candidate: candidateData,
          candidateId: savedCandidate ? savedCandidate.id : null,
        });
      }

      continue;
    }

    ////////////////////////////////////////////////////////
    /// NORMAL FILE
    ////////////////////////////////////////////////////////

    const text = await parseResume(file);

    const candidateData = await extractCandidateData(text);

    const savedCandidate = await saveCandidate(candidateData, text, file.path);

    parsedResults.push({
      fileName: file.originalname,
      candidate: candidateData,
      candidateId: savedCandidate ? savedCandidate.id : null,
    });
  }

  return parsedResults;
}

module.exports = {
  processResumes,
};
