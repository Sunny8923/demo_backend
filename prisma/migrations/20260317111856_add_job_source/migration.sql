-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('MANUAL', 'CSV_UPLOAD', 'JD_UPLOAD');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "source" "JobSource" NOT NULL DEFAULT 'MANUAL';
