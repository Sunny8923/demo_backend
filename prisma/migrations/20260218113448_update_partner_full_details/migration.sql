/*
  Warnings:

  - You are about to drop the column `businessName` on the `Partner` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Partner` table. All the data in the column will be lost.
  - Added the required column `address` to the `Partner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contactNumber` to the `Partner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `establishmentDate` to the `Partner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gstNumber` to the `Partner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `officialEmail` to the `Partner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organisationName` to the `Partner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerName` to the `Partner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `panNumber` to the `Partner` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Partner" DROP COLUMN "businessName",
DROP COLUMN "phone",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "contactNumber" TEXT NOT NULL,
ADD COLUMN     "establishmentDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "gstNumber" TEXT NOT NULL,
ADD COLUMN     "msmeRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "officialEmail" TEXT NOT NULL,
ADD COLUMN     "organisationName" TEXT NOT NULL,
ADD COLUMN     "ownerName" TEXT NOT NULL,
ADD COLUMN     "panNumber" TEXT NOT NULL;
