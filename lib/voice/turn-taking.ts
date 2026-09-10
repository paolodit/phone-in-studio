/** Acknowledgements only suppress a turn when they overlap caller speech.
 * A short answer ("yes", "no") during a normal host turn must still get a reply.
 * This is an English transcript heuristic, not an acoustic speech classifier. */
export function shouldTakeFloor(text: string, final = true) {
  const words = text.toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/[^a-z'\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const phrase = words.join(" ");
  if (/^(stop|wait|hang on|hold on|let me|can i|could i|but wait)\b/.test(phrase)) return true;
  const acknowledgements = /^(uh huh|uhuh|mm hmm|mhm|hmm|mm|um|uh|erm|er|ah|oh|yes|yep|yeah|no|right|okay|ok|sure|absolutely|exactly|i see|go on|carry on|really)( (uh huh|mm hmm|hmm|mm|um|uh|er|ah|oh|yes|yep|yeah|no|right|okay|ok|sure|absolutely|exactly|i see|go on|carry on|really))*$/;
  if (acknowledgements.test(phrase)) return false;
  const meaningful = words.filter((word) => !["um", "uh", "erm", "er", "hmm"].includes(word));
  // Partial transcripts can change. Require a phrase before acting on one.
  return meaningful.length >= (final ? 2 : 4) || (final && phrase.endsWith("why"));
}

type HostTurn = { id: string; overlap: boolean; committed: boolean; accepted: boolean; text: string };

/** Keeps response creation serial, and never cancels audio just because VAD
 * heard something. Non-overlapping turns answer at the semantic endpoint;
 * overlapping turns need meaningful transcribed words first. */
export class RealtimeTurnTaking {
  private active = false;
  private playing = false;
  private cancelling = false;
  private pending = false;
  private turns = new Map<string, HostTurn>();
  constructor(private send: (event: Record<string, unknown>) => void, private guarded = true) {}

  private drain() {
    if (!this.pending || this.active) return;
    this.pending = false;
    this.active = true; // Includes a response.create awaiting response.created.
    this.send({ type: "response.create" });
  }
  requestReply() { this.pending = true; this.drain(); }
  responseStarted() { this.active = true; }
  responseFinished() { this.active = false; this.cancelling = false; this.drain(); }
  playbackChanged(playing: boolean) { this.playing = playing; }
  setGuarded(guarded: boolean) { this.guarded = guarded; }
  takeFloor() {
    this.interrupt();
    // A button press also authorises an utterance already in progress.
    for (const turn of this.turns.values()) if (!turn.committed) turn.accepted = true;
  }
  interrupt() {
    this.pending = false;
    if (this.active && !this.cancelling) {
      this.cancelling = true;
      this.send({ type: "response.cancel" });
    }
    if (this.playing) this.send({ type: "output_audio_buffer.clear" });
    this.playing = false;
  }
  speechStarted(id: string) {
    this.turns.set(id, { id, overlap: this.playing || this.active, committed: false, accepted: false, text: "" });
    // Transcription may fail. Keep bounded history without losing concurrent turns.
    if (this.turns.size > 16) this.turns.delete(this.turns.keys().next().value!);
  }
  speechCommitted(id: string) {
    if (!this.turns.has(id)) this.speechStarted(id);
    const turn = this.turns.get(id);
    if (!turn) return;
    turn.committed = true;
    if (!turn.overlap || turn.accepted) this.requestReply();
  }
  transcript(id: string, text: string, final: boolean) {
    const turn = this.turns.get(id);
    if (!turn) return;
    turn.text = final ? text : turn.text + text;
    if (turn.overlap && !turn.accepted && this.guarded && shouldTakeFloor(turn.text, final)) {
      turn.accepted = true;
      this.interrupt();
      if (turn.committed) this.requestReply();
    }
    if (final && turn.committed) this.turns.delete(id);
  }
}
