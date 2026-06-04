import { addLink } from "./onenav-api.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-page-private",
    title: "添加为私有书签",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "save-page-public",
    title: "添加为公有书签",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "save-link-private",
    title: "添加链接到 OneNav",
    contexts: ["link"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const isLink = info.menuItemId === "save-link-private";
  const url = isLink ? info.linkUrl : tab?.url;
  const title = isLink ? info.linkUrl : tab?.title;
  if (!url) return;

  try {
    await addLink({
      title: title || url,
      url,
      isPrivate: info.menuItemId !== "save-page-public"
    });
    await setBadge("OK", "#2f95f6");
    await chrome.storage.session.set({ lastMessage: "已添加到 OneNav" });
  } catch (error) {
    await setBadge("!", "#ff5b45");
    await chrome.storage.session.set({
      lastMessage: error instanceof Error ? error.message : "添加失败"
    });
  }
});

async function setBadge(text, color) {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}
