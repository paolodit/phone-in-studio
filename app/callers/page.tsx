import Link from "next/link";
import { Headphones, Search, Sparkles, UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callerTags, jsonRecord } from "@/lib/caller-tags";
import { StudioNav } from "@/components/StudioNav";

type SearchParams = { q?: string; sort?: string; status?: string; appeared?: string; tag?: string };
const archivedStatuses = new Set(["COMPLETED", "SKIPPED", "FAILED"]);

export default async function CallersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const filters = await searchParams;
  const callers = await prisma.caller.findMany({
    include: {
      assets: { where: { type: "PORTRAIT" }, orderBy: { createdAt: "asc" }, take: 1 },
      queueItems: { select: { status: true, startedAt: true } },
    },
  });
  const tagOptions = [...new Set(callers.flatMap((caller) => callerTags(jsonRecord(caller.generation).topicTags)))].sort((a, b) => a.localeCompare(b));
  const query = filters.q?.trim().toLowerCase() ?? "";
  const visible = callers.filter((caller) => {
    const generation = jsonRecord(caller.generation);
    const tags = callerTags(generation.topicTags);
    const appeared = caller.queueItems.some((item) => item.startedAt || item.status === "LIVE" || item.status === "COMPLETED");
    const statusMatch = !filters.status || filters.status === "all" || (filters.status === "archived" ? archivedStatuses.has(caller.status) : caller.status === filters.status);
    const appearanceMatch = !filters.appeared || filters.appeared === "all" || (filters.appeared === "appeared" ? appeared : !appeared);
    const haystack = [caller.firstName, caller.surnameInitial, caller.location, caller.occupation, caller.issueHeadline, caller.openingSummary, ...tags].filter(Boolean).join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && statusMatch && appearanceMatch && (!filters.tag || filters.tag === "all" || tags.includes(filters.tag));
  }).sort((a, b) => filters.sort === "az" ? `${a.firstName} ${a.surnameInitial ?? ""}`.localeCompare(`${b.firstName} ${b.surnameInitial ?? ""}`) : b.updatedAt.getTime() - a.updatedAt.getTime());

  const appearedCount = callers.filter((caller) => caller.queueItems.some((item) => item.startedAt || item.status === "LIVE" || item.status === "COMPLETED")).length;
  const approvedCount = callers.filter((caller) => caller.status === "APPROVED").length;
  const draftCount = callers.filter((caller) => caller.status === "DRAFT" || caller.status === "DEVELOPING").length;

  return <main className="shell"><StudioNav />
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Caller library</p><h1 className="title">Your callers</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Find someone ready to use, test their voice, or create the next caller without filling out a character dossier.</p></div><div className="flex flex-wrap gap-2"><Link className="button-secondary" href="/callers/new"><UserPlus className="h-4 w-4" /> Quick add</Link><Link className="button-primary" href="/callers/develop"><Sparkles className="h-4 w-4" /> Build with AI</Link></div></div>

    <div className="mt-6 grid grid-cols-3 gap-2 md:max-w-xl"><div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3"><p className="text-xl font-black text-white">{callers.length}</p><p className="mt-1 text-xs text-slate-500">total</p></div><div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3"><p className="text-xl font-black text-emerald-200">{approvedCount}</p><p className="mt-1 text-xs text-slate-500">ready</p></div><div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3"><p className="text-xl font-black text-cyan-200">{appearedCount}</p><p className="mt-1 text-xs text-slate-500">appeared</p></div></div>

    <form className="panel panel-pad mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_10rem_11rem_11rem_minmax(10rem,1fr)_auto]" action="/callers">
      <label><span className="label">Search</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className="field !pl-9" name="q" defaultValue={filters.q ?? ""} placeholder="Name, topic, location…" /></span></label>
      <label><span className="label">Sort</span><select className="field" name="sort" defaultValue={filters.sort ?? "recent"}><option value="recent">Most recent</option><option value="az">A–Z</option></select></label>
      <label><span className="label">Status</span><select className="field" name="status" defaultValue={filters.status ?? "all"}><option value="all">All statuses</option><option value="DRAFT">Draft</option><option value="APPROVED">Ready</option><option value="archived">Archived</option></select></label>
      <label><span className="label">History</span><select className="field" name="appeared" defaultValue={filters.appeared ?? "all"}><option value="all">Any history</option><option value="appeared">Appeared</option><option value="not-appeared">Not appeared</option></select></label>
      <label><span className="label">Topic</span><select className="field" name="tag" defaultValue={filters.tag ?? "all"}><option value="all">All topics</option>{tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
      <button className="button-secondary self-end" type="submit">Filter</button>
    </form>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-400">{visible.length} shown{draftCount ? ` · ${draftCount} draft${draftCount === 1 ? "" : "s"}` : ""}</p>{(query || (filters.status && filters.status !== "all") || (filters.appeared && filters.appeared !== "all") || (filters.tag && filters.tag !== "all")) && <Link className="text-xs font-bold text-cyan-200 hover:text-cyan-100" href="/callers">Clear filters</Link>}</div>

    <div className="mt-3 grid gap-3">{visible.map((caller) => {
      const generation = jsonRecord(caller.generation);
      const tags = callerTags(generation.topicTags);
      const portrait = caller.assets[0]?.url;
      const appeared = caller.queueItems.some((item) => item.startedAt || item.status === "LIVE" || item.status === "COMPLETED");
      const mode = typeof generation.callMode === "string" ? generation.callMode : null;
      return <article key={caller.id} className="panel flex items-center gap-4 p-4 transition hover:border-cyan-400/70">
        {portrait ? <img src={portrait} alt={`${caller.firstName} caller graphic`} className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xl font-black text-slate-950">{caller.firstName.slice(0, 1)}</div>}
        <Link href={`/callers/${caller.id}`} className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-white">{caller.firstName} {caller.surnameInitial}</h2><span className={`status ${caller.status === "APPROVED" ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-700 text-slate-200"}`}>{archivedStatuses.has(caller.status) ? "ARCHIVED" : caller.status === "APPROVED" ? "READY" : caller.status}</span>{appeared && <span className="status bg-cyan-400/10 text-cyan-200">APPEARED</span>}{mode && <span className="hidden rounded-full bg-slate-950 px-2 py-1 text-[10px] text-slate-400 sm:inline-flex">{mode}</span>}</div><p className="mt-1 truncate text-sm text-slate-200">{caller.issueHeadline}</p><p className="mt-1 text-xs text-slate-500">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p>{tags.length > 0 && <div className="mt-2 hidden flex-wrap gap-1 md:flex">{tags.slice(0, 4).map((tag) => <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-cyan-100" key={tag}>{tag}</span>)}</div>}</Link>
        <Link className="button-secondary !min-h-9 !px-3 text-xs" href={`/callers/${caller.id}/test`}><Headphones className="h-4 w-4" /><span className="hidden sm:inline">Test</span></Link>
      </article>;
    })}{visible.length === 0 && <div className="panel panel-pad text-slate-300">No callers match those filters. Clear a filter or build a new caller.</div>}</div>
  </main>;
}
