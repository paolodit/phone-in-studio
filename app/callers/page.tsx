import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callerTags } from "@/lib/caller-tags";
import { StudioNav } from "@/components/StudioNav";

type Search = { sort?: string; status?: string; appeared?: string; tag?: string };
const archivedStatuses = new Set(["COMPLETED", "SKIPPED", "FAILED"]);

export default async function CallersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const filters = await searchParams;
  const callers = await prisma.caller.findMany({
    include: {
      assets: { where: { type: "PORTRAIT" }, orderBy: { createdAt: "asc" }, take: 1 },
      queueItems: { select: { status: true, startedAt: true } },
    },
  });
  const tagOptions = [...new Set(callers.flatMap((caller) => callerTags(caller.generation && typeof caller.generation === "object" && !Array.isArray(caller.generation) ? (caller.generation as Record<string, unknown>).topicTags : [])))].sort((a, b) => a.localeCompare(b));
  const visible = callers.filter((caller) => {
    const tags = callerTags(caller.generation && typeof caller.generation === "object" && !Array.isArray(caller.generation) ? (caller.generation as Record<string, unknown>).topicTags : []);
    const appeared = caller.queueItems.some((item) => item.startedAt || item.status === "LIVE" || item.status === "COMPLETED");
    const statusMatch = !filters.status || filters.status === "all" || (filters.status === "archived" ? archivedStatuses.has(caller.status) : caller.status === filters.status);
    const appearanceMatch = !filters.appeared || filters.appeared === "all" || (filters.appeared === "appeared" ? appeared : !appeared);
    return statusMatch && appearanceMatch && (!filters.tag || filters.tag === "all" || tags.includes(filters.tag));
  }).sort((a, b) => filters.sort === "az" ? `${a.firstName} ${a.surnameInitial ?? ""}`.localeCompare(`${b.firstName} ${b.surnameInitial ?? ""}`) : b.updatedAt.getTime() - a.updatedAt.getTime());

  return <main className="shell"><StudioNav /><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Caller workshop</p><h1 className="title">Fictional callers</h1></div><div className="flex flex-wrap gap-2"><Link className="button-secondary" href="/callers/new">Create manually</Link><Link className="button-primary" href="/callers/develop">Develop with AI</Link></div></div>
    <form className="panel panel-pad mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-[11rem_12rem_12rem_1fr_auto]" action="/callers">
      <label><span className="label">Sort by</span><select className="field" name="sort" defaultValue={filters.sort ?? "recent"}><option value="recent">Most recent</option><option value="az">A–Z</option></select></label>
      <label><span className="label">Status</span><select className="field" name="status" defaultValue={filters.status ?? "all"}><option value="all">All statuses</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="archived">Archived</option></select></label>
      <label><span className="label">On-air history</span><select className="field" name="appeared" defaultValue={filters.appeared ?? "all"}><option value="all">All callers</option><option value="appeared">Appeared on-air</option><option value="not-appeared">Not yet appeared</option></select></label>
      <label><span className="label">Topic tag</span><select className="field" name="tag" defaultValue={filters.tag ?? "all"}><option value="all">All topics</option>{tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
      <button className="button-secondary self-end" type="submit">Apply</button>
    </form>
    <p className="mt-3 text-sm text-slate-400">{visible.length} of {callers.length} caller{callers.length === 1 ? "" : "s"} shown.</p>
    <div className="mt-3 grid gap-3">{visible.map((caller) => {
      const tags = callerTags(caller.generation && typeof caller.generation === "object" && !Array.isArray(caller.generation) ? (caller.generation as Record<string, unknown>).topicTags : []);
      const portrait = caller.assets[0]?.url;
      const appeared = caller.queueItems.some((item) => item.startedAt || item.status === "LIVE" || item.status === "COMPLETED");
      return <Link href={`/callers/${caller.id}`} key={caller.id} className="panel flex items-center gap-4 p-4 transition hover:border-cyan-400">
        {portrait ? <img src={portrait} alt={`${caller.firstName} caller graphic`} className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xl font-black text-slate-950">{caller.firstName.slice(0, 1)}</div>}
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-white">{caller.firstName} {caller.surnameInitial}</h2><span className="status bg-slate-700 text-slate-200">{archivedStatuses.has(caller.status) ? "ARCHIVED" : caller.status}</span>{appeared && <span className="status bg-cyan-400/15 text-cyan-200">ON-AIR</span>}</div><p className="mt-1 truncate text-sm text-slate-300">{caller.issueHeadline}</p><p className="mt-1 text-xs text-slate-500">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p>{tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{tags.map((tag) => <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-cyan-100" key={tag}>{tag}</span>)}</div>}</div>
      </Link>;
    })}{visible.length === 0 && <div className="panel panel-pad text-slate-300">No callers match these filters. Try clearing a filter or create a new caller.</div>}</div>
  </main>;
}
