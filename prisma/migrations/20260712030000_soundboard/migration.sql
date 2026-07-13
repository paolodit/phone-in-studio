CREATE TABLE "SoundEffect" (
  "id" TEXT NOT NULL,
  "showId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "hotkey" TEXT,
  "volume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "loop" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SoundEffect_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SoundEffect_showId_idx" ON "SoundEffect"("showId");
ALTER TABLE "SoundEffect" ADD CONSTRAINT "SoundEffect_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
