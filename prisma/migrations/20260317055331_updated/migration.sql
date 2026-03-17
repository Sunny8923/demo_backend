/*
  Warnings:

  - You are about to drop the column `dateOfBirth` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `graduationYear` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `maritalStatus` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `specialization` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `university` on the `Candidate` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Candidate_email_phone_key";

-- AlterTable
ALTER TABLE "Candidate" DROP COLUMN "dateOfBirth",
DROP COLUMN "gender",
DROP COLUMN "graduationYear",
DROP COLUMN "maritalStatus",
DROP COLUMN "specialization",
DROP COLUMN "university",
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "extraData" JSONB;
