CREATE TYPE "OptionalModuleKey" AS ENUM ('AI_HOST', 'CALLER_FACTORY');
CREATE TYPE "HostMode" AS ENUM ('HUMAN', 'AI_SUPERVISED', 'AI_AUTONOMOUS');
CREATE TYPE "CallerBatchStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE "CallerCandidateStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "OptionalModuleSetting" (
  "id" TEXT NOT NULL,
  "key" "OptionalModuleKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OptionalModuleSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OptionalModuleSetting_key_key" ON "OptionalModuleSetting"("key");

CREATE TABLE "HostProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "publicIdentity" TEXT,
  "voiceProvider" TEXT NOT NULL DEFAULT 'openai',
  "voiceId" TEXT NOT NULL DEFAULT 'nova',
  "stylePreset" TEXT NOT NULL DEFAULT 'gentle',
  "characteristics" JSONB NOT NULL DEFAULT '{}',
  "guidance" TEXT,
  "boundaries" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HostProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Show" ADD COLUMN "hostMode" "HostMode" NOT NULL DEFAULT 'HUMAN';
ALTER TABLE "Show" ADD COLUMN "hostProfileId" TEXT;
CREATE INDEX "Show_hostProfileId_idx" ON "Show"("hostProfileId");
ALTER TABLE "Show" ADD CONSTRAINT "Show_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "HostProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ShowModuleSetting" (
  "id" TEXT NOT NULL,
  "showId" TEXT NOT NULL,
  "key" "OptionalModuleKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShowModuleSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShowModuleSetting_showId_key_key" ON "ShowModuleSetting"("showId", "key");
CREATE INDEX "ShowModuleSetting_showId_idx" ON "ShowModuleSetting"("showId");
ALTER TABLE "ShowModuleSetting" ADD CONSTRAINT "ShowModuleSetting_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CallerGenerationBatch" (
  "id" TEXT NOT NULL,
  "showId" TEXT,
  "title" TEXT NOT NULL,
  "seed" TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "generatedCount" INTEGER NOT NULL DEFAULT 0,
  "status" "CallerBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "criteria" JSONB NOT NULL DEFAULT '{}',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallerGenerationBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CallerGenerationBatch_showId_idx" ON "CallerGenerationBatch"("showId");
CREATE INDEX "CallerGenerationBatch_status_idx" ON "CallerGenerationBatch"("status");
ALTER TABLE "CallerGenerationBatch" ADD CONSTRAINT "CallerGenerationBatch_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CallerCandidate" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "status" "CallerCandidateStatus" NOT NULL DEFAULT 'PENDING',
  "draft" JSONB NOT NULL,
  "similarityKey" TEXT NOT NULL,
  "acceptedCallerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallerCandidate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CallerCandidate_batchId_status_idx" ON "CallerCandidate"("batchId", "status");
CREATE UNIQUE INDEX "CallerCandidate_batchId_similarityKey_key" ON "CallerCandidate"("batchId", "similarityKey");
ALTER TABLE "CallerCandidate" ADD CONSTRAINT "CallerCandidate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CallerGenerationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
