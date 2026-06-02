const input = document.querySelector("#serverUrl");
const apiToken = document.querySelector("#apiToken");
const deviceName = document.querySelector("#deviceName");
const showToken = document.querySelector("#showToken");
const status = document.querySelector("#status");

chrome.storage.sync.get({ serverUrl: "http://localhost:3088", apiToken: "", deviceName: "Browser Extension" }, (items) => {
  input.value = items.serverUrl;
  apiToken.value = items.apiToken;
  deviceName.value = items.deviceName;
  setStatus(items.apiToken ? "已保存 token，可以测试连接" : "尚未配置 token", items.apiToken ? "info" : "warn");
});

document.querySelector("#save").addEventListener("click", () => {
  const serverUrl = input.value.trim().replace(/\/$/, "");
  const token = apiToken.value.trim();
  const name = deviceName.value.trim() || "Browser Extension";

  chrome.storage.sync.set({ serverUrl, apiToken: token, deviceName: name }, () => {
    input.value = serverUrl;
    apiToken.value = token;
    deviceName.value = name;
    setStatus(token ? "已保存。建议立即测试连接。" : "已保存服务端地址，但 token 为空。", token ? "ok" : "warn");
  });
});

document.querySelector("#test").addEventListener("click", async () => {
  const serverUrl = input.value.trim().replace(/\/$/, "");
  const token = apiToken.value.trim();

  if (!serverUrl || !token) {
    setStatus("请先填写服务端地址和 API token", "warn");
    return;
  }

  setStatus("正在测试连接...", "info");

  try {
    const response = await fetch(`${serverUrl}/api/extension/me`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.user?.displayName ? `连接成功：${body.user.displayName}` : "连接成功", "ok");
    } else if (response.status === 401) {
      setStatus("API token 无效或已被撤销", "error");
    } else {
      setStatus(`连接失败: ${response.status}`, "error");
    }
  } catch {
    setStatus("无法连接服务端", "error");
  }
});

document.querySelector("#clear").addEventListener("click", () => {
  chrome.storage.sync.set({ apiToken: "" }, () => {
    apiToken.value = "";
    setStatus("已清除 token。本地保存会暂停，直到重新配置。", "warn");
  });
});

showToken.addEventListener("change", () => {
  apiToken.type = showToken.checked ? "text" : "password";
});

function setStatus(message, tone) {
  status.textContent = message;
  status.dataset.tone = tone;
}
