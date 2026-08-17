-- Optional public chamber storefront cover image metadata.
ALTER TABLE "Chamber" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "Chamber" ADD COLUMN "coverImageAlt" TEXT;
ALTER TABLE "Chamber" ADD COLUMN "coverImageHash" TEXT;
ALTER TABLE "Chamber" ADD COLUMN "coverImageUpdatedAt" TIMESTAMP(3);
