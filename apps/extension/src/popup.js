import {
  addLink,
  getSettings,
  listCategories,
  listLinks,
  saveSettings,
  statusText,
  testConnection
} from "./onenav-api.js";

const state = {
  categories: [],
  currentCategory: null,
  pendingPrivate: true
};

const els = {
  app: document.querySelector(".app"),
  tabs: [...document.querySelectorAll("[data-tab]")],
  views: [...document.querySelectorAll("[data-view]")],
  searchInput: document.querySelector("#searchInput"),
  categoryList: document.querySelector("#categoryList"),
  linkList: document.querySelector("#linkList"),
  refreshHome: document.querySelector("#refreshHome"),
  scrollTop: document.querySelector("#scrollTop"),
  addForm: document.querySelector("#addForm"),
  urlInput: document.querySelector("#urlInput"),
  titleInput: document.querySelector("#titleInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  categorySelect: document.querySelector("#categorySelect"),
  recentLinks: document.querySelector("#recentLinks"),
  settingsForm: document.querySelector("#settingsForm"),
  apiBaseInput: document.querySelector("#apiBaseInput"),
  apiTokenInput: document.querySelector("#apiTokenInput"),
  toggleToken: document.querySelector("#toggleToken"),
  pasteSettings: document.querySelector("#pasteSettings"),
  manualPasteWrap: document.querySelector("#manualPasteWrap"),
  manualPasteInput: document.querySelector("#manualPasteInput"),
  testSettings: document.querySelector("#testSettings"),
  resetSettings: document.querySelector("#resetSettings"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  bindEvents();
  await hydrateCurrentTab();
  await hydrateSettings();
  await loadHome();
  await loadRecent();

  chrome.storage.session.get({ lastMessage: "" }, (items) => {
    if (items.lastMessage) showToast(items.lastMessage);
  });
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.tab));
  });

  els.refreshHome.addEventListener("click", loadHome);
  els.scrollTop.addEventListener("click", () => els.app.scrollTo({ top: 0, behavior: "smooth" }));

  els.searchInput.addEventListener("input", debounce(async () => {
    const query = els.searchInput.value.trim();
    if (!query) {
      renderCategories();
      return;
    }
    await renderSearch(query);
  }, 220));

  els.addForm.querySelectorAll("button[type='submit']").forEach((button) => {
    button.addEventListener("click", () => {
      state.pendingPrivate = button.dataset.private === "true";
    });
  });
  els.addForm.addEventListener("submit", handleAdd);

  els.settingsForm.addEventListener("submit", handleSaveSettings);
  els.testSettings.addEventListener("click", handleTestSettings);
  els.resetSettings.addEventListener("click", handleResetSettings);
  els.pasteSettings.addEventListener("click", handlePasteSettings);
  els.manualPasteInput.addEventListener("input", () => applyPastedSettings(els.manualPasteInput.value));
  els.toggleToken.addEventListener("click", () => {
    els.apiTokenInput.type = els.apiTokenInput.type === "password" ? "text" : "password";
  });
}

async function hydrateCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  els.urlInput.value = tab.url || "";
  els.titleInput.value = tab.title || tab.url || "";
}

async function hydrateSettings() {
  const settings = await getSettings();
  els.apiBaseInput.value = settings.apiBase || "";
  els.apiTokenInput.value = settings.apiToken || "";
}

async function loadHome() {
  try {
    const { categories } = await listCategories();
    state.categories = categories;
    renderCategories();
    renderCategoryOptions();
  } catch (error) {
    renderEmpty(els.categoryList, statusText(error));
  }
}

async function loadRecent() {
  try {
    const { links } = await listLinks({ limit: 20 });
    renderLinks(els.recentLinks, links);
  } catch (error) {
    renderEmpty(els.recentLinks, statusText(error));
  }
}

function renderCategories() {
  els.linkList.classList.add("is-hidden");
  els.categoryList.classList.remove("is-hidden");
  els.categoryList.innerHTML = "";

  if (state.categories.length === 0) {
    renderEmpty(els.categoryList, "暂无分类");
    return;
  }

  state.categories.forEach((category) => {
    const item = document.createElement("button");
    item.className = "category-item";
    item.type = "button";
    item.innerHTML = `
      <span class="category-name">${category.parentId !== "0" ? "　" : ""}▤ ${escapeHtml(category.name)}</span>
      <span class="category-count">${category.linkCount}</span>
      <span class="chevron">›</span>
    `;
    item.addEventListener("click", () => openCategory(category));
    els.categoryList.append(item);
  });
}

async function openCategory(category) {
  state.currentCategory = category;
  els.categoryList.classList.add("is-hidden");
  els.linkList.classList.remove("is-hidden");
  renderEmpty(els.linkList, "加载中...");

  try {
    const { links } = await listLinks({ categoryId: category.id, limit: 200 });
    els.linkList.innerHTML = "";
    const back = document.createElement("button");
    back.className = "back-row";
    back.type = "button";
    back.textContent = `‹ ${category.name}`;
    back.addEventListener("click", renderCategories);
    els.linkList.append(back);
    renderLinks(els.linkList, links, true);
  } catch (error) {
    renderEmpty(els.linkList, statusText(error));
  }
}

async function renderSearch(query) {
  els.categoryList.classList.add("is-hidden");
  els.linkList.classList.remove("is-hidden");
  renderEmpty(els.linkList, "搜索中...");

  try {
    const { links } = await listLinks({ limit: 500, query });
    els.linkList.innerHTML = "";
    renderLinks(els.linkList, links);
  } catch (error) {
    renderEmpty(els.linkList, statusText(error));
  }
}

function renderLinks(target, links, append = false) {
  if (!append) target.innerHTML = "";
  if (!links.length) {
    renderEmpty(target, "暂无书签");
    return;
  }

  links.forEach((link) => {
    const item = document.createElement("a");
    item.className = "link-item";
    item.href = link.url;
    item.target = "_blank";
    item.innerHTML = `
      <strong>${escapeHtml(link.title || link.url)}</strong>
      <span>${escapeHtml(link.categoryName || "")} ${link.isPrivate ? "私有" : "公有"}</span>
    `;
    target.append(item);
  });
}

function renderCategoryOptions() {
  els.categorySelect.innerHTML = "";
  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.parentId !== "0" ? "　" : ""}${category.name}`;
    els.categorySelect.append(option);
  });
}

async function handleAdd(event) {
  event.preventDefault();
  const category = state.categories.find((item) => item.id === els.categorySelect.value);
  try {
    await addLink({
      title: els.titleInput.value.trim(),
      url: els.urlInput.value.trim(),
      description: els.descriptionInput.value.trim(),
      categoryId: els.categorySelect.value,
      isPrivate: state.pendingPrivate
    });
    await saveSettings({
      apiBase: els.apiBaseInput.value,
      apiToken: els.apiTokenInput.value,
      defaultCategoryId: els.categorySelect.value,
      defaultCategoryName: category?.name || "默认分类"
    });
    showToast(state.pendingPrivate ? "已添加为私有" : "已添加为公有");
    await loadHome();
    await loadRecent();
  } catch (error) {
    showToast(statusText(error), "error");
  }
}

async function handleSaveSettings(event) {
  event.preventDefault();
  await saveSettings({
    apiBase: els.apiBaseInput.value,
    apiToken: els.apiTokenInput.value,
    defaultCategoryId: els.categorySelect.value,
    defaultCategoryName: state.categories.find((item) => item.id === els.categorySelect.value)?.name
  });
  showToast("已保存");
  await loadHome();
}

async function handleTestSettings() {
  try {
    await testConnection({
      apiBase: els.apiBaseInput.value,
      apiToken: els.apiTokenInput.value
    });
    showToast("连接成功");
  } catch (error) {
    showToast(statusText(error), "error");
  }
}

async function handleResetSettings() {
  await chrome.storage.sync.clear();
  await hydrateSettings();
  showToast("已重置");
}

async function handlePasteSettings() {
  try {
    const text = await navigator.clipboard.readText();
    if (applyPastedSettings(text)) {
      els.manualPasteWrap.classList.add("is-hidden");
      showToast("已粘贴");
      return;
    }
    showManualPaste("剪贴板内容不是 Web 端 API 信息", "error");
  } catch {
    showManualPaste("无法读取剪贴板，请手动粘贴", "error");
  }
}

function applyPastedSettings(text) {
  const parsed = parseSettingsText(text);
  if (!parsed) return false;
  els.apiBaseInput.value = parsed.base;
  els.apiTokenInput.value = parsed.token;
  return true;
}

function parseSettingsText(text) {
  const value = String(text || "").trim();
  if (!value) return null;

  const parts = value.split("|").map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { base: normalizePastedBase(parts[0]), token: parts[1] };
  }

  const base = value.match(/https?:\/\/[^\s|，,]+/i)?.[0];
  const token = value.match(/(?:token|api\s*token)\s*[:：]\s*([a-f0-9]{32})/i)?.[1]
    || value.match(/\b[a-f0-9]{32}\b/i)?.[0];
  if (!base || !token) return null;
  return { base: normalizePastedBase(base), token };
}

function normalizePastedBase(value) {
  return value.trim().replace(/\/+(?:index\.php.*)?$/, "");
}

function showManualPaste(message, tone) {
  els.manualPasteWrap.classList.remove("is-hidden");
  els.manualPasteInput.focus();
  showToast(message, tone);
}

function activate(name) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  els.views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
}

function renderEmpty(target, text) {
  target.innerHTML = `<div class="empty">${escapeHtml(text)}</div>`;
}

function showToast(message, tone = "ok") {
  els.toast.textContent = message;
  els.toast.dataset.tone = tone;
  els.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("is-visible"), 2200);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
