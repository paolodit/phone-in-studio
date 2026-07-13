import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth-actions";

export function StudioNav() {
  return (
    <nav className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
      <div><Link href="/studio" className="text-lg font-black tracking-tight text-white">AI PHONE-IN <span className="text-cyan-300">/ STUDIO</span></Link><p className="mt-1 text-[10px] font-semibold tracking-wide text-slate-500">Made with <span aria-label="love" role="img">❤️</span> by <a className="text-slate-400 hover:text-cyan-300" href="https://www.twoguysonecat.com" target="_blank" rel="noreferrer">Two Guys One Cat</a></p></div>
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/studio">Studio</Link>
        <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/callers">Callers</Link>
        <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/shows">Shows</Link>
        <form action={logoutAction}><button className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">Sign out</button></form>
      </div>
    </nav>
  );
}
