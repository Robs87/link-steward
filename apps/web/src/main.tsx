import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bookmark,
  Copy,
  ExternalLink,
  FolderKanban,
  LogOut,
  Plus,
  RefreshCw,
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
  collectionName: string;
  createdAt: string;
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
  const [extensionDevices, setExtensionDevices] = useState<ExtensionDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
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
        await Promise.all([loadBookmarks(), loadExtensionDevices()]);
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
      await Promise.all([loadBookmarks(), loadExtensionDevices()]);
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
    setExtensionDevices([]);
    setMode("login");
  }

  async function loadBookmarks() {
    const result = await api<{ bookmarks: BookmarkRow[] }>("/api/bookmarks");
    setBookmarks(result.bookmarks);
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
          <strong>Link Steward</strong>
        </div>
        <nav>
          <NavLink active={activeView === "overview"} view="overview" onSelect={setActiveView}>
            概览
          </NavLink>
          <NavLink active={activeView === "library"} view="library" onSelect={setActiveView}>
            个人库
          </NavLink>
          <NavLink active={activeView === "collections"} view="collections" onSelect={setActiveView}>
            共享 Collection
          </NavLink>
          <NavLink active={activeView === "importExport"} view="importExport" onSelect={setActiveView}>
            导入 / 导出
          </NavLink>
          <NavLink active={activeView === "settings"} view="settings" onSelect={setActiveView}>
            设置
          </NavLink>
        </nav>
      </aside>
      <section className="content">
        <header>
          <div>
            <p>Owner</p>
            <h1>{user?.displayName}</h1>
          </div>
          <button className="icon-button" onClick={logout} aria-label="退出登录">
            <LogOut size={18} />
          </button>
        </header>
        {activeView === "overview" ? (
          <OverviewView
            bookmarks={bookmarks}
            extensionToken={extensionToken}
            createExtensionToken={createExtensionToken}
            loadBookmarks={loadBookmarks}
          />
        ) : null}
        {activeView === "library" ? <LibraryView bookmarks={bookmarks} loadBookmarks={loadBookmarks} /> : null}
        {activeView === "collections" ? <CollectionsView /> : null}
        {activeView === "importExport" ? <ImportExportView /> : null}
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
  extensionToken,
  createExtensionToken,
  loadBookmarks
}: {
  bookmarks: BookmarkRow[];
  extensionToken: string | null;
  createExtensionToken: () => Promise<void>;
  loadBookmarks: () => Promise<void>;
}) {
  return (
    <>
      <div className="metric-grid">
        <article>
          <Server size={20} />
          <span>服务端</span>
          <strong>已连接</strong>
        </article>
        <article>
          <ShieldCheck size={20} />
          <span>Owner 初始化</span>
          <strong>完成</strong>
        </article>
        <article>
          <Bookmark size={20} />
          <span>已保存书签</span>
          <strong>{bookmarks.length}</strong>
        </article>
      </div>
      <section className="tool-panel">
        <div>
          <h2>浏览器扩展</h2>
          <p>生成 token 后，在扩展设置页填写服务端地址和 API token。完整设备管理在设置页。</p>
        </div>
        <button onClick={createExtensionToken}>生成扩展 token</button>
        {extensionToken ? <code>{extensionToken}</code> : null}
      </section>
      <BookmarkList title="最近书签" description="扩展保存成功后会出现在这里。" bookmarks={bookmarks} onRefresh={loadBookmarks} />
    </>
  );
}

function LibraryView({ bookmarks, loadBookmarks }: { bookmarks: BookmarkRow[]; loadBookmarks: () => Promise<void> }) {
  return (
    <>
      <section className="view-heading">
        <Bookmark size={22} />
        <div>
          <h2>个人库</h2>
          <p>集中查看当前账号保存到 Personal Library 的书签。</p>
        </div>
      </section>
      <BookmarkList title="全部书签" description="当前版本展示最近 100 条书签。" bookmarks={bookmarks} onRefresh={loadBookmarks} />
    </>
  );
}

function CollectionsView() {
  return (
    <section className="placeholder-panel">
      <FolderKanban size={24} />
      <h2>共享 Collection</h2>
      <p>这里会承载家庭或团队共享资料库。下一步会接入 collection 创建、移动书签和权限设置。</p>
    </section>
  );
}

function ImportExportView() {
  return (
    <section className="placeholder-panel">
      <Upload size={24} />
      <h2>导入 / 导出</h2>
      <p>这里会放 HTML bookmarks、JSON、Markdown 和 OneNav 导入导出入口。</p>
    </section>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function BookmarkList({
  title,
  description,
  bookmarks,
  onRefresh
}: {
  title: string;
  description: string;
  bookmarks: BookmarkRow[];
  onRefresh: () => Promise<void>;
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
        <ul className="bookmark-list">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id}>
              <div>
                <strong>{bookmark.title}</strong>
                <span>{bookmark.domain} · {bookmark.collectionName}</span>
              </div>
              <a href={bookmark.url} target="_blank" rel="noreferrer" aria-label={`打开 ${bookmark.title}`}>
                <ExternalLink size={17} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
