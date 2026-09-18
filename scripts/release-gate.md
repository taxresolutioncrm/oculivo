# Oculivo release gate

The production release must remain blocked until all of the following are green on the exact release-candidate tree:

- `npm install`
- `npm run verify:closeout`
- `npm run build`
- Supabase migrations applied, including clinical read controls, communications controls, signed-clinical immutability, serialized appointment-conflict prevention, provider-message idempotency, and universal e-sign bucket hardening
- Required Edge Functions deployed with the JWT settings in `supabase/config.toml`
- Required provider secrets exist (values are never committed)
- Cross-tenant isolation checks pass
- Provider-backed outbound + inbound email/SMS, phone, fax, support, AI, and e-sign flows pass runtime smoke tests
- Mobile and desktop route smoke tests pass
- One production merge/deploy only after the exact candidate tree passes

Do not treat a Git merge or Cloudflare build alone as completion; verify the live app and website after deployment.
