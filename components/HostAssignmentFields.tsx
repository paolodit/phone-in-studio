"use client";

import Link from "next/link";
import { useState } from "react";

export function HostAssignmentFields({ mode, profileId, profiles }: { mode: string; profileId: string | null; profiles: { id: string; name: string }[] }) {
  const [hostMode, setHostMode] = useState(mode);
  return <div className="mt-4 space-y-3">
    <input type="hidden" name="aiHostEnabled" value={hostMode === "HUMAN" ? "" : "on"} />
    <label className="block"><span className="label">Who hosts this show?</span><select className="field" name="hostMode" value={hostMode} onChange={(event) => setHostMode(event.target.value)}><option value="HUMAN">You · human host</option><option value="AI_SUPERVISED">AI presenter · one turn at a time</option><option value="AI_AUTONOMOUS">AI presenter · automatic conversations</option></select></label>
    <label className="block"><span className="label">Presenter</span><select className="field" name="hostProfileId" required={hostMode !== "HUMAN"} defaultValue={profileId ?? (profiles.length === 1 ? profiles[0].id : "")}><option value="">Choose a presenter</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
    {!profiles.length && <p className="text-sm text-amber-200"><Link href="/settings/modules/ai-host?profile=new" className="font-bold underline">Create a presenter first</Link>, then come back to choose it here.</p>}
    <p className="text-xs leading-5 text-slate-400">{hostMode === "HUMAN" ? "AI hosting is off for this show. Choose an AI presenter mode above to reveal its Studio controls." : hostMode === "AI_AUTONOMOUS" ? "Save below, open Studio, then press Start auto-run. Nothing starts or spends money until you press it." : "Save below, answer and connect a caller in Studio, then press AI host: one turn."}</p>
  </div>;
}
