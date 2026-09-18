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
- `SIGNALWIRE_PROJECT_ID`
- `SIGNALWIRE_AUTH_TOKEN`
- `SIGNALWIRE_SPACE_URL`
- `OCULIVO_SMS_FROM_NUMBER`
- `OCULIVO_FAX_FROM_NUMBER`
- `OCULIVO_FAX_CALLBACK_SECRET`
- `OCULIVO_VOICE_FROM_NUMBER` (falls back to SMS number)
- `OCULIVO_SUPPORT_SECRET`
- `ROMYLABS_SUPPORT_API_URL`

## Closeout deployment rule

Work and regression-test in `sandbox/oculivo-closeout-20260913` first. Keep the one-commit release candidate on `release/oculivo-closeout-20260917`. Do not move production `main` until the sandbox build, provider-backed actions, route interactions, mobile layout, and Supabase/RLS checks are green. Use one controlled production deploy after closeout to avoid wasting Cloudflare build minutes.
