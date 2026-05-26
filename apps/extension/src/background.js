import { saveServerThenLocal } from "./common.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-page",
    title: "保存当前页面到 Link Steward",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "save-link",
    title: "保存链接到 Link Steward",
    contexts: ["link"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.menuItemId === "save-link" ? info.linkUrl : tab?.url;
  const title = info.menuItemId === "save-link" ? info.linkUrl : tab?.title;

  if (!url) {
    return;
  }

  try {
    const result = await saveServerThenLocal({
      title: title || url,
      url
    });
    await chrome.storage.session.set({ lastSaveStatus: result });
    await setBadge(result.status);
  } catch (error) {
    const failure = { status: "failed", message: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
    await chrome.storage.session.set({ lastSaveStatus: failure });
    await setBadge("failed");
  }
});

async function setBadge(status) {
  const text = status === "saved" ? "OK" : status === "duplicate" ? "DUP" : "!";
  const color = status === "saved" ? "#0f766e" : status === "duplicate" ? "#64748b" : "#b42318";
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}
