/*
  Warnings:

  - A unique constraint covering the columns `[jrCode]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "closureDate" TIMESTAMP(3),
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "jrCode" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "maxExperience" INTEGER,
ADD COLUMN     "minExperience" INTEGER,
ADD COLUMN     "openings" INTEGER,
ADD COLUMN     "requestDate" TIMESTAMP(3),
ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER,
ADD COLUMN     "skills" TEXT,
ADD COLUMN     "status" TEXT,
ALTER COLUMN "description" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Job_jrCode_key" ON "Job"("jrCode");
