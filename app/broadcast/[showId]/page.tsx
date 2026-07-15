import { notFound } from "next/navigation";
import { BroadcastClient, type BroadcastLayout } from "@/components/BroadcastClient";
import { canViewBroadcast, getBroadcastSnapshot } from "@/lib/show-service";
import { isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BroadcastPage({ params, searchParams }: { params: Promise<{ showId: string }>; searchParams: Promise<{ token?: string; mode?: string; layout?: string }> }) {
  const [{ showId }, query] = await Promise.all([params, searchParams]);
  const admin = await isAdminSession();
  if (!admin && !(await canViewBroadcast(showId, query.token))) notFound();
  const snapshot = await getBroadcastSnapshot(showId);
  const mode = query.mode === "overlay" ? "overlay" : "full";
  const layout: BroadcastLayout = query.layout === "tiktok" || query.layout === "twitch" ? query.layout : "web";
  return <BroadcastClient initialSnapshot={snapshot} token={query.token} mode={mode} layout={layout} />;
}
