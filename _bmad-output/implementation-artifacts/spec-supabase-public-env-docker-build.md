---
title: 'Build browser Supabase configuration into Docker image'
type: 'bugfix'
created: '2026-10-01'
status: 'in-progress'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="user-approved deployment/auth configuration fix">

## Intent

**Problem:** The production image is built without the public Supabase URL/key, so Next.js emits a browser bundle where the client configuration is undefined. The app's configured public key is the publishable key, while the current accessor only reads the legacy anon-key variable.

**Approach:** Pass the public URL and publishable key as Docker build args from the deploy script, preferring the publishable key and accepting the legacy anon key as a fallback. Keep the service-role key runtime-only and preserve existing deployment edits.

</frozen-after-approval>

## Implementation Notes

- Update `lib/supabase/env.ts` to resolve the publishable key first and the legacy anon key second.
- Update the Docker builder stage and `scripts/deploy.sh` to supply and validate only public Supabase settings at build time, sourcing values from process environment or `.env.local`.
- Update `.env.example` and add focused tests for key precedence and fallback.
- Existing `spec-docker-traefik-deployment.md` disallows app-source/test changes; the user's current request explicitly authorizes this targeted auth configuration fix, superseding that earlier boundary only for this change.
- No deployment command or external side effect is part of implementation; verification is limited to local checks.
