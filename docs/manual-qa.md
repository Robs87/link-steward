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

1. Open Web UI `设置`.
2. Enter a device name and browser label.
3. Click `生成 token`.
4. Confirm the device appears in `已连接扩展设备`.
5. Copy the one-time `lst_...` token.
6. Hide the token.
7. Open Chrome or Edge extension management.
8. Enable developer mode.
9. Load unpacked extension from `apps/extension`.
10. Open extension options.
11. Set:
    - server URL: `http://localhost:3088`
    - API token: copied `lst_...` token
    - device name: local browser name
12. Click `测试连接`.

Expected:

- Web UI lists the extension device.
- Extension options shows `连接成功`.

## Extension Token Revocation

1. In Web UI `设置`, revoke an active extension device.
2. Click `测试连接` in extension options.

Expected: extension options shows `API token 无效或已被撤销`.

Recovery:

1. Generate a new token in Web UI `设置`.
2. Copy the `lst_...` token.
3. Paste it into extension options.
4. Save and test again.

Expected: extension options shows `连接成功`.

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

## Web Bookmark Management

1. Open Web UI `个人库`.
2. Search by a saved page title, domain, or tag.
3. Edit the bookmark title and description.
4. Add comma-separated tags.
5. Move the bookmark to another collection.
6. Save the row.

Expected:

- Search returns the expected bookmark.
- The edited title, description, tags, and collection persist after refresh.

Archive:

1. Click `归档` on a bookmark.
2. Change status filter to `已归档`.
3. Search again.

Expected: the archived bookmark appears only under the archived/all status filters.

## Collection Management

1. Open Web UI `Collection`.
2. Create a workspace collection.
3. Rename it and save.
4. Archive it.

Expected:

- The collection appears in the list with bookmark count.
- Archived collections disappear from active bookmark move/import selectors.

## Import / Export

HTML import:

1. Open Web UI `导入 / 导出`.
2. Select a target collection.
3. Upload or paste a Chrome / Edge bookmarks HTML export.
4. Click `导入 HTML`.

Expected:

- New bookmarks appear in `个人库`.
- Duplicate normalized URLs are skipped and counted in the import result.

Export:

1. Open Web UI `导入 / 导出`.
2. Optionally select a collection.
3. Click `HTML`, `JSON`, and `Markdown`.

Expected:

- HTML export contains a Netscape bookmark file structure and can be imported by browsers.
- JSON export includes bookmark metadata, tags, and collection names.
- Markdown export groups links by collection.

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
