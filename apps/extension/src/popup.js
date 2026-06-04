import { getSettings, listCollections, saveServerThenLocal, searchBookmarks, setTargetCollection, statusText } from "./common.js";

const folderSelect = document.querySelector("#folderSelect");
const refreshFolders = document.querySelector("#refreshFolders");
const saveCurrent = document.querySelector("#saveCurrent");
const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const results = document.querySelector("#results");
const status = document.querySelector("#status");

let collections = [];

init();

async function init() {
  chrome.storage.session.get({ lastSaveStatus: null }, (items) => {
    if (items.lastSaveStatus) {
      setStatus(statusText(items.lastSaveStatus), "info");
    }
  });

  await loadFolders();
}

refreshFolders.addEventListener("click", loadFolders);

folderSelect.addEventListener("change", async () => {
  const collection = collections.find((item) => item.id === folderSelect.value);
  await setTargetCollection(collection);
  setStatus(collection ? `默认保存到 ${collection.name}` : "默认保存到 Inbox", "ok");
});

saveCurrent.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url) {
    setStatus("没有可保存的标签页", "warn");
    return;
  }

  const collection = collections.find((item) => item.id === folderSelect.value);

  try {
    const result = await saveServerThenLocal({
      title: tab.title || tab.url,
      url: tab.url,
      collectionId: collection?.id ?? "",
      collectionName: collection?.name ?? "Inbox"
    });

    setStatus(statusText(result), "ok");
    await chrome.storage.session.set({ lastSaveStatus: result });
  } catch (error) {
    const failure = { status: "failed", message: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
    setStatus(statusText(failure), "error");
    await chrome.storage.session.set({ lastSaveStatus: failure });
  }
});

searchButton.addEventListener("click", runSearch);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runSearch();
  }
});

async function loadFolders() {
  try {
    const settings = await getSettings();
    collections = await listCollections();
    renderFolders(settings.targetCollectionId);
    setStatus(collections.length > 0 ? "文件夹已同步" : "已连接，暂无自定义文件夹", "ok");
  } catch (error) {
    const failure = { status: "failed", message: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
    setStatus(statusText(failure), "error");
  }
}

function renderFolders(selectedId) {
  folderSelect.innerHTML = '<option value="">Link Steward/Inbox</option>';

  for (const collection of collections) {
    const option = document.createElement("option");
    option.value = collection.id;
    option.textContent = collection.name;
    folderSelect.append(option);
  }

  folderSelect.value = collections.some((collection) => collection.id === selectedId) ? selectedId : "";
}

async function runSearch() {
  setStatus("搜索中...", "info");
  results.innerHTML = "";

  try {
    const bookmarks = await searchBookmarks(searchInput.value);
    renderResults(bookmarks.slice(0, 20));
    setStatus(bookmarks.length === 0 ? "没有匹配书签" : `找到 ${bookmarks.length} 条`, bookmarks.length === 0 ? "warn" : "ok");
  } catch (error) {
    const failure = { status: "failed", message: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
    setStatus(statusText(failure), "error");
  }
}

function renderResults(bookmarks) {
  results.innerHTML = "";

  for (const bookmark of bookmarks) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const meta = document.createElement("span");

    link.href = bookmark.url;
    link.target = "_blank";
    link.textContent = bookmark.title;
    meta.textContent = `${bookmark.domain} · ${bookmark.collectionName}${bookmark.tags?.length ? ` · ${bookmark.tags.join(", ")}` : ""}`;

    item.append(link, meta);
    results.append(item);
  }
}

function setStatus(message, tone) {
  status.textContent = message;
  status.dataset.tone = tone;
}
