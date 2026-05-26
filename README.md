# link-steward

Link Steward is a self-hosted bookmark steward for Unraid, browser extensions, shared collections, and local browser bookmark double-write.

## Docker Image

```text
ghcr.io/robs87/link-steward:latest
```

The container serves both:

- Web UI: `http://SERVER_IP:3088/`
- Health check: `http://SERVER_IP:3088/api/health`

## Docker Compose

```bash
LINK_STEWARD_HOST_DATA_DIR=/mnt/user/appdata/link-steward \
docker compose -f docker/docker-compose.yml up -d
```

## Unraid

Use the template at:

```text
https://raw.githubusercontent.com/Robs87/link-steward/main/unraid/link-steward.xml
```

The Unraid template maps:

- container port `3088` to host port `3088`
- `/data` to `/mnt/user/appdata/link-steward`
- `LINK_STEWARD_COOKIE_SECRET` for signed login cookies

## Docs

- [产品定义文档](./产品定义文档.md)
- [开发计划](./开发计划.md)
- [Development](./docs/development.md)
- [Manual QA](./docs/manual-qa.md)
