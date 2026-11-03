# Oculivo CRM — functional readiness audit and closeout register
Audit date: 2026-11-03. Scope: `taxresolutioncrm/oculivo` only. Production baseline: `9abddfbef9aa9c4557272a5d0236c324cca5a49a`.

## Facts verified in repository

- Website `oculivo.com` and CRM `app.oculivo.com` use different deployments; Oculivo CRM Supabase project is `czejdbdwaumbdepiswcu`.
- Public launch is **not** the same as production acceptance. The user has confirmed that core tab navigation stopped flickering after the prior production release, but no signed-in end-to-end run has certified every module.
- Current navigation routes: Overview, Schedule, Patients, Clinical, Optical, Inbox, Email Blast, Phone, Team Chat, Timeclock, Billing, Documents, E-Signatures, Reports, Manual and Support.
- Existing source has an AI assistant drawer that calls the `oculivo-ai` Edge Function. The function's default model is `gpt-5-mini`. API key, backend deployment, authorization, error responses and live model output are **not** independently verified.
- Team Chat supports scoped channels, messages and realtime refresh. Full Training, guest meeting invites, video huddles, screen share and browser fullscreen are **not implemented in production**. PR #22 is a scope document, not code.
- Phone/Inbox use Supabase conversation records, provider-backed Edge Functions and per-practice membership checks. Actual provider credentials, call media, provider callbacks, fax delivery, message delivery and inbox sync are **not certified**.
- E-sign frontend, public sign route and universal e-sign Edge Function exist. Actual secure link, certificate generation, completion PDF and auto-archival behavior remain **runtime-unverified**.
- Multi-office default is one Oculivo Supabase project with organization/tenant membership and RLS. Cross-practice certification must verify denied reads/writes and private storage on both anonymous and authenticated paths.
- Repo has provider-backed integration code but its secrets and migrations cannot be considered deployed merely because source files exist.
- Production release manifest is v3.0.0, but the manifest still shows `Pending production deployment`. Align the released-at metadata at the next **authorized** release, preserving independent versioning.

## Sandbox stabilization work in this branch

1. Communications membership lookups deduplicated per signed-in user and selected practice; changing offices clears role authorization until revalidated.
2. Inbox query responses guarded by the active office and latest request ID. Thread/message state and unsent draft text clear on office changes.
3. Phone conversation fetches ignore stale office results. Thread selection is disabled during an in-progress call.
4. Reports count requests ignore stale responses after changing office; all nine metric cards navigate to the correct operational route with keyboard-focus styling.
5. Source regression checks for these invariants added to `verify:closeout`. README AI model and release instructions corrected.

This branch has not deployed. Even a green build does not certify the next gates.

## Route-by-route acceptance matrix

| Module | Existing source | Next required runtime evidence |
|---|---|---|
| Overview | Counts, appointments and status | Authenticated load, correct data per practice, no blank-screen flash |
| Schedule | Appointment create/edit/delete and providers | Create, reopen, edit, delete; chronological ordering; role access |
| Patients | Profile, intake and related records | Create/edit/archive, patient history, stale request protection |
| Clinical | Clinical records and signing | Provider-only access; sign locking; record audit; cross-practice denies |
| Optical | Inventory and orders | Create order/item, stock data accuracy, cross-practice protection |
| Inbox | Email/SMS threads and reply | Actual send + receive, messages stay on selected thread and practice |
| Email Blast | Existing UI and backend function | Template, audience scope, safe recipients, deliverability and tracking |
| Phone | Browser calling, history, outbound PDF fax | Two-way audio, hangup cleanup, call state, fax receipt and provider callbacks |
| Team Chat | Channels, messages and realtime | Create/post, presence across two accounts, permissions; huddles remain a new feature |
| Timeclock | Employee time entries | Clock-in/out correctness, date handling, office/role boundaries |
| Billing | Invoices, claims, payments | Totals, payment persistence, refund/negative cases, authorization |
| Documents | Private upload, preview and deletion | Upload, open, preview, signed URLs, rejected unauthorized access |
| E-Signatures | Internal send/public signer workflow | Drag/required fields, completion/audit evidence, PDF/cert, expiry/revocation |
| Reports | Aggregated counts, now linked to modules in sandbox | Count accuracy, links, reloads and office switching |
| Manual | EN/ES guidance | Correct and current workflows with linked training |
| Support | Ticket form and portal bridge | Submit, notification, admin assignment and reply |
| AI assistant | Drawer, practice-scoped backend | Prompt, context boundaries, Spanish response, bad API key, retry and limits |
| Training | Not in production | Dedicated feature implementation, secured guest join and media runtime certification |

## Cross-cutting release gates

- [ ] Exact candidate `npm run verify:closeout` and `npm run build` PASS
- [ ] No unauthorized data in another practice (RLS, Auth, Storage, Edge Functions, search, AI)
- [ ] Desktop + mobile (small iPhone, tablet, wide desktop), light/dark where supported, EN/ES
- [ ] No uncontrolled refresh, flicker, repeated queries, lost drafts or broken tabs
- [ ] Validated provider-backed email, SMS, phone, fax, support, AI and e-sign paths
- [ ] All relevant Supabase migrations, Edge Functions, secrets and storage bucket policies verified in project `czejdbdwaumbdepiswcu`
- [ ] Real practice can sign in and navigate each module without UI errors
- [ ] Office creation and membership roles verified with two distinct tenant accounts
- [ ] Correct Oculivo version, release notes and production SHA shown following deploy
- [ ] Exactly one authorized production merge/deploy followed by live verification

### Order of work
1. Stabilize authorization, cross-office data, tab transitions, and functional navigation (**this sandbox branch**).
2. Certify/create/edit/view core workflows and accurate cards/metrics.
3. Configure and certify external communications/AI/e-sign against existing providers (no new paid tools).
4. Implement real Training/huddles on its own dedicated branch and security-tested backend.
5. Complete cross-tenant, mobile, bilingual and release certification; deploy only on explicit request.

Do not merge this audit as evidence of completed runtime tests, and never equate Cloudflare success with functional readiness.
