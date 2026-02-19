/*
  Warnings:

  - You are about to drop the column `status` on the `Application` table. All the data in the column will be lost.
  - The `status` column on the `Job` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[candidateId,jobId]` on the table `Application` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,phone]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED', 'SCREENING', 'CONTACTED', 'DOCUMENT_REQUESTED', 'DOCUMENT_RECEIVED', 'SUBMITTED_TO_CLIENT', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'SHORTLISTED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'HIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationFinalStatus" AS ENUM ('HIRED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "Application" DROP COLUMN "status",
ADD COLUMN     "contactedAt" TIMESTAMP(3),
ADD COLUMN     "finalStatus" "ApplicationFinalStatus",
ADD COLUMN     "hiredAt" TIMESTAMP(3),
ADD COLUMN     "interviewCompletedAt" TIMESTAMP(3),
ADD COLUMN     "interviewScheduledAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "offerAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "offerRejectedAt" TIMESTAMP(3),
ADD COLUMN     "offerSentAt" TIMESTAMP(3),
ADD COLUMN     "pipelineStage" "ApplicationStage" NOT NULL DEFAULT 'APPLIED',
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "currentCompany" TEXT,
ADD COLUMN     "currentDesignation" TEXT,
ADD COLUMN     "currentLocation" TEXT,
ADD COLUMN     "currentSalary" DOUBLE PRECISION,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "department" TEXT,
ADD COLUMN     "expectedSalary" DOUBLE PRECISION,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "graduationYear" INTEGER,
ADD COLUMN     "highestQualification" TEXT,
ADD COLUMN     "hometown" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "noticePeriodDays" INTEGER,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "preferredLocations" TEXT,
ADD COLUMN     "skills" TEXT,
ADD COLUMN     "specialization" TEXT,
ADD COLUMN     "totalExperience" DOUBLE PRECISION,
ADD COLUMN     "university" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "applicationsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clientContact" TEXT,
ADD COLUMN     "clientEmail" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'OPEN';

-- DropEnum
DROP TYPE "ApplicationStatus";

-- CreateIndex
CREATE INDEX "Application_jobId_idx" ON "Application"("jobId");

-- CreateIndex
CREATE INDEX "Application_candidateId_idx" ON "Application"("candidateId");

-- CreateIndex
CREATE INDEX "Application_pipelineStage_idx" ON "Application"("pipelineStage");

-- CreateIndex
CREATE INDEX "Application_finalStatus_idx" ON "Application"("finalStatus");

-- CreateIndex
CREATE INDEX "Application_appliedByUserId_idx" ON "Application"("appliedByUserId");

-- CreateIndex
CREATE INDEX "Application_appliedByPartnerId_idx" ON "Application"("appliedByPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_candidateId_jobId_key" ON "Application"("candidateId", "jobId");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_phone_idx" ON "Candidate"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_phone_key" ON "Candidate"("email", "phone");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");
