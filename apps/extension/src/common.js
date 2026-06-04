const rootFolderName = "Link Steward";

export async function getSettings() {
  return chrome.storage.sync.get({
    serverUrl: "http://localhost:3088",
    apiToken: "",
    deviceName: "Browser Extension",
    targetCollectionId: "",
    targetCollectionName: "Inbox"
  });
}

export async function listCollections() {
  const settings = await getSettings();
  const response = await authedFetch(settings, "/api/collections");
  const body = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error("INVALID_TOKEN");
  }

  if (!response.ok) {
    throw new Error(body.error ?? "COLLECTIONS_LOAD_FAILED");
  }

  return (body.collections ?? []).filter((collection) => !collection.archivedAt);
}

export async function searchBookmarks(query) {
  const settings = await getSettings();
  const params = new URLSearchParams({ status: "active" });
  if (query.trim()) {
    params.set("q", query.trim());
  }

  const response = await authedFetch(settings, `/api/bookmarks?${params.toString()}`);
  const body = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error("INVALID_TOKEN");
  }

  if (!response.ok) {
    throw new Error(body.error ?? "BOOKMARK_SEARCH_FAILED");
  }

  return body.bookmarks ?? [];
}

export async function setTargetCollection(collection) {
  await chrome.storage.sync.set({
    targetCollectionId: collection?.id ?? "",
    targetCollectionName: collection?.name ?? "Inbox"
  });
}

export async function saveToServer(bookmark) {
  const settings = await getSettings();
  const target = getTargetFromBookmark(bookmark, settings);

  const response = await authedFetch(settings, "/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      title: bookmark.title,
      url: bookmark.url,
      collectionId: target.collectionId || undefined,
      source: {
        type: "extension",
        browser: navigator.userAgent,
        device: settings.deviceName,
        localBookmarkFolder: localFolderPath(target.collectionName).join("/")
      }
    })
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error("INVALID_TOKEN");
  }

  if (response.status === 409) {
    return { status: "duplicate", body };
  }

  if (!response.ok) {
    throw new Error(body.error ?? "SERVER_SAVE_FAILED");
  }

  return { status: "created", body };
}

export async function saveLocalBookmark(bookmark) {
  const settings = await getSettings();
  const target = getTargetFromBookmark(bookmark, settings);
  const parentId = await ensureFolderPath(localFolderPath(target.collectionName));
  await chrome.bookmarks.create({
    parentId,
    title: bookmark.title,
    url: bookmark.url
  });
}

export async function saveServerThenLocal(bookmark) {
  const result = await saveToServer(bookmark);

  if (result.status === "duplicate") {
    return { status: "duplicate" };
  }

  try {
    await saveLocalBookmark(bookmark);
    return { status: "saved", collectionName: getTargetFromBookmark(bookmark, await getSettings()).collectionName };
  } catch (error) {
    return {
      status: "server-only",
      error: error instanceof Error ? error.message : "本地书签写入失败"
    };
  }
}

export function statusText(resultOrError) {
  const status = resultOrError?.status;
  const message = resultOrError?.message;

  if (status === "saved") {
    return resultOrError.collectionName
      ? `已保存到 ${rootFolderName}/${resultOrError.collectionName}`
      : "已保存到服务端和本地书签";
  }
  if (status === "duplicate") return "服务端已有该书签";
  if (status === "server-only") return "服务端已保存，本地书签写入失败";
  if (message === "MISSING_TOKEN") return "请先在扩展设置中填写 API token";
  if (message === "INVALID_TOKEN") return "API token 无效或已失效";
  if (message === "SERVER_UNREACHABLE") return "无法连接 Link Steward 服务端";
  if (message === "SERVER_SAVE_FAILED") return "服务端保存失败";
  if (message === "COLLECTIONS_LOAD_FAILED") return "无法加载文件夹";
  if (message === "BOOKMARK_SEARCH_FAILED") return "搜索失败";
  return "保存失败";
}

async function authedFetch(settings, path, init = {}) {
  if (!settings.apiToken) {
    throw new Error("MISSING_TOKEN");
  }

  try {
    return await fetch(`${settings.serverUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${settings.apiToken}`,
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new Error("SERVER_UNREACHABLE");
  }
}

function getTargetFromBookmark(bookmark, settings) {
  return {
    collectionId: bookmark.collectionId ?? settings.targetCollectionId,
    collectionName: bookmark.collectionName ?? settings.targetCollectionName ?? "Inbox"
  };
}

function localFolderPath(collectionName) {
  return [rootFolderName, sanitizeFolderName(collectionName || "Inbox")];
}

function sanitizeFolderName(value) {
  return value.replace(/[/:\\]/g, "-").trim() || "Inbox";
}

async function ensureFolderPath(parts) {
  let parentId;

  for (const title of parts) {
    const children = parentId
      ? await chrome.bookmarks.getChildren(parentId)
      : await chrome.bookmarks.getTree().then((tree) => tree[0]?.children || []);
    const existing = children.find((node) => node.title === title && !node.url);

    if (existing?.id) {
      parentId = existing.id;
      continue;
    }

    const created = await chrome.bookmarks.create({
      parentId,
      title
    });
    parentId = created.id;
  }

  return parentId;
}
