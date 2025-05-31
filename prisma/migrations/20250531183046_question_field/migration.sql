/*
  Warnings:

  - You are about to drop the column `questions` on the `Assessment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Assessment" DROP COLUMN "questions",
ADD COLUMN     "question" JSONB[];
