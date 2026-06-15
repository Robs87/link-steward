const defaultSettings = {
  apiBase: "http://localhost:3088",
  apiToken: "",
  defaultCategoryId: "",
  defaultCategoryName: "默认分类"
};

export async function getSettings() {
  return chrome.storage.sync.get(defaultSettings);
}

export async function saveSettings(settings) {
  const normalized = {
    apiBase: normalizeBase(settings.apiBase || defaultSettings.apiBase),
    apiToken: (settings.apiToken || "").trim(),
    defaultCategoryId: String(settings.defaultCategoryId || ""),
    defaultCategoryName: settings.defaultCategoryName || defaultSettings.defaultCategoryName
  };
  await chrome.storage.sync.set(normalized);
  return normalized;
}

export async function listCategories(limit = 500) {
  const settings = await getSettings();
  const body = await request(settings, "category_list", { page: 1, limit });
  return {
    count: Number(body.count || 0),
    categories: (body.data || []).map(normalizeCategory)
  };
}

export async function listLinks({ categoryId = "", page = 1, limit = 100, query = "" } = {}) {
  const settings = await getSettings();
  const method = categoryId ? "q_category_link" : "link_list";
  const body = await request(settings, method, {
    page,
    limit,
    category_id: categoryId
  });
  const links = (body.data || []).map(normalizeLink);
  const keyword = query.trim().toLowerCase();

  return {
    count: Number(body.count || links.length),
    links: keyword
      ? links.filter((link) => {
          return [link.title, link.url, link.description, link.categoryName]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(keyword));
        })
      : links
  };
}

export async function addLink({ title, url, description = "", categoryId, isPrivate = true }) {
  const settings = await getSettings();
  const body = await request(settings, "add_link", {
    fid: categoryId || settings.defaultCategoryId,
    title,
    url,
    url_standby: "",
    description,
    property: isPrivate ? 1 : 0,
    weight: 0,
    font_icon: ""
  });
  return body;
}

export async function suggestLink({ title = "", url, description = "", categoryId = "" }) {
  const settings = await getSettings();
  const body = await request(settings, "ai_link_suggest", {
    url,
    title,
    description,
    fid: categoryId
  });
  return body.data || {};
}

export async function testConnection(settingsInput) {
  const settings = {
    ...(await getSettings()),
    ...settingsInput,
    apiBase: normalizeBase(settingsInput.apiBase || defaultSettings.apiBase)
  };
  await request(settings, "category_list", { page: 1, limit: 1 });
  return true;
}

export function normalizeBase(value) {
  return (value || "").trim().replace(/\/+$/, "");
}

export function statusText(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message === "MISSING_TOKEN") return "请先在设置里填写 API Token";
  if (message === "MISSING_BASE") return "请先填写 API 域名";
  if (message === "SERVER_UNREACHABLE") return "无法连接 OneNav 服务";
  if (message === "AUTH_FAILED") return "API Token 不正确";
  if (message === "REQUEST_FAILED") return "请求失败";
  return message || "操作失败";
}

async function request(settings, method, params = {}, httpMethod = "POST") {
  const apiBase = normalizeBase(settings.apiBase);
  const token = (settings.apiToken || "").trim();
  if (!apiBase) throw new Error("MISSING_BASE");
  if (!token) throw new Error("MISSING_TOKEN");

  const search = new URLSearchParams({ c: "api", method });
  const init = {
    method: httpMethod,
    headers: {
      "X-Token": token
    }
  };

  if (httpMethod === "GET") {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    }
    search.set("token", token);
  } else {
    const form = new URLSearchParams();
    form.set("token", token);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        form.set(key, String(value));
        if (method === "category_list" && (key === "page" || key === "limit")) {
          search.set(key, String(value));
        }
      }
    }
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = form.toString();
  }

  let response;
  try {
    response = await fetch(`${apiBase}/index.php?${search.toString()}`, init);
  } catch {
    throw new Error("SERVER_UNREACHABLE");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error("REQUEST_FAILED");
  if (body.code === -1002) throw new Error("AUTH_FAILED");
  if (Number(body.code) !== 0) {
    throw new Error(body.err_msg || body.msg || "REQUEST_FAILED");
  }
  return body;
}

function normalizeCategory(category) {
  return {
    id: String(category.id),
    parentId: String(category.fid || "0"),
    name: decodeHtml(category.name || ""),
    linkCount: Number(category.link_num || 0),
    isPrivate: Number(category.property || 0) === 1
  };
}

function normalizeLink(link) {
  return {
    id: String(link.id),
    categoryId: String(link.fid || ""),
    categoryName: decodeHtml(link.category_name || ""),
    title: decodeHtml(link.title || ""),
    url: link.url || "",
    description: decodeHtml(link.description || ""),
    isPrivate: Number(link.property || 0) === 1
  };
}

function decodeHtml(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}
