-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('STRUCTURES', 'LIGHTING', 'SOUND', 'SCREENS', 'TEXTILE', 'SPECIAL_EFFECTS', 'COMMUTATION', 'ADDITIONAL_EQUIPMENT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'ADDITIONAL_EQUIPMENT';

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");
