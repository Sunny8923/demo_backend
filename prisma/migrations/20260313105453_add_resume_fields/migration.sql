-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('DIRECT_APPLY', 'PARTNER_UPLOAD', 'ADMIN_RESUME_UPLOAD', 'ADMIN_CSV_UPLOAD');

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "resumeText" TEXT,
ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "source" "CandidateSource" NOT NULL DEFAULT 'DIRECT_APPLY';
