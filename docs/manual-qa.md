# Link Steward Manual QA

## Docker Smoke

```bash
colima start
LINK_STEWARD_HOST_DATA_DIR=/tmp/link-steward-docker-data docker compose -f docker/docker-compose.yml up --build -d
```

Expected:

- `docker ps --filter name=link-steward` shows the container as `Up`.
- `curl http://127.0.0.1:3088/api/health` returns `{"ok":true,...}`.
- `http://localhost:3088/` opens the Web UI.

## Owner Setup

1. Open `http://localhost:3088/`.
2. Create the Owner account.
3. Confirm the dashboard appears.
4. Confirm the recent bookmarks section shows `暂无书签`.

## Extension Token

1. Click `生成扩展 token`.
2. Copy the `lst_...` token.
3. Open Chrome or Edge extension management.
4. Enable developer mode.
5. Load unpacked extension from `apps/extension`.
6. Open extension options.
7. Set:
   - server URL: `http://localhost:3088`
   - API token: copied `lst_...` token
   - device name: local browser name
8. Click `测试连接`.

Expected: `连接成功`.

## Save Current Tab

1. Open any normal web page.
2. Open the Link Steward extension popup.
3. Click `保存当前标签页`.

Expected:

- Popup says `已保存到服务端和本地书签`.
- Browser bookmarks contain `Link Steward/Inbox`.
- Web dashboard recent bookmarks shows the saved page after refresh.

## Duplicate Save

1. Save the same page again.

Expected:

- Popup says `服务端已有该书签`.
- No duplicate local bookmark is created by Link Steward.

## Context Menu Save

1. Right-click a page and choose `保存当前页面到 Link Steward`, or right-click a link and choose `保存链接到 Link Steward`.
2. Open the extension popup.

Expected:

- Popup shows the latest save status.
- Extension badge shows:
  - `OK` for successful save
  - `DUP` for duplicate
  - `!` for failure

## Failure Cases

Token missing:

- Clear API token in extension options.
- Save a page.
- Expected: `请先在扩展设置中填写 API token`.

Invalid token:

- Enter a fake token.
- Click `测试连接`.
- Expected: `API token 无效`.

Server unreachable:

- Stop the container.
- Save a page.
- Expected: `无法连接 Link Steward 服务端`.

## Cleanup

```bash
docker compose -f docker/docker-compose.yml down
colima stop
```
