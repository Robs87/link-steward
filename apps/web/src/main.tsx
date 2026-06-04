import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bookmark,
  Copy,
  Download,
  ExternalLink,
  FolderKanban,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  Upload
} from "lucide-react";
import "./styles.css";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "member";
};

type AuthMode = "loading" | "setup" | "login" | "ready";
type AppView = "overview" | "library" | "collections" | "importExport" | "settings";
const appViews = new Set<AppView>(["overview", "library", "collections", "importExport", "settings"]);

type BookmarkRow = {
  id: string;
  title: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  description: string | null;
  collectionId: string;
  collectionName: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived";
  tags: string[];
};

type CollectionRow = {
  id: string;
  name: string;
  type: "personal" | "shared";
  visibility: "private" | "workspace";
  bookmarkCount: number;
  archivedAt: string | null;
};

type ExtensionDevice = {
  id: string;
  deviceName: string;
  browser: string | null;
  extensionVersion: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
};

type BookmarkFilters = {
  q: string;
  collectionId: string;
  status: "active" | "archived" | "all";
};

const defaultFilters: BookmarkFilters = {
  q: "",
  collectionId: "",
  status: "active"
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

function App() {
  const [mode, setMode] = useState<AuthMode>("loading");
  const [activeView, setActiveView] = useState<AppView>(getViewFromHash);
  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [extensionDevices, setExtensionDevices] = useState<ExtensionDevice[]>([]);
  const [filters, setFilters] = useState<BookmarkFilters>(defaultFilters);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [extensionToken, setExtensionToken] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const status = await api<{ ownerExists: boolean }>("/api/auth/setup-status");
      if (!status.ownerExists) {
        setMode("setup");
        return;
      }

      try {
        const me = await api<{ user: User }>("/api/auth/me");
        setUser(me.user);
        await loadWorkspace(defaultFilters);
        setMode("ready");
      } catch {
        setMode("login");
      }
    }

    load().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "启动失败");
      setMode("login");
    });
  }, []);

  useEffect(() => {
    function syncViewFromHash() {
      setActiveView(getViewFromHash());
    }

    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, []);

  async function loadWorkspace(nextFilters = filters) {
    await Promise.all([loadBookmarks(nextFilters), loadCollections(), loadExtensionDevices()]);
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
      password: String(form.get("password") ?? "")
    };

    try {
      const result = await api<{ user: User }>(mode === "setup" ? "/api/auth/setup-owner" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(mode === "setup" ? payload : { email: payload.email, password: payload.password })
      });
      setUser(result.user);
      await loadWorkspace(defaultFilters);
      setMode("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "认证失败");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    setUser(null);
    setExtensionToken(null);
    setBookmarks([]);
    setCollections([]);
    setExtensionDevices([]);
    setMode("login");
  }

  async function loadBookmarks(nextFilters = filters) {
    const query = new URLSearchParams();
    if (nextFilters.q) query.set("q", nextFilters.q);
    if (nextFilters.collectionId) query.set("collectionId", nextFilters.collectionId);
    query.set("status", nextFilters.status);
    const result = await api<{ bookmarks: BookmarkRow[] }>(`/api/bookmarks?${query.toString()}`);
    setBookmarks(result.bookmarks);
  }

  async function loadCollections() {
    const result = await api<{ collections: CollectionRow[] }>("/api/collections");
    setCollections(result.collections);
  }

  async function loadExtensionDevices() {
    const result = await api<{ devices: ExtensionDevice[] }>("/api/extension/devices");
    setExtensionDevices(result.devices);
  }

  async function createExtensionToken(input?: { deviceName?: string; browser?: string }) {
    const result = await api<{ token: string }>("/api/extension/tokens", {
      method: "POST",
      body: JSON.stringify({
        deviceName: input?.deviceName || "Browser Extension",
        browser: input?.browser || "Chrome/Edge",
        extensionVersion: "0.1.0"
      })
    });
    setExtensionToken(result.token);
    await loadExtensionDevices();
  }

  async function revokeDevice(deviceId: string) {
    await api(`/api/extension/devices/${deviceId}`, {
      method: "DELETE",
      body: "{}"
    });
    await loadExtensionDevices();
  }

  async function saveBookmark(bookmarkId: string, input: Partial<BookmarkRow> & { tagText?: string }) {
    await api(`/api/bookmarks/${bookmarkId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        collectionId: input.collectionId,
        tags: splitTags(input.tagText ?? "")
      })
    });
    setNotice("书签已更新");
    await Promise.all([loadBookmarks(), loadCollections()]);
  }

  async function archiveBookmark(bookmarkId: string) {
    await api(`/api/bookmarks/${bookmarkId}`, { method: "DELETE", body: "{}" });
    setNotice("书签已归档");
    await Promise.all([loadBookmarks(), loadCollections()]);
  }

  async function createCollection(input: { name: string; type: "personal" | "shared"; visibility: "private" | "workspace" }) {
    await api("/api/collections", {
      method: "POST",
      body: JSON.stringify(input)
    });
    setNotice("文件夹已创建");
    await loadCollections();
  }

  async function updateCollection(
    collectionId: string,
    input: { name?: string; visibility?: "private" | "workspace"; archived?: boolean }
  ) {
    await api(`/api/collections/${collectionId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
    setNotice(input.archived ? "文件夹已归档" : "文件夹已更新");
    await Promise.all([loadBookmarks(), loadCollections()]);
  }

  async function importHtml(input: { html: string; collectionId: string }) {
    const result = await api<{ job: { importedCount: number; skippedCount: number } }>("/api/import/html-bookmarks", {
      method: "POST",
      body: JSON.stringify({
        html: input.html,
        collectionId: input.collectionId || undefined
      })
    });
    setNotice(`导入完成：新增 ${result.job.importedCount}，跳过 ${result.job.skippedCount}`);
    await Promise.all([loadBookmarks(), loadCollections()]);
    return result.job;
  }

  if (mode === "loading") {
    return <main className="shell">正在连接 Link Steward...</main>;
  }

  if (mode === "setup" || mode === "login") {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand">
            <Bookmark size={28} />
            <h1>Link Steward</h1>
          </div>
          <form onSubmit={submitAuth}>
            <h2>{mode === "setup" ? "初始化 Owner" : "登录"}</h2>
            {mode === "setup" ? <input name="displayName" placeholder="显示名称" required /> : null}
            <input name="email" type="email" placeholder="邮箱" required />
            <input name="password" type="password" placeholder="密码" minLength={mode === "setup" ? 10 : 1} required />
            {error ? <p className="error">{error}</p> : null}
            <button type="submit">{mode === "setup" ? "创建 Owner" : "登录"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside>
        <div className="brand compact">
          <Bookmark size={22} />
          <strong>Link Steward管理</strong>
        </div>
        <nav>
          <div className="nav-group">
            <p>链接管理</p>
            <NavLink active={activeView === "overview"} view="overview" onSelect={setActiveView}>
              后台首页
            </NavLink>
            <NavLink active={activeView === "library"} view="library" onSelect={setActiveView}>
              我的链接
            </NavLink>
            <NavLink active={activeView === "importExport"} view="importExport" onSelect={setActiveView}>
              书签导入
            </NavLink>
          </div>
          <div className="nav-group">
            <p>分类管理</p>
            <NavLink active={activeView === "collections"} view="collections" onSelect={setActiveView}>
              分类列表
            </NavLink>
          </div>
          <div className="nav-group">
            <p>系统设置</p>
            <NavLink active={activeView === "settings"} view="settings" onSelect={setActiveView}>
              扩展设置
            </NavLink>
          </div>
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p>前台首页</p>
            <h1>Link Steward 后台</h1>
          </div>
          <div className="topbar-account">
            <span>{user?.displayName}</span>
            <button className="icon-button" onClick={logout} aria-label="退出登录">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <section className="content">
          {notice ? (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice(null)}>关闭</button>
            </div>
          ) : null}
          {activeView === "overview" ? (
            <OverviewView
              bookmarks={bookmarks}
              collections={collections}
              extensionDevices={extensionDevices}
              extensionToken={extensionToken}
              createExtensionToken={createExtensionToken}
              loadWorkspace={loadWorkspace}
            />
          ) : null}
          {activeView === "library" ? (
            <LibraryView
              bookmarks={bookmarks}
              collections={collections}
              filters={filters}
              setFilters={setFilters}
              loadBookmarks={loadBookmarks}
              saveBookmark={saveBookmark}
              archiveBookmark={archiveBookmark}
            />
          ) : null}
          {activeView === "collections" ? (
            <CollectionsView
              collections={collections}
              createCollection={createCollection}
              updateCollection={updateCollection}
            />
          ) : null}
          {activeView === "importExport" ? (
            <ImportExportView collections={collections} importHtml={importHtml} />
          ) : null}
          {activeView === "settings" ? (
            <SettingsView
              user={user}
              extensionDevices={extensionDevices}
              extensionToken={extensionToken}
              createExtensionToken={createExtensionToken}
              revokeDevice={revokeDevice}
              clearExtensionToken={() => setExtensionToken(null)}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function getViewFromHash(): AppView {
  const view = window.location.hash.replace(/^#/, "");
  return appViews.has(view as AppView) ? (view as AppView) : "overview";
}

function NavLink({
  active,
  children,
  onSelect,
  view
}: {
  active: boolean;
  children: React.ReactNode;
  onSelect: (view: AppView) => void;
  view: AppView;
}) {
  return (
    <a className={active ? "active" : ""} href={`#${view}`} onClick={() => onSelect(view)}>
      {children}
    </a>
  );
}

function OverviewView({
  bookmarks,
  collections,
  extensionDevices,
  extensionToken,
  createExtensionToken,
  loadWorkspace
}: {
  bookmarks: BookmarkRow[];
  collections: CollectionRow[];
  extensionDevices: ExtensionDevice[];
  extensionToken: string | null;
  createExtensionToken: () => Promise<void>;
  loadWorkspace: () => Promise<void>;
}) {
  const activeDevices = extensionDevices.filter((device) => !device.revokedAt).length;
  const activeCollections = collections.filter((collection) => !collection.archivedAt).length;

  return (
    <>
      <div className="metric-grid">
        <article>
          <Server size={20} />
          <span>服务端</span>
          <strong>已连接</strong>
        </article>
        <article>
          <FolderKanban size={20} />
          <span>文件夹</span>
          <strong>{activeCollections}</strong>
        </article>
        <article>
          <Bookmark size={20} />
          <span>已保存书签</span>
          <strong>{bookmarks.length}</strong>
        </article>
        <article>
          <ShieldCheck size={20} />
          <span>扩展设备</span>
          <strong>{activeDevices}</strong>
        </article>
      </div>
      <section className="tool-panel">
        <div>
          <h2>浏览器扩展</h2>
          <p>生成 token 后，在扩展设置页填写服务端地址和 API token。设备管理在设置页。</p>
        </div>
        <button onClick={createExtensionToken}>生成扩展 token</button>
        {extensionToken ? <code>{extensionToken}</code> : null}
      </section>
      <BookmarkList
        title="最近书签"
        description="扩展保存、HTML 导入和手动整理后的书签会出现在这里。"
        bookmarks={bookmarks.slice(0, 10)}
        collections={collections}
        onRefresh={loadWorkspace}
      />
    </>
  );
}

function LibraryView({
  bookmarks,
  collections,
  filters,
  setFilters,
  loadBookmarks,
  saveBookmark,
  archiveBookmark
}: {
  bookmarks: BookmarkRow[];
  collections: CollectionRow[];
  filters: BookmarkFilters;
  setFilters: (filters: BookmarkFilters) => void;
  loadBookmarks: (filters?: BookmarkFilters) => Promise<void>;
  saveBookmark: (bookmarkId: string, input: Partial<BookmarkRow> & { tagText?: string }) => Promise<void>;
  archiveBookmark: (bookmarkId: string) => Promise<void>;
}) {
  async function submitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadBookmarks(filters);
  }

  return (
    <>
      <section className="view-heading">
        <Bookmark size={22} />
        <div>
          <h2>个人库</h2>
          <p>搜索、编辑、移动到文件夹、打标签和归档书签。</p>
        </div>
      </section>
      <form className="filter-bar" onSubmit={submitFilters}>
        <label>
          搜索
          <div className="input-with-icon">
            <Search size={16} />
            <input
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              placeholder="标题、URL、域名、描述、标签"
            />
          </div>
        </label>
        <label>
          文件夹
          <select
            value={filters.collectionId}
            onChange={(event) => setFilters({ ...filters, collectionId: event.target.value })}
          >
            <option value="">全部</option>
            {collections
              .filter((collection) => !collection.archivedAt)
              .map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          状态
          <select
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value as BookmarkFilters["status"] })}
          >
            <option value="active">活跃</option>
            <option value="archived">已归档</option>
            <option value="all">全部</option>
          </select>
        </label>
        <button type="submit">
          <Search size={16} />
          搜索
        </button>
      </form>
      <BookmarkList
        title="全部书签"
        description="当前最多展示 500 条结果。"
        bookmarks={bookmarks}
        collections={collections}
        onRefresh={() => loadBookmarks(filters)}
        saveBookmark={saveBookmark}
        archiveBookmark={archiveBookmark}
        editable
      />
    </>
  );
}

function CollectionsView({
  collections,
  createCollection,
  updateCollection
}: {
  collections: CollectionRow[];
  createCollection: (input: { name: string; type: "personal" | "shared"; visibility: "private" | "workspace" }) => Promise<void>;
  updateCollection: (
    collectionId: string,
    input: { name?: string; visibility?: "private" | "workspace"; archived?: boolean }
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"private" | "workspace">("workspace");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createCollection({ name, type: visibility === "workspace" ? "shared" : "personal", visibility });
    setName("");
  }

  return (
    <>
      <section className="view-heading">
        <FolderKanban size={22} />
        <div>
          <h2>文件夹</h2>
          <p>创建共享或私有文件夹，并把书签移动进去。</p>
        </div>
      </section>
      <section className="tool-panel">
        <form className="inline-form" onSubmit={submit}>
          <label>
            名称
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Design references" required />
          </label>
          <label>
            可见性
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "workspace")}>
              <option value="workspace">Workspace 共享</option>
              <option value="private">私有</option>
            </select>
          </label>
          <button type="submit">
            <Plus size={16} />
            创建
          </button>
        </form>
      </section>
      <section className="list-panel">
        <div className="section-header">
          <div>
            <h2>现有文件夹</h2>
            <p>Personal Library 不能归档，其它文件夹可按需归档。</p>
          </div>
        </div>
        <ul className="collection-list">
          <li className="table-head">
            <span>分类名称</span>
            <span>编辑</span>
          </li>
          {collections.map((collection) => (
            <CollectionItem key={collection.id} collection={collection} updateCollection={updateCollection} />
          ))}
        </ul>
      </section>
    </>
  );
}

function CollectionItem({
  collection,
  updateCollection
}: {
  collection: CollectionRow;
  updateCollection: (
    collectionId: string,
    input: { name?: string; visibility?: "private" | "workspace"; archived?: boolean }
  ) => Promise<void>;
}) {
  const [name, setName] = useState(collection.name);
  const [visibility, setVisibility] = useState(collection.visibility);

  return (
    <li className={collection.archivedAt ? "revoked" : ""}>
      <div>
        <strong>{collection.name}</strong>
        <span>
          {collection.type} · {collection.visibility} · {collection.bookmarkCount} bookmarks
          {collection.archivedAt ? ` · 已归档 ${formatDate(collection.archivedAt)}` : ""}
        </span>
      </div>
      <div className="row-actions wide">
        <input value={name} onChange={(event) => setName(event.target.value)} aria-label={`${collection.name} 名称`} />
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as CollectionRow["visibility"])}>
          <option value="workspace">Workspace</option>
          <option value="private">Private</option>
        </select>
        <button className="subtle" onClick={() => updateCollection(collection.id, { name, visibility })}>
          <Save size={16} />
          保存
        </button>
        {collection.type !== "personal" && !collection.archivedAt ? (
          <button className="danger" onClick={() => updateCollection(collection.id, { archived: true })}>
            <Trash2 size={16} />
            归档
          </button>
        ) : null}
      </div>
    </li>
  );
}

function ImportExportView({
  collections,
  importHtml
}: {
  collections: CollectionRow[];
  importHtml: (input: { html: string; collectionId: string }) => Promise<{ importedCount: number; skippedCount: number }>;
}) {
  const [html, setHtml] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [report, setReport] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await importHtml({ html, collectionId });
    setReport(`新增 ${result.importedCount}，跳过 ${result.skippedCount}`);
    setHtml("");
  }

  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setHtml(await file.text());
    }
  }

  const exportSuffix = collectionId ? `?collectionId=${collectionId}` : "";

  return (
    <>
      <section className="view-heading">
        <Upload size={22} />
        <div>
          <h2>导入 / 导出</h2>
          <p>导入 Chrome / Edge bookmarks HTML，或导出为浏览器 HTML、JSON、Markdown。</p>
        </div>
      </section>
      <section className="tool-panel">
        <form onSubmit={submit}>
          <label>
            目标文件夹
            <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
              <option value="">Personal Library</option>
              {collections
                .filter((collection) => !collection.archivedAt)
                .map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            HTML 文件
            <input type="file" accept=".html,.htm,text/html" onChange={readFile} />
          </label>
          <label>
            HTML 内容
            <textarea value={html} onChange={(event) => setHtml(event.target.value)} rows={10} required />
          </label>
          <button type="submit">
            <Upload size={16} />
            导入 HTML
          </button>
          {report ? <p className="status-line">{report}</p> : null}
        </form>
      </section>
      <section className="list-panel">
        <div className="section-header">
          <div>
            <h2>导出</h2>
            <p>选择上方文件夹可导出单个文件夹，不选则导出全部活跃书签。</p>
          </div>
        </div>
        <div className="export-actions">
          <a href={`/api/export/html${exportSuffix}`} target="_blank" rel="noreferrer">
            <Download size={16} />
            HTML
          </a>
          <a href={`/api/export/json${exportSuffix}`} target="_blank" rel="noreferrer">
            <Download size={16} />
            JSON
          </a>
          <a href={`/api/export/markdown${exportSuffix}`} target="_blank" rel="noreferrer">
            <Download size={16} />
            Markdown
          </a>
        </div>
      </section>
    </>
  );
}

function SettingsView({
  user,
  extensionDevices,
  extensionToken,
  createExtensionToken,
  revokeDevice,
  clearExtensionToken
}: {
  user: User | null;
  extensionDevices: ExtensionDevice[];
  extensionToken: string | null;
  createExtensionToken: (input?: { deviceName?: string; browser?: string }) => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
  clearExtensionToken: () => void;
}) {
  const [deviceName, setDeviceName] = useState("Browser Extension");
  const [browser, setBrowser] = useState("Chrome/Edge");
  const [status, setStatus] = useState<string | null>(null);

  async function submitDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    try {
      await createExtensionToken({ deviceName, browser });
      setStatus("已生成新 token。复制后请立即保存到扩展设置页。");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "生成失败");
    }
  }

  async function copyToken() {
    if (!extensionToken) return;
    await navigator.clipboard.writeText(extensionToken);
    setStatus("已复制 token");
  }

  return (
    <>
      <section className="view-heading">
        <Settings size={22} />
        <div>
          <h2>设置</h2>
          <p>{user ? `${user.email} · ${user.role}` : "当前账号设置"}</p>
        </div>
      </section>
      <section className="tool-panel">
        <div className="section-header">
          <div>
            <h2>扩展 token</h2>
            <p>为 Chrome / Edge 扩展生成一次性可见 token，并管理已连接设备。</p>
          </div>
        </div>
        <form className="inline-form" onSubmit={submitDevice}>
          <label>
            设备名称
            <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} required />
          </label>
          <label>
            浏览器
            <input value={browser} onChange={(event) => setBrowser(event.target.value)} />
          </label>
          <button type="submit">
            <Plus size={16} />
            生成 token
          </button>
        </form>
        {extensionToken ? (
          <div className="token-box">
            <code>{extensionToken}</code>
            <button className="subtle" onClick={copyToken} type="button">
              <Copy size={16} />
              复制
            </button>
            <button className="subtle" onClick={clearExtensionToken} type="button">
              隐藏
            </button>
          </div>
        ) : null}
        {status ? <p className="status-line">{status}</p> : null}
      </section>
      <section className="list-panel">
        <div className="section-header">
          <div>
            <h2>已连接扩展设备</h2>
            <p>撤销后，对应扩展需要重新生成并填写 token。</p>
          </div>
        </div>
        {extensionDevices.length === 0 ? (
          <p className="empty">暂无扩展设备</p>
        ) : (
          <ul className="device-list">
            {extensionDevices.map((device) => (
              <li key={device.id} className={device.revokedAt ? "revoked" : ""}>
                <div>
                  <strong>{device.deviceName}</strong>
                  <span>
                    {device.browser || "未知浏览器"} · 创建 {formatDate(device.createdAt)}
                    {device.lastSeenAt ? ` · 最近连接 ${formatDate(device.lastSeenAt)}` : ""}
                    {device.revokedAt ? ` · 已撤销 ${formatDate(device.revokedAt)}` : ""}
                  </span>
                </div>
                {!device.revokedAt ? (
                  <button className="icon-button danger" onClick={() => revokeDevice(device.id)} aria-label={`撤销 ${device.deviceName}`}>
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function BookmarkList({
  title,
  description,
  bookmarks,
  collections,
  onRefresh,
  saveBookmark,
  archiveBookmark,
  editable = false
}: {
  title: string;
  description: string;
  bookmarks: BookmarkRow[];
  collections: CollectionRow[];
  onRefresh: () => Promise<void>;
  saveBookmark?: (bookmarkId: string, input: Partial<BookmarkRow> & { tagText?: string }) => Promise<void>;
  archiveBookmark?: (bookmarkId: string) => Promise<void>;
  editable?: boolean;
}) {
  return (
    <section className="list-panel">
      <div className="section-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button className="icon-button subtle" onClick={onRefresh} aria-label="刷新书签">
          <RefreshCw size={17} />
        </button>
      </div>
      {bookmarks.length === 0 ? (
        <p className="empty">暂无书签</p>
      ) : (
        <ul className={editable ? "bookmark-editor-list" : "bookmark-list"}>
          {editable ? (
            <li className="table-head">
              <span>链接信息</span>
              <span>分类 / 标签 / 操作</span>
            </li>
          ) : null}
          {bookmarks.map((bookmark) =>
            editable && saveBookmark && archiveBookmark ? (
              <BookmarkEditor
                key={bookmark.id}
                bookmark={bookmark}
                collections={collections}
                saveBookmark={saveBookmark}
                archiveBookmark={archiveBookmark}
              />
            ) : (
              <li key={bookmark.id}>
                <div>
                  <strong>{bookmark.title}</strong>
                  <span>
                    {bookmark.domain} · {bookmark.collectionName}
                    {bookmark.tags.length > 0 ? ` · ${bookmark.tags.join(", ")}` : ""}
                  </span>
                </div>
                <a href={bookmark.url} target="_blank" rel="noreferrer" aria-label={`打开 ${bookmark.title}`}>
                  <ExternalLink size={17} />
                </a>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}

function BookmarkEditor({
  bookmark,
  collections,
  saveBookmark,
  archiveBookmark
}: {
  bookmark: BookmarkRow;
  collections: CollectionRow[];
  saveBookmark: (bookmarkId: string, input: Partial<BookmarkRow> & { tagText?: string }) => Promise<void>;
  archiveBookmark: (bookmarkId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description ?? "");
  const [collectionId, setCollectionId] = useState(bookmark.collectionId);
  const [tagText, setTagText] = useState(bookmark.tags.join(", "));
  const activeCollections = useMemo(() => collections.filter((collection) => !collection.archivedAt), [collections]);

  return (
    <li>
      <div className="bookmark-edit-main">
        <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="书签标题" />
        <a href={bookmark.url} target="_blank" rel="noreferrer">
          {bookmark.domain}
        </a>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="描述"
          aria-label="描述"
        />
      </div>
      <div className="bookmark-edit-meta">
        <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)} aria-label="文件夹">
          {activeCollections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="标签，用逗号分隔" />
        <div className="row-actions">
          <button className="subtle" onClick={() => saveBookmark(bookmark.id, { title, description, collectionId, tagText })}>
            <Save size={16} />
            保存
          </button>
          {bookmark.status === "active" ? (
            <button className="danger" onClick={() => archiveBookmark(bookmark.id)}>
              <Trash2 size={16} />
              归档
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function splitTags(value: string) {
  return value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
