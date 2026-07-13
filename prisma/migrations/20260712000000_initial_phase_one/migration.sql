-- Initial Phase 1 schema. Generated as a checked-in migration so production uses `prisma migrate deploy`.
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PRODUCER', 'HOST');
CREATE TYPE "CallerStatus" AS ENUM ('DRAFT', 'DEVELOPING', 'REHEARSING', 'APPROVED', 'QUEUED', 'LIVE', 'COMPLETED', 'SKIPPED', 'FAILED');
CREATE TYPE "ShowStatus" AS ENUM ('DRAFT', 'READY', 'LIVE', 'ENDED');
CREATE TYPE "QueueItemStatus" AS ENUM ('QUEUED', 'CONNECTING', 'LIVE', 'COMPLETED', 'SKIPPED', 'FAILED');
CREATE TYPE "BroadcastState" AS ENUM ('SHOW_IDLE', 'CALLER_INCOMING', 'CALLER_CONNECTING', 'CALLER_LIVE', 'CALLER_ON_HOLD', 'CALLER_ENDED', 'SHOW_BREAK', 'SHOW_ENDED', 'ERROR_SAFE');
CREATE TYPE "ShowEventType" AS ENUM ('SHOW_STARTED', 'CALLER_INCOMING', 'CALLER_CONNECTING', 'CALLER_CONNECTED', 'CALLER_SPEAKING_STARTED', 'CALLER_SPEAKING_STOPPED', 'CALLER_INTERRUPTED', 'CALLER_MUTED', 'CALLER_UNMUTED', 'CALLER_HELD', 'CALLER_RESUMED', 'VISUAL_SHOWN', 'VISUAL_CLEARED', 'SOUND_EFFECT_PLAYED', 'CALL_ENDED', 'CALL_FAILED', 'QUEUE_REORDERED', 'SHOW_ENDED', 'EMERGENCY_STOP');

CREATE TABLE "User" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "role" "UserRole" NOT NULL DEFAULT 'ADMIN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Caller" ("id" TEXT NOT NULL, "status" "CallerStatus" NOT NULL DEFAULT 'DRAFT', "firstName" TEXT NOT NULL, "surnameInitial" TEXT, "age" INTEGER, "location" TEXT NOT NULL, "occupation" TEXT, "relationshipStatus" TEXT, "issueHeadline" TEXT NOT NULL, "openingSummary" TEXT NOT NULL, "character" JSONB NOT NULL, "story" JSONB NOT NULL, "performance" JSONB NOT NULL, "hostSupport" JSONB NOT NULL, "generation" JSONB, "quality" JSONB, "rehearsalCount" INTEGER NOT NULL DEFAULT 0, "producerNotes" TEXT, "approvedAt" TIMESTAMP(3), "approvedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Caller_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Caller_status_idx" ON "Caller"("status");

CREATE TABLE "CallerAsset" ("id" TEXT NOT NULL, "callerId" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'SUPPORTING_VISUAL', "label" TEXT NOT NULL, "url" TEXT NOT NULL, "trigger" TEXT, "manualHotkey" TEXT, "autoTriggerKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "priority" INTEGER NOT NULL DEFAULT 0, "durationSeconds" INTEGER, "transition" TEXT NOT NULL DEFAULT 'CUT', "broadcastRegion" TEXT NOT NULL DEFAULT 'MAIN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CallerAsset_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CallerAsset_callerId_idx" ON "CallerAsset"("callerId");

CREATE TABLE "Show" ("id" TEXT NOT NULL, "title" TEXT NOT NULL, "status" "ShowStatus" NOT NULL DEFAULT 'DRAFT', "brandingConfig" JSONB NOT NULL, "broadcastToken" TEXT NOT NULL, "broadcastPublic" BOOLEAN NOT NULL DEFAULT false, "currentQueueItemId" TEXT, "broadcastState" "BroadcastState" NOT NULL DEFAULT 'SHOW_IDLE', "startedAt" TIMESTAMP(3), "endedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Show_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Show_broadcastToken_key" ON "Show"("broadcastToken");
CREATE INDEX "Show_status_idx" ON "Show"("status");

CREATE TABLE "QueueItem" ("id" TEXT NOT NULL, "showId" TEXT NOT NULL, "callerId" TEXT NOT NULL, "position" INTEGER NOT NULL, "status" "QueueItemStatus" NOT NULL DEFAULT 'QUEUED', "callerSnapshot" JSONB NOT NULL, "producerNote" TEXT, "isReserve" BOOLEAN NOT NULL DEFAULT false, "startedAt" TIMESTAMP(3), "endedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "QueueItem_showId_position_key" ON "QueueItem"("showId", "position");
CREATE INDEX "QueueItem_showId_status_idx" ON "QueueItem"("showId", "status");

CREATE TABLE "ShowEvent" ("id" TEXT NOT NULL, "showId" TEXT NOT NULL, "type" "ShowEventType" NOT NULL, "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "payload" JSONB NOT NULL, CONSTRAINT "ShowEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ShowEvent_showId_timestamp_idx" ON "ShowEvent"("showId", "timestamp");

ALTER TABLE "CallerAsset" ADD CONSTRAINT "CallerAsset_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "Caller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "Caller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShowEvent" ADD CONSTRAINT "ShowEvent_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
