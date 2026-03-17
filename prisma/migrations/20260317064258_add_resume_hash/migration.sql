/*
  Warnings:

  - A unique constraint covering the columns `[resumeHash]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "resumeHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_resumeHash_key" ON "Candidate"("resumeHash");
