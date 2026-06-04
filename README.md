# Link Steward OneNav Fork

Link Steward is now a fork of [OneNav](https://github.com/helloxz/onenav), packaged for this repository's GHCR and Unraid workflow.

OneNav is a PHP + SQLite bookmark/navigation manager with a dense admin UI, category management, link management, bookmark import, themes, and API support.

## License And Attribution

This fork is based on OneNav `v1.2.4-20260507`, licensed under Apache License 2.0.

- Upstream: <https://github.com/helloxz/onenav>
- License: [Apache License 2.0](./LICENSE)
- Fork notice: [FORK_NOTICE.md](./FORK_NOTICE.md)

Keep upstream license and copyright notices when redistributing modified builds.

## Docker Image

```text
ghcr.io/robs87/link-steward:latest
```

The container serves OneNav on container port `80`.

## Docker Compose

```bash
LINK_STEWARD_HOST_DATA_DIR=/mnt/user/appdata/link-steward \
docker compose -f docker/docker-compose.yml up -d
```

Then open:

```text
http://SERVER_IP:3088/
```

On first launch, OneNav will initialize `data/config.php` and `data/onenav.db3` inside the mounted appdata directory.

## Unraid

Use the template at:

```text
https://raw.githubusercontent.com/Robs87/link-steward/main/unraid/link-steward.xml
```

Template mapping:

- Host port `3088` -> container port `80`
- `/mnt/user/appdata/link-steward` -> `/var/www/html/data`

## Runtime Data

These paths are runtime state and are ignored by git:

- `data/config.php`
- `data/onenav.db3`
- `data/backup/`
- `data/upload/`
- `data/templates/`

Back up the Unraid appdata directory to preserve your bookmarks and settings.

## Upstream OneNav Features

- Category management
- Link management
- Public/private links
- Chrome / Firefox / Edge bookmark import
- Multiple themes
- API support
- Link drag sorting
- Frontend edit support in supported themes
- SQLite backup and restore
