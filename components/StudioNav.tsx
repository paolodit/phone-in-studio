import Link from "next/link";
import { Plus, Radio, Settings } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { prisma } from "@/lib/prisma";

export async function StudioNav() {
  const shows = await prisma.show.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <>
      <nav className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div><Link href="/studio" className="text-lg font-black tracking-tight text-white">AI PHONE-IN <span className="text-cyan-300">/ STUDIO</span></Link><p className="mt-1 text-[10px] font-semibold tracking-wide text-slate-500">Made with <span aria-label="love" role="img">❤️</span> by <a className="text-slate-400 hover:text-cyan-300" href="https://www.twoguysonecat.com" target="_blank" rel="noreferrer">Two Guys One Cat</a></p></div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/studio">Studio</Link>
          <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/callers">Callers</Link>
          <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/shows">Shows</Link>
          <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/settings/modules" title="Settings"><Settings className="h-4 w-4" /><span className="sr-only">Settings</span></Link>
          <form action={logoutAction}><button className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">Sign out</button></form>
        </div>
      </nav>

      <aside className="fixed left-4 top-24 z-40 hidden w-[72px] rounded-2xl border border-slate-700/70 bg-slate-900/95 p-2 shadow-2xl shadow-black/30 backdrop-blur lg:block" aria-label="Show workspaces">
        <Link href="/shows" className="mb-2 flex h-12 w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200" title="All shows">
          <Radio className="h-5 w-5" />
          <span className="sr-only">All show workspaces</span>
        </Link>
        <div className="max-h-[calc(100vh-13rem)] space-y-2 overflow-y-auto">
          {shows.map((show) => <Link key={show.id} href={`/shows/${show.id}`} title={show.title} className="group flex h-12 w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-400 transition hover:border-cyan-300 hover:text-cyan-200">
            <Radio className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Open {show.title}</span>
          </Link>)}
        </div>
        <Link href="/shows?new=1" title="Create a show" className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-dashed border-cyan-300/50 text-cyan-300 transition hover:bg-cyan-300/10">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Create a show</span>
        </Link>
      </aside>

      <div className="-mt-4 mb-6 flex gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 p-2 lg:hidden" aria-label="Show workspaces">
        <Link href="/shows" className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-slate-800 px-3 text-xs font-bold text-slate-200"><Radio className="h-4 w-4" /> Shows</Link>
        {shows.map((show) => <Link key={show.id} href={`/shows/${show.id}`} className="flex h-10 max-w-40 shrink-0 items-center rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-bold text-slate-300"><span className="truncate">{show.title}</span></Link>)}
        <Link href="/shows?new=1" className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-dashed border-cyan-300/50 px-3 text-xs font-bold text-cyan-200"><Plus className="h-4 w-4" /> New show</Link>
      </div>
    </>
  );
}
