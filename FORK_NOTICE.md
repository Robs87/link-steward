# Link Steward OneNav Fork Notice

This repository is now an Apache-2.0 compliant fork of OneNav.

Upstream project:

- Name: OneNav
- Repository: https://github.com/helloxz/onenav
- License: Apache License 2.0
- Imported upstream version: `v1.2.4-20260507`

The upstream `LICENSE` file is retained at the repository root. This fork keeps
the OneNav source structure and adds Link Steward-specific Docker, GitHub
Actions, and Unraid packaging.

Local runtime state is stored under `data/` and is intentionally ignored:

- `data/config.php`
- `data/onenav.db3`
- `data/backup/`
- `data/upload/`
- `data/templates/`

Do not remove upstream copyright or license notices when modifying this fork.
