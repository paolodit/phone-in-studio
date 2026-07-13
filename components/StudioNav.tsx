import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth-actions";

export function StudioNav() {
  return (
    <nav className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
      <Link href="/studio" className="text-lg font-black tracking-tight text-white">AI PHONE-IN <span className="text-cyan-300">/ STUDIO</span></Link>
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/studio">Studio</Link>
        <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/callers">Callers</Link>
        <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/shows">Shows</Link>
        <form action={logoutAction}><button className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">Sign out</button></form>
      </div>
    </nav>
  );
}
