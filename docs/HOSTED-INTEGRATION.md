# Optional hosted integration (contract v1)

The container uses Node 24. Operators may mount a read-only JSON Docker secret and set `RUNTIME_CONFIG_FILE` to its path; the optional startup loader applies its string environment values to migrations and the app. Never put secret files in the build context. Ordinary environment variables remain supported.

The same studio source and image support self-hosting and managed installations. All settings are runtime environment variables; no commercial fork is required.

Leave HOSTED_MODE, HOSTED_PLATFORM_URL and HOSTED_INSTANCE_TOKEN unset for normal self-hosting.

For a managed installation set HOSTED_MODE=true, HOSTED_PLATFORM_URL to an HTTPS origin, and HOSTED_INSTANCE_TOKEN to a credential scoped to that installation. Each installation must have an independent DATABASE_URL, AUTH_SECRET, artwork volume and hostname. Do not supply provider API keys to hosted installations. Their own hostname uses a host-only login cookie.

The configured platform implements these authenticated JSON endpoints:
- POST /api/v1/auth/exchange: accepts a single-use short-lived code; returns sessionToken and expiresIn.
- POST /api/v1/auth/check: validates the hosted sessionToken, including revocation.
- GET /api/v1/balance: returns availableMicros (USD millionths), optional displayBalanceMicros for live display, voiceMicrosPerMinute, generations and an HTTPS accountUrl.
- POST /api/v1/live/sessions: accepts Live session instructions/audio and WebRTC transport SDP; returns the provider-compatible session.id and transport.sdp.
- POST /api/v1/live/close: accepts sessionId, verifies installation ownership and ends it.
- POST /api/v1/generate: accepts a bounded named structured generation, returning a Responses-compatible object.

All requests authenticate with Authorization: Bearer HOSTED_INSTANCE_TOKEN. Mutating requests include Idempotency-Key. A retry of a submitted billable operation must not start duplicate work. The platform owns account identity, pricing, atomic reservations, provider credentials, authoritative usage, spending cutoffs and session cleanup. Balance UI is informational and never authorizes a request.

Hosted sign-in begins at the platform and redirects to /api/hosted/authorize?code=... . Codes are redeemed server-to-server, once, for the specific installation. Hosted mode rejects the local admin-password login and treats a platform outage as unauthenticated. HTTPS is required in production.

Initially hosted voice uses GPT-Live. Realtime, Gemini, ElevenLabs, Fish, AI images, AI Host and Caller Factory are unavailable in hosted mode. Plain editing and multiple show workspaces remain supported. The platform must enforce allowed generation names and model limits independently of the public app.

Deploy a tested image version; do not rebuild customized customer forks. Apply migrations before readiness, preserve uploaded artwork, and update between active calls and local recordings. Container environment secrets and customer data must never enter the build context.
