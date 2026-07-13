import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShowAction } from "@/lib/actions/show-actions";
import { StudioNav } from "@/components/StudioNav";

export default async function ShowsPage() {
  await requireAdmin();
  const shows = await prisma.show.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { queueItems: true } } } });
  return <main className="shell"><StudioNav /><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><section><p className="eyebrow">Show management</p><h1 className="title mt-1">Running orders</h1><div className="mt-6 grid gap-3">{shows.map((show) => <Link key={show.id} href={`/shows/${show.id}`} className="panel flex items-center justify-between gap-4 p-4 transition hover:border-cyan-400"><div><div className="flex items-center gap-2"><h2 className="font-bold text-white">{show.title}</h2><span className="status bg-slate-700 text-slate-200">{show.status}</span></div><p className="mt-1 text-sm text-slate-400">{show._count.queueItems} queued caller{show._count.queueItems === 1 ? "" : "s"} · {show.broadcastState.replaceAll("_", " ")}</p></div><span className="text-cyan-300">Open →</span></Link>)}{shows.length === 0 && <div className="panel panel-pad text-slate-300">Create a show, then add manually approved callers to its running order.</div>}</div></section>
  <form action={createShowAction} className="panel panel-pad h-fit"><p className="eyebrow">New programme</p><h2 className="mt-1 text-lg font-bold text-white">Create a show</h2><label className="mt-5 block"><span className="label">Programme title</span><input className="field" name="title" placeholder="Friday night test show" required /></label><button className="button-primary mt-4 w-full">Create running order</button></form></div></main>;
}
