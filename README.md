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
- `OPENAI_MODEL` (optional; defaults in function)
- `BREVO_API_KEY` (email)
- `OCULIVO_FROM_EMAIL` (email sender)
- `SIGNALWIRE_PROJECT_ID`
- `SIGNALWIRE_AUTH_TOKEN`
- `SIGNALWIRE_SPACE_URL`
- `OCULIVO_SMS_FROM_NUMBER`
- `OCULIVO_VOICE_FROM_NUMBER` (falls back to SMS number)
- `OCULIVO_SUPPORT_SECRET`
- `ROMYLABS_SUPPORT_API_URL`

## Closeout deployment rule

Work and regression-test in `final-crm-closeout` first. Do not merge or deploy production changes until the branch build, provider-backed actions, route interactions, mobile layout, and Supabase/RLS checks are green. Use one controlled production deploy after closeout to avoid wasting Cloudflare build minutes.
