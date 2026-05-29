# Link Steward Agent Memory

## Project Identity

Link Steward is a self-hosted bookmark steward for Unraid, browser extensions, shared collections, and local browser bookmark double-write.

The product direction is server-first:

- Docker/Unraid service is the long-term source of truth.
- Chrome/Edge extension is the primary capture surface.
- Extension saves to the server first, then writes to browser local bookmarks under `Link Steward/Inbox`.
- Browser local bookmarks are a convenience copy, not the canonical database.

## Current Repository

- GitHub repo: `https://github.com/Robs87/link-steward`
- Visibility: public
- Default branch: `main`
- Docker image target: `ghcr.io/robs87/link-steward:latest`
- Unraid template path: `unraid/link-steward.xml`

## Current Implementation State

Implemented:

- npm monorepo
- `apps/server`: Fastify + TypeScript + SQLite via Node built-in `node:sqlite`
- `apps/web`: React + Vite dashboard
- `apps/extension`: Chrome/Edge Manifest V3 extension
- Dockerfile and docker-compose
- GitHub Actions workflow to publish GHCR Docker image
- Unraid XML template
- Owner setup and cookie login
- Extension token generation
- Bearer-token extension API auth
- Bookmark create/list/duplicate-check APIs
- URL normalization for common tracking parameters
- Web dashboard recent-bookmark list
- Extension server-first save flow
- Manual QA checklist in `docs/manual-qa.md`

Not implemented yet:

- Real collection management UI
- Shared collection permissions beyond schema direction
- HTML bookmarks import/export
- OneNav SQLite importer
- Search/FTS UI
- Extension pairing UX beyond manual token copy
- Chrome Web Store / Edge Add-ons packaging
- Production-grade HTTPS/reverse-proxy guidance

## Local Development Commands

```bash
npm install
npm run typecheck
npm run build
npm run dev:server
npm run dev:web
```

Server default:

```text
http://localhost:3088
```

Web dev default:

```text
http://localhost:5173
```

## Docker / Unraid

Build locally only when Docker is intentionally installed:

```bash
LINK_STEWARD_HOST_DATA_DIR=/tmp/link-steward-docker-data docker compose -f docker/docker-compose.yml up --build -d
```

Unraid target mapping:

- Port: `3088`
- Data: `/mnt/user/appdata/link-steward` -> `/data`
- Cookie secret env: `LINK_STEWARD_COOKIE_SECRET`
- Web UI: `http://UNRAID_IP:3088/`
- Health: `http://UNRAID_IP:3088/api/health`

## User Environment Preference

The user wants the Mac environment kept clean. Do not install or keep Docker CLI, Colima, Lima, or similar local services unless explicitly requested.

If local Docker validation is needed:

1. Ask or confirm first.
2. Prefer temporary setup.
3. Clean up after validation if requested:
   - stop/remove containers
   - stop/delete Colima VM
   - uninstall Homebrew packages
   - remove temporary Docker data

## Product Constraints

Do not directly fork or re-skin OneNav.

OneNav is only a reference and migration source:

- useful references: simple deployment, category/link model, search, import/export, link checks
- avoid inheriting: PHP monolith, single-admin navigation-site assumptions, remote subscription/update logic, theme marketplace, branding/assets

Link Steward should support OneNav migration through an importer, not runtime compatibility.

## Development Priorities

Next useful sequence:

1. Finish M1 extension QA polish:
   - token lifecycle UI
   - clearer extension onboarding
   - extension manual test coverage
2. Start M2 Web management:
   - bookmark list filters
   - edit title/description/tags
   - delete/archive
   - collection selector
3. Add import/export:
   - browser HTML import
   - JSON export
   - Markdown/Obsidian export
4. Add OneNav importer:
   - read `on_categorys`
   - read `on_links`
   - preview field mapping
   - duplicate report

## Verification Expectations

Before claiming a development step is complete:

- run `npm run typecheck`
- run `npm run build`
- run `git diff --check`
- if Docker was touched and Docker is available, run compose smoke:
  - container starts
  - `/api/health` returns ok
  - `/` returns Web UI

## Git Workflow

The current repo is connected to `origin` at `Robs87/link-steward`.

For normal project work:

- keep changes scoped
- commit with a short imperative message
- push to `main` when the user explicitly asks to publish
- use branches/PRs only when the user asks for review flow or when risk justifies it
