---
title: "Docker + Docker Compose + Traefik deployment for the archer app"
type: "chore"
created: "2026-08-31"
status: "in-progress"
baseline_commit: "1b4d7f84d43bb57b44c765cb7900a90d0728ad98"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `archer/` Next.js app can only be run via `npm run dev`/`npm start` on a developer machine. There is no reproducible, containerized way to build and serve it behind a reverse proxy with TLS.

**Approach:** Add a multi-stage production Dockerfile using Next.js `output: "standalone"` and a `docker-compose.yml` that runs ONLY the app container, attaching it to an existing externally-managed Traefik network via routing labels. Traefik itself (and its TLS/ACME) is run separately by the user. Supporting files (`.dockerignore`, `.env.example`) keep secrets out of the image and inject them at runtime.

## Boundaries & Constraints

**Always:** Keep the app self-contained under `archer/` for the build; run the container as a non-root user; expose the app on port 3000 internally and let the external Traefik handle inbound HTTP/HTTPS via labels; inject AI provider keys (`AI_PROVIDER`, `GEMINI_API_KEY`, etc.) via environment at runtime, never baked into the image; pin base images to a specific Node LTS tag.

**Ask First:** Committing any real API key value; changing app source code beyond the single `next.config.ts` line needed to enable standalone output; choosing a hosting domain (use placeholder `example.com` / default `localhost` the user replaces).

**Never:** Modify application logic, templates, tests, or the API route behavior; use static export (the `/api/generate` route requires a Node server); store secrets in the image or in committed compose files; define a Traefik service or manage TLS/ACME in this compose file (Traefik is user-managed externally).

## I/O & Edge-Case Matrix

| Scenario                 | Input / State                                                                                | Expected Output / Behavior                                                                                     | Error Handling                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| App run behind Traefik   | `docker compose up -d` with `.env`/`archer/.env` present and external `web` network existing | archer container starts, joins the `web` network, and is routable by the external Traefik on `Host(${DOMAIN})` | Container restarts on crash (restart policy)                         |
| Missing external network | External `web` network does not exist                                                        | `docker compose up` fails fast with a clear "network not found" error                                          | User creates network (`docker network create web`) per DEPLOYMENT.md |
| Missing provider key     | Container started without `GEMINI_API_KEY`                                                   | App boots and serves UI; `/api/generate` returns 500 with configured error message                             | Existing route error handling returns JSON error                     |
| Image build              | `docker build` in `archer/`                                                                  | Standalone server image produced, no dev deps or source secrets included                                       | Build fails loudly if `next build` fails                             |

</frozen-after-approval>

## Code Map

- `archer/next.config.ts` -- currently near-empty `NextConfig`; add `output: "standalone"` so `next build` emits `.next/standalone` for a minimal runtime image.
- `archer/package.json` -- scripts (`build`, `start`) and deps confirm a Node server app (Next 16.3.3, React 19); standalone server entry is `.next/standalone/server.js`.
- `archer/app/api/generate/route.ts` -- server-only API route reading `process.env` (`AI_PROVIDER`, `*_API_KEY`, `*_MODEL`); confirms runtime env injection is required and static export is impossible.
- `archer/.env.local` -- existing runtime config shape; the container reads the same variable names. Stays gitignored; NOT copied into image.
- `archer/.gitignore` -- already ignores `.env*`, `/.next/`, `/node_modules`; new `.dockerignore` mirrors this for build context.
- `archer/README.md` -- lists provider env vars; deployment docs will reference the same names.

## Tasks & Acceptance

**Execution:**

- [ ] `archer/next.config.ts` -- add `output: "standalone"` to `nextConfig` -- produces the minimal standalone server bundle for the runtime image.
- [ ] `archer/Dockerfile` -- create multi-stage build (deps → build → runner): stage 1 installs deps with `npm ci`, stage 2 runs `npm run build`, stage 3 uses a slim Node LTS image, copies `.next/standalone`, `.next/static`, and `public`, runs as non-root `node` user, `EXPOSE 3000`, `CMD ["node", "server.js"]` -- containerizes production runtime without dev deps or source.
- [x] `archer/.dockerignore` -- exclude `node_modules`, `.next`, `out`, `.env*`, tests recursively, and VCS files -- keeps build context small and secrets out of the image.
- [ ] `docker-compose.yml` (repo root) -- define ONLY the `archer` service (built from `./archer`, `env_file: ./archer/.env`, restart policy, Traefik routing labels using `${DOMAIN}` host rule) attached to an `external: true` network (`web`) owned by the user's separately-managed Traefik -- app deployment that plugs into an existing reverse proxy.
- [ ] `.env.example` (repo root) -- document `DOMAIN` for compose -- gives the user a template to copy to `.env` without committing secrets.
- [ ] `archer/.env.example` -- template of app runtime vars (`AI_PROVIDER`, `GEMINI_API_KEY`, etc.) copied to `archer/.env` for the container -- keeps real keys out of version control.
- [ ] `DEPLOYMENT.md` (repo root) -- document prerequisites (external Traefik + network), env setup, run commands, and how to adjust labels to the user's Traefik -- makes the deployment reproducible.

**Acceptance Criteria:**

- Given the repo root with a populated `.env`, `archer/.env`, and an existing external `web` network, when `docker compose up -d --build` runs, then the archer container starts, joins the network, and is discoverable by the external Traefik via its labels.
- Given a request to generate content with a valid provider key configured, when the user submits the form, then `/api/generate` responds successfully from inside the container.
- Given the built image, when its contents are inspected, then no `.env` file or API key value is present in any layer.
- Given the external `web` network does not exist, when `docker compose up` runs, then compose fails fast with a network-not-found error (documented remedy in DEPLOYMENT.md).

## Implementation Notes

- Added recursive `**/*.test.ts` and `**/*.test.tsx` exclusions. Before this, Docker excluded root test files but included nested tests such as `components/review/ReviewShell.test.tsx`, while also excluding `vitest.setup.ts`; `next build` therefore typechecked nested matcher assertions without jest-dom type augmentation.
- Verified with a no-cache Docker build through the TypeScript check and runner image export.
- Updated the deploy script's Coolify preflight to use the unauthenticated `/api/v1/health` endpoint. `/api/v1/teams/current` returned 403 for the configured deploy-scoped token; Coolify documents deploy tokens as lacking general read permissions while remaining valid for deploy webhooks.

## Spec Change Log

- **Human scope renegotiation (2026-08-31):** User will run Traefik themselves locally. Removed the `traefik` service definition, its ports/volumes, and Let's Encrypt/ACME management from the compose scope. The compose file now runs only the `archer` app service and joins an `external: true` Traefik network (`web`) via routing labels. Updated Intent, Boundaries (Never: no Traefik service / TLS management here), I/O matrix (dropped "Production TLS" and the our-Traefik "Local HTTP" rows; added "app run behind external Traefik" and "missing external network"), tasks, ACs, design notes, and verification (dropped the curl-through-Traefik check since the proxy is external). KEEP: standalone Dockerfile, non-root user, runtime secret injection, `.dockerignore` secret exclusion.

## Design Notes

Standalone runner stage copies exactly three artifacts from the build stage: `.next/standalone` (includes a pruned `node_modules` and `server.js`), `.next/static`, and `public`. `next build` does not copy `static`/`public` into `standalone`, so both must be copied explicitly or assets 404.

Traefik is user-managed externally, so this compose file only emits routing labels on the `archer` service and joins the external network. The labels assume the user's Traefik has a `websecure` entrypoint and a cert resolver named `le`; these are documented as adjustable:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=web"
  - "traefik.http.routers.archer.rule=Host(`${DOMAIN}`)"
  - "traefik.http.routers.archer.entrypoints=websecure"
  - "traefik.http.routers.archer.tls=true"
  - "traefik.http.routers.archer.tls.certresolver=le"
  - "traefik.http.services.archer.loadbalancer.server.port=3000"
```

The network is declared `external: true` so compose joins the user's existing Traefik network rather than creating/owning one.

## Verification

**Commands:**

- `cd archer && npm run build` -- expected: build succeeds and emits `.next/standalone/server.js`.
- `docker compose config` -- expected: compose file parses with no errors and variables resolve.
- `docker compose build` -- expected: image builds successfully through all stages.
- `docker build --no-cache --progress=plain -t archer-ignore-check .` -- verified: image builds through TypeScript and runner export.

**Manual checks (if no CLI):**

- Inspect built image layers (`docker history` / `docker run --rm <img> ls -a`) confirm no `.env` and no key values present.
