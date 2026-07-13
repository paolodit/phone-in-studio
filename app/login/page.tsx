import { loginAction } from "@/lib/actions/auth-actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#15375b,transparent_45%),#09101c] p-5">
      <form action={loginAction} className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/90 p-7 shadow-2xl shadow-black/40">
        <p className="eyebrow">Private production access</p>
        <h1 className="mt-2 text-3xl font-black text-white">AI Phone-In</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">Sign in to build callers, assemble the running order and operate the live studio.</p>
        {params.error && <p className="mt-4 rounded-lg bg-red-500/15 p-3 text-sm text-red-200">The password was not accepted.</p>}
        <label className="mt-6 block"><span className="label">Admin password</span><input className="field" name="password" type="password" required autoFocus /></label>
        <button className="button-primary mt-6 w-full" type="submit">Enter Studio</button>
      </form>
    </main>
  );
}
