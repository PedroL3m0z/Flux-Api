-- Global dashboard roles only: drop per-instance membership.

-- Promote former instance owners/operators to global operator before enum swap.
UPDATE "users" u
SET role = 'member'
WHERE u.role = 'member'
  AND u.id IN (
    SELECT "userId" FROM "instance_members" WHERE role IN ('owner', 'operator')
  );

-- Replace Role enum (admin | member) with (admin | operator | viewer).
ALTER TABLE "users" ADD COLUMN "role_new" TEXT;

UPDATE "users" SET "role_new" = 'admin' WHERE role = 'admin';
UPDATE "users" SET "role_new" = 'operator' WHERE role = 'member';
UPDATE "users" SET "role_new" = 'viewer' WHERE "role_new" IS NULL;

DROP TABLE "instance_members";

ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "Role";
DROP TYPE IF EXISTS "InstanceRole";

CREATE TYPE "Role" AS ENUM ('admin', 'operator', 'viewer');

ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'viewer';
UPDATE "users" SET "role" = "role_new"::"Role";
ALTER TABLE "users" DROP COLUMN "role_new";
