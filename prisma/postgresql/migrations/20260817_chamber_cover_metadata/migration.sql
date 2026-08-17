-- Optional public chamber storefront cover metadata.
-- Additive and backward-compatible: all columns are nullable, and the live
-- application does not query them until a later release verifies this
-- migration in Railway PostgreSQL.
ALTER TABLE "Chamber" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "Chamber" ADD COLUMN "coverImageAlt" TEXT;
ALTER TABLE "Chamber" ADD COLUMN "coverImageHash" TEXT;
ALTER TABLE "Chamber" ADD COLUMN "coverImageUpdatedAt" TIMESTAMP(3);
