type CallerValues = {
  firstName?: string; surnameInitial?: string | null; age?: number | null; location?: string; occupation?: string | null; relationshipStatus?: string | null;
  issueHeadline?: string; openingSummary?: string; character?: unknown; story?: unknown; performance?: unknown; hostSupport?: unknown;
  assets?: { type: string; url: string }[];
};

const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const lines = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";

export function CallerEditor({ action, caller, submitLabel }: {
  action: (formData: FormData) => void | Promise<void>;
  caller?: CallerValues;
  submitLabel: string;
}) {
  const character = object(caller?.character);
  const story = object(caller?.story);
  const performance = object(caller?.performance);
  const hostSupport = object(caller?.hostSupport);
  const portrait = caller?.assets?.find((asset) => asset.type === "PORTRAIT")?.url ?? "";
  return (
    <form action={action} className="space-y-6">
      <section className="panel panel-pad"><h2 className="font-bold text-white">Public identity</h2><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label><span className="label">First name</span><input className="field" name="firstName" defaultValue={caller?.firstName} required /></label>
        <label><span className="label">Surname initial</span><input className="field" name="surnameInitial" defaultValue={caller?.surnameInitial ?? ""} placeholder="M" /></label>
        <label><span className="label">Age</span><input className="field" name="age" type="number" min="18" max="120" defaultValue={caller?.age ?? ""} /></label>
        <label><span className="label">Location</span><input className="field" name="location" defaultValue={caller?.location} required /></label>
        <label><span className="label">Occupation / identity</span><input className="field" name="occupation" defaultValue={caller?.occupation ?? ""} /></label>
        <label><span className="label">Relationship status</span><input className="field" name="relationshipStatus" defaultValue={caller?.relationshipStatus ?? ""} /></label>
      </div></section>
      <section className="panel panel-pad"><h2 className="font-bold text-white">Public premise and asset</h2><div className="mt-4 grid gap-4 md:grid-cols-2">
        <label><span className="label">Issue headline</span><input className="field" name="issueHeadline" defaultValue={caller?.issueHeadline} required /></label>
        <label><span className="label">Portrait URL</span><input className="field" name="portraitUrl" type="url" defaultValue={portrait} placeholder="https://…" /></label>
        <label className="md:col-span-2"><span className="label">Opening summary</span><textarea className="field min-h-24" name="openingSummary" defaultValue={caller?.openingSummary} required /></label>
      </div></section>
      <section className="panel panel-pad"><h2 className="font-bold text-white">Private character card</h2><div className="mt-4 grid gap-4 md:grid-cols-2">
        <label><span className="label">Central want</span><textarea className="field min-h-20" name="centralWant" defaultValue={string(character.centralWant)} required /></label>
        <label><span className="label">Worldview</span><textarea className="field min-h-20" name="worldview" defaultValue={string(character.worldview)} required /></label>
        <label><span className="label">Actual behaviour</span><textarea className="field min-h-20" name="actualBehaviour" defaultValue={string(character.actualBehaviour)} required /></label>
        <label><span className="label">Comic contradiction</span><textarea className="field min-h-20" name="comicContradiction" defaultValue={string(character.comicContradiction)} required /></label>
        <label><span className="label">Speech style</span><textarea className="field min-h-20" name="speechStyle" defaultValue={string(character.speechStyle)} required /></label>
        <label><span className="label">Selected voice</span><input className="field" name="voiceId" defaultValue={string(performance.voiceId, "mock-warm-voice")} required /></label>
        <label className="md:col-span-2"><span className="label">Hidden truth</span><textarea className="field min-h-20" name="hiddenTruth" defaultValue={string(story.hiddenTruth)} required /></label>
        <label><span className="label">Escalation beats (one per line)</span><textarea className="field min-h-28" name="escalationBeats" defaultValue={lines(story.escalationBeats)} required /></label>
        <label><span className="label">Suggested host questions (one per line)</span><textarea className="field min-h-28" name="suggestedQuestions" defaultValue={lines(hostSupport.suggestedQuestions)} required /></label>
      </div></section>
      <button className="button-primary" type="submit">{submitLabel}</button>
    </form>
  );
}
