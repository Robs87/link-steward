import { saveServerThenLocal, statusText } from "./common.js";

const status = document.querySelector("#status");

chrome.storage.session.get({ lastSaveStatus: null }, (items) => {
  if (items.lastSaveStatus) {
    status.textContent = statusText(items.lastSaveStatus);
  }
});

document.querySelector("#saveCurrent").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url) {
    status.textContent = "没有可保存的标签页";
    return;
  }

  try {
    const result = await saveServerThenLocal({
      title: tab.title || tab.url,
      url: tab.url
    });

    status.textContent = statusText(result);
    await chrome.storage.session.set({ lastSaveStatus: result });
  } catch (error) {
    const failure = { status: "failed", message: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
    status.textContent = statusText(failure);
    await chrome.storage.session.set({ lastSaveStatus: failure });
  }
});
