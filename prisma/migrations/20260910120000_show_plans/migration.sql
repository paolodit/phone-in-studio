CREATE TABLE "ShowPlan" (
  "id" TEXT NOT NULL,
  "brief" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "acceptedShowId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShowPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShowPlan_acceptedShowId_key" ON "ShowPlan"("acceptedShowId");
