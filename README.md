# Oculivo CRM

Oculivo is RomyLabs practice management software for optometry, ophthalmology, and optical operations.

- Production app: https://app.oculivo.com
- Marketing: https://oculivo.com
- Backend: Supabase project `czejdbdwaumbdepiswcu`
- Deployment target: Cloudflare Pages
- GitHub Actions: intentionally unused

## Edge Function secrets

Configure these in the Oculivo Supabase project's Edge Function secrets before provider-backed controls are considered production-ready:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (Oculivo AI)
- `OCULIVO_AI_MODEL` (optional; defaults to `gpt-5.6-luna`)
- `BREVO_API_KEY` (email)
- `OCULIVO_FROM_EMAIL` (email sender)
- `OCULIVO_INBOUND_EMAIL_SECRET` (signs the per-practice Brevo inbound parsing webhook URL)
- `SIGNALWIRE_PROJECT_ID`
- `SIGNALWIRE_AUTH_TOKEN`
- `SIGNALWIRE_SPACE_URL`
- `OCULIVO_SMS_FROM_NUMBER`
- `OCULIVO_INBOUND_SMS_SECRET` (signs the per-practice inbound SMS webhook URL)
- `OCULIVO_FAX_FROM_NUMBER`
- `OCULIVO_FAX_CALLBACK_SECRET`
- `OCULIVO_VOICE_FROM_NUMBER` (falls back to SMS number)
- `OCULIVO_SUPPORT_SECRET`
- `ROMYLABS_SUPPORT_API_URL`

## Closeout deployment rule

Work and regression-test in `sandbox/oculivo-closeout-20260913` first. Keep the one-commit release candidate on `release/oculivo-closeout-20260917`. Do not move production `main` until the sandbox build, provider-backed actions, route interactions, mobile layout, and Supabase/RLS checks are green. Use one controlled production deploy after closeout to avoid wasting Cloudflare build minutes.

## Inbound communications

Inbound SMS and email are handled by `receive-sms` and `receive-email`. Both are public provider webhooks with JWT verification disabled at the gateway and an HMAC signature verified in the function before any service-role write. Configure each practice's provider callback URL with its organization ID and the precomputed HMAC of that ID using the corresponding inbound secret. Brevo inbound parsing should POST its structured `items` payload to `receive-email`; SignalWire messaging should POST the standard `From`, `To`, and `Body` form fields to `receive-sms`.
