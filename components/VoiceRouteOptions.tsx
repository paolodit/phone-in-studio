export function VoiceRouteOptions() {
  return <>
    <option value="openai">OpenAI Realtime 1.5 (default)</option>
    <option value="openai-live">OpenAI GPT-Live-1 (full duplex)</option>
    <option value="gemini">Gemini Live (optional)</option>
    <option value="elevenlabs">ElevenLabs Agent (optional)</option>
    <option value="fish">Fish Audio S2.1 (turn-based)</option>
  </>;
}
