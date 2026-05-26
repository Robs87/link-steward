const input = document.querySelector("#serverUrl");
const apiToken = document.querySelector("#apiToken");
const deviceName = document.querySelector("#deviceName");
const status = document.querySelector("#status");

chrome.storage.sync.get({ serverUrl: "http://localhost:3088", apiToken: "", deviceName: "Browser Extension" }, (items) => {
  input.value = items.serverUrl;
  apiToken.value = items.apiToken;
  deviceName.value = items.deviceName;
});

document.querySelector("#save").addEventListener("click", () => {
  chrome.storage.sync.set({ serverUrl: input.value, apiToken: apiToken.value, deviceName: deviceName.value }, () => {
    status.textContent = "已保存";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
});

document.querySelector("#test").addEventListener("click", async () => {
  try {
    const response = await fetch(`${input.value.replace(/\/$/, "")}/api/extension/me`, {
      headers: {
        authorization: `Bearer ${apiToken.value}`
      }
    });

    if (response.ok) {
      status.textContent = "连接成功";
    } else if (response.status === 401) {
      status.textContent = "API token 无效";
    } else {
      status.textContent = `连接失败: ${response.status}`;
    }
  } catch {
    status.textContent = "无法连接服务端";
  }
});
