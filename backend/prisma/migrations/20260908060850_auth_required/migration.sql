/*
  Warnings:

  - Made the column `userId` on table `Layout` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Scan` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Layout" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Scan" ALTER COLUMN "userId" SET NOT NULL;
