# Deployment (Docker + Docker Compose + Traefik)

Archer ships as a containerized Next.js server. It is designed to run behind a [Traefik](https://traefik.io/) reverse proxy that **you manage separately** (locally). This compose file runs only the app container and attaches it to your existing Traefik network via labels.

## Architecture

```
Internet ──> your Traefik (:80, :443) ──> archer container (:3000)
                  (managed by you)          (this compose file)
```

- **archer** — the Next.js app, built from `./archer/Dockerfile` using Next.js standalone output. Runs `node server.js` on port 3000 as a non-root user.
- **Traefik** — not defined here. You run it yourself and it discovers the archer container through the Docker provider labels.

## Prerequisites

- Docker Engine and the Docker Compose plugin (`docker compose version`).
- A running Traefik instance with:
  - a `websecure` entrypoint (or adjust the labels in `docker-compose.yml`),
  - a certificate resolver named `le` (or adjust `traefik.http.routers.archer.tls.certresolver`),
  - an attached Docker network (default assumed name: `web`).
- The external network must already exist. If yours is named differently, change the `networks.web` name in `docker-compose.yml` and the `traefik.docker.network` label to match. To create one named `web`:

  ```bash
  docker network create web
  ```

## Configuration

Two env files are used. Neither is committed (both are gitignored).

1. **Compose config** — copy the root template:

   ```bash
   cp .env.example .env
   ```

   | Variable | Purpose                        | Local       | Production           |
   | -------- | ------------------------------ | ----------- | -------------------- |
   | `DOMAIN` | Host Traefik routes to the app | `localhost` | `archer.example.com` |

   TLS/ACME (email, resolver, entrypoints) is configured in **your** Traefik, not here.

2. **App secrets** — copy the app template and add your AI provider key:

   ```bash
   cp archer/.env.example archer/.env
   ```

   Set `AI_PROVIDER` and the matching key (e.g. `GEMINI_API_KEY`). These are injected into the container at runtime and are never baked into the image.

## Run

```bash
docker compose up -d --build
```

Traefik discovers the container and routes `Host(DOMAIN)` to it on port 3000. Check reachability at your configured domain (or http://localhost when `DOMAIN=localhost`).

## Common commands

```bash
docker compose config          # validate compose + env resolution
docker compose build           # build the archer image
docker compose up -d            # start in background
docker compose logs -f archer   # tail app logs
docker compose down             # stop and remove the archer container
```

## Notes

- The app requires a Node server (the `/api/generate` route runs server-side), so static export is not used.
- If no provider key is configured, the UI still loads but `/api/generate` returns an error response.
- To change the AI provider, edit `archer/.env` and restart: `docker compose up -d archer`.
- The Traefik router labels assume entrypoint `websecure` and cert resolver `le`. Edit them in `docker-compose.yml` to match your Traefik configuration.
