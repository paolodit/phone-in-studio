import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StudioNav } from "@/components/StudioNav";

export default async function CallersPage() {
  await requireAdmin();
  const callers = await prisma.caller.findMany({ orderBy: { updatedAt: "desc" }, include: { assets: { where: { type: "PORTRAIT" }, take: 1 } } });
  return <main className="shell"><StudioNav /><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Caller workshop</p><h1 className="title">Fictional callers</h1></div><div className="flex flex-wrap gap-2"><Link className="button-secondary" href="/callers/new">Create manually</Link><Link className="button-primary" href="/callers/develop">Develop with AI</Link></div></div>
    <div className="mt-6 grid gap-3">{callers.map((caller) => <Link href={`/callers/${caller.id}`} key={caller.id} className="panel flex items-center gap-4 p-4 transition hover:border-cyan-400">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xl font-black text-slate-950">{caller.firstName.slice(0, 1)}</div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-white">{caller.firstName} {caller.surnameInitial}</h2><span className="status bg-slate-700 text-slate-200">{caller.status}</span></div><p className="mt-1 truncate text-sm text-slate-300">{caller.issueHeadline}</p><p className="mt-1 text-xs text-slate-500">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p></div>
    </Link>)}{callers.length === 0 && <div className="panel panel-pad text-slate-300">No callers yet. Create one manually, then approve it before it can be queued.</div>}</div>
  </main>;
}
