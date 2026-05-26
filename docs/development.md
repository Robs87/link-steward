# Link Steward Development

## Local Server

```bash
npm install
npm run dev:server
```

The server listens on `http://localhost:3088` and writes SQLite data to `./data/link-steward.sqlite` by default.

## Local Web UI

```bash
npm run dev:web
```

The Vite dev server proxies `/api` to `http://localhost:3088`.

## Browser Extension

Load `apps/extension` as an unpacked extension in Chrome or Edge developer mode.

Current extension scope:

- creates the `Link Steward/Inbox` bookmark folder;
- saves the current page, selected link, or popup action to the server first;
- writes to local browser bookmarks only after the server save succeeds.

See [manual QA](./manual-qa.md) for the full Docker and extension verification flow.

## Docker

```bash
cd docker
docker compose up --build
```

For Unraid, mount the container `/data` directory to an appdata path such as `/mnt/user/appdata/link-steward`.

Example:

```bash
LINK_STEWARD_HOST_DATA_DIR=/mnt/user/appdata/link-steward docker compose up --build -d
```

The production container serves both:

- Web UI at `http://SERVER_IP:3088/`
- API at `http://SERVER_IP:3088/api/health`
