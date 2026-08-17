# Research and experimentation roadmap

AI Phone-In Studio is both a production tool and an open testbed for live, human-directed AI conversation. The research question is practical:

> What does an AI voice system need to do reliably before a human presenter can treat it as a controllable live contributor rather than a chatbot with a microphone?

The roadmap focuses on observable behaviour in real production conditions. It does not assume that one model or provider will always be best.

## Research themes

### 1. Turn-taking and deliberate interruption

Live conversation depends on more than speech recognition. The system needs to distinguish a meaningful hand-off from a pause, room noise or a presenter thinking aloud.

Experiments will measure:

- time from the host finishing a turn to the caller starting;
- false starts caused by incidental noise;
- responses triggered before the host has finished;
- explicit host interruption and caller stop time;
- recovery after interruption, hold and resume;
- differences between automatic barge-in and deliberate presenter control.

The initial comparison covers OpenAI Realtime, Gemini Live and ElevenLabs Conversational AI using the same caller and room conditions.

### 2. Character consistency under live pressure

A convincing caller must retain a situation, point of view and speech style without reciting a prepared biography.

Experiments will test:

- consistency across short and extended conversations;
- handling of unexpected questions and topic changes;
- variation without contradicting private caller facts;
- resistance to revealing private producer notes;
- natural openings, hesitations, corrections and endings;
- whether response-length and pace controls survive a real exchange.

### 3. Latency, audio quality and recovery

A broadcast tool must make failure visible and recoverable.

The project will document:

- connection and first-response latency;
- microphone and output-device behaviour;
- reconnection after provider, network or device failure;
- audible transitions between incoming, connected, held and ended states;
- provider failover approaches;
- caller audio metering and EQ behaviour in the programme output.

### 4. Human editorial control and broadcast safety

The host and producer remain responsible for what reaches the audience.

Experiments will verify that:

- AI-developed callers remain private until reviewed and approved;
- soundchecks cannot alter the live queue or broadcast state;
- private prompts, story mechanics and API credentials never enter public output;
- prepared visuals are selected deliberately rather than published automatically;
- attribution survives from stock-image selection to broadcast display;
- the presenter can mute, interrupt, hold or end a caller immediately.

### 5. Evaluation methods for live creative AI

Most conversational benchmarks do not capture the realities of a live show. The project will develop reusable evaluation material for human-directed voice formats:

- fixed host prompts for provider comparisons;
- repeatable noisy-room and interruption scenarios;
- session logs containing timing and state transitions;
- human scoring for naturalness, controllability and character coherence;
- automated regression checks for queue, privacy and output behaviour;
- published findings, limitations and reproducible configurations.

## Proposed experimental phases

### Phase 1 — Baseline

- Record the same short show using each supported voice route.
- Establish latency, turn-taking and interruption baselines.
- Publish the test script, equipment and configuration.
- Identify failure cases worth reproducing automatically.

### Phase 2 — Real-room robustness

- Test different microphones, headphones, speakers and ambient-noise levels.
- Exercise reconnect, device change, hold, resume and provider failure.
- Add automated checks where failures can be reproduced deterministically.

### Phase 3 — Character and format range

- Compare advice, opinion, storytelling, specialist and competition callers.
- Test short and long sessions.
- Evaluate persona consistency and private-information boundaries.
- Document which controls should belong to the caller, show or provider adapter.

### Phase 4 — Open reference release

- Publish anonymised results and reusable test scenarios.
- Package known-good show configurations and broadcast layouts.
- Improve contributor documentation and issue templates.
- Invite independent producers and developers to repeat the tests.

## Intended outputs

- An openly licensed production toolkit.
- Provider-neutral voice adapter patterns.
- Reproducible live-conversation test scenarios.
- Practical measurements for latency, interruption and recovery.
- Privacy and editorial-control regression tests.
- Written findings for independent media creators and AI interface developers.

## Near-term engineering work

- Real-room tuning for OpenAI Realtime, Gemini Live and ElevenLabs.
- More robust reconnection, device switching and provider failover.
- End-to-end browser automation for Studio and broadcast interactions.
- Structured session metrics that exclude caller secrets and personal data.
- A reusable media library with licence-review notes.
- Safe-area and theme controls for additional broadcast formats.

## Related interface experiment

[Build Inbox](https://github.com/paolodit/build-inbox) explored voice, screenshots and live browser context as a way to turn an informal product walkthrough into a structured Codex task. It remains an open local-first proof of concept and provides useful precedent for this project's approach: build the interaction first, make the workflow inspectable, and publish what was learned.
