# Oculivo — Live Training / Screen Share functional parity

**Status: implementation scoped; not deployed and not certified.**

## Source of truth
- Reference product: Restore Relay CRM
- Reference repository: `taxresolutioncrm/restore-relay-crm`
- Reference production release: `v3.1.11`
- Reference merge: `c2fe23e443b7dbbc4cf7854826d94dba445d7b0a`
- Reference frontend: `src/pages/TrainingPage.tsx`, `src/pages/ScreenShareHostPage.tsx`, `src/styles/global.css`.
- Reference meeting/signaling: `src/lib/webrtcRoom.ts` and related contexts.
- This specification applies **only to Oculivo**. Never copy reference branding, credentials, office IDs, email identity, or URLs.

## Oculivo baseline verified on 2026-10-28
The production `main` tree contains no Training/Screen Share page, meeting-room/WebRTC signaling module, public participant join route, training invitation Edge Function, or meeting-specific storage/migrations. Oculivo does have a browser phone capability, which is not a replacement for training. Therefore **this is a new end-to-end feature**, not a safe UI-only transplant. Do not surface a working-looking Training button until the required systems actually work.

## Required implementation (scope locked)
1. Add role-authorized Training route and host workflow within the current Oculivo navigation/router; preserve branding and tenant isolation.
2. Use an office-scoped meeting ID and secure participant join capability. Public join must not expose the CRM session, patient data, or authenticated tenant queries. Implement server-validated, expiring join authorization and least-privilege signaling channels/policies for public participants.
3. Implement room signaling and media using existing free/shared WebRTC/TURN-STUN configuration where appropriate. No paid provider, no imported Restore Relay secrets. Keep media peer-to-peer where suitable; ensure ICE/renegotiation/reconnect and device cleanup.
4. Host controls: session start/end, screen sharing, mic/camera toggles, local and remote camera streams, connected participant presence and list. Preserve any existing working capabilities, not a rewrite of Oculivo phone service.
5. Polished Participant Invite card: truncating read-only URL field, Copy Link with success state, expandable Email Invite for comma-separated valid recipients, disabled empty sends, connected count and participant empty/list states.
6. Email invite uses Oculivo's existing email provider and an authenticated, office-scoped backend. Never introduce a new provider.
7. Presentation-first meeting canvas while sharing: large shared screen with small floating host/remote camera tiles; gallery when not sharing. Keep controls visible and responsive.
8. True browser Fullscreen API on full meeting container, Full screen/Exit full screen toggle, double-click presentation area, cleanup on fullscreen exit.
9. Desktop/tablet/mobile layouts; long URLs and invitation controls must never overflow, and camera tiles must not block controls.
10. Ensure clean end-of-session shutdown of audio/video/screen tracks, subscriptions, peer connections, and session state.
11. Keep Oculivo branding, existing authentication, Supabase project `czejdbdwaumbdepiswcu`, office isolation, and permissions. New SQL/functions, if required, must be provided for user-run Supabase changes using exact steps; do not assume deployed.

## Release acceptance — all must be evidenced
- [ ] Training opens and host start/end works.
- [ ] Secure join link generated; guest join works without CRM authentication while remaining scope-limited.
- [ ] Copy Link success, multi-email invite using current provider, connected count/list, responsive empty state.
- [ ] Host and participant camera visible; screen share dominant; floating camera tiles when presenting.
- [ ] Fullscreen button, exit button, and double-click toggle work on meeting container.
- [ ] Bidirectional two-device microphone/audio, mute/unmute, audio continuity during screen share, and clean disconnect tested.
- [ ] Reconnection, renegotiation, ICE restart, and existing TURN/STUN behavior tested.
- [ ] Cross-practice/tenant permissions, expiry/revocation, guest privacy, and authenticated operations tested.
- [ ] Desktop/tablet/mobile smoke tests pass.
- [ ] No provider/branding/phone regression, no paid infrastructure, no unrelated modules changed.
- [ ] Exact candidate 0 commits behind `main`.
- [ ] Exact candidate production build, verifier/security checks, and Cloudflare sandbox SHA green.
- [ ] One explicitly authorized production merge/deploy and live SHA/runtime verification.

## Versioning
Keep Oculivo's independent release manifest and version history. Feature changes are normally minor-version material, but **do not bump visible production version in sandbox**, and never claim training shipped until production verifies.

## Protocol
Sandbox first. No speculative SQL, no pasted secrets, no production merge/deploy without explicit instruction. A Cloudflare green build alone is not functional certification. This file records requirements and unimplemented prerequisites; it does not claim Training was built.
