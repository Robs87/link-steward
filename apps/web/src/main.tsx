import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bookmark, ExternalLink, LogOut, RefreshCw, Server, ShieldCheck } from "lucide-react";
import "./styles.css";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "member";
};

type AuthMode = "loading" | "setup" | "login" | "ready";

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
  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
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
        await loadBookmarks();
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
      await loadBookmarks();
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
    setMode("login");
  }

  async function loadBookmarks() {
    const result = await api<{ bookmarks: BookmarkRow[] }>("/api/bookmarks");
    setBookmarks(result.bookmarks);
  }

  async function createExtensionToken() {
    const result = await api<{ token: string }>("/api/extension/tokens", {
      method: "POST",
      body: JSON.stringify({
        deviceName: "Browser Extension",
        browser: "Chrome/Edge",
        extensionVersion: "0.1.0"
      })
    });
    setExtensionToken(result.token);
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
          <a className="active">概览</a>
          <a>个人库</a>
          <a>共享 Collection</a>
          <a>导入 / 导出</a>
          <a>设置</a>
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
            <p>生成 token 后，在扩展设置页填写服务端地址和 API token。</p>
          </div>
          <button onClick={createExtensionToken}>生成扩展 token</button>
          {extensionToken ? <code>{extensionToken}</code> : null}
        </section>
        <section className="list-panel">
          <div className="section-header">
            <div>
              <h2>最近书签</h2>
              <p>扩展保存成功后会出现在这里。</p>
            </div>
            <button className="icon-button subtle" onClick={loadBookmarks} aria-label="刷新书签">
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
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
