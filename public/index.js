// 全局 Loading 控制
let loadingRequestCount = 0;

function showLoading() {
  loadingRequestCount++;
  const overlay = document.getElementById('loadingOverlay');
  if (overlay && loadingRequestCount > 0) {
    overlay.classList.add('visible');
  }
}

function hideLoading() {
  loadingRequestCount--;
  if (loadingRequestCount < 0) loadingRequestCount = 0;
  const overlay = document.getElementById('loadingOverlay');
  if (overlay && loadingRequestCount === 0) {
    overlay.classList.remove('visible');
  }
}

// 拦截全局 fetch 请求以自动显示 Loading
const originalFetch = window.fetch;
window.fetch = async function (resource, init) {
  let skipLoading = false;
  let finalInit = init;

  if (init && init.skipLoading) {
    skipLoading = true;
    finalInit = { ...init };
    delete finalInit.skipLoading;
  }

  if (!skipLoading) {
    showLoading();
  }
  try {
    const response = await originalFetch(resource, finalInit);
    return response;
  } catch (error) {
    throw error;
  } finally {
    if (!skipLoading) {
      hideLoading();
    }
  }
};

const DEFAULT_EXTENSION_SCRIPT = `function main(config, profileName) {
  let content = JSON.parse(JSON.stringify(config));
  return content;
}
`;

class AceScriptEditor {
  constructor(editorId) {
    this.editor = null;
    this.editorId = editorId;
    this.container = document.getElementById(editorId);

    if (!this.container || typeof ace === "undefined") {
      return;
    }

    this.editor = ace.edit(editorId);
    this.editor.setTheme("ace/theme/monokai");
    this.editor.session.setMode("ace/mode/javascript");
    this.editor.session.setUseWrapMode(true);
    this.editor.session.setUseWorker(false);
    this.editor.setShowPrintMargin(false);
    this.editor.setOptions({
      fontSize: "13px",
      tabSize: 2,
      useSoftTabs: true,
      highlightActiveLine: true,
      behavioursEnabled: true,
    });
    this.editor.setValue(DEFAULT_EXTENSION_SCRIPT, -1);
  }

  setValue(value) {
    if (!this.editor) return;
    this.editor.setValue(value || DEFAULT_EXTENSION_SCRIPT, -1);
  }

  getValue() {
    if (!this.editor) return DEFAULT_EXTENSION_SCRIPT;
    return this.editor.getValue();
  }
}

class SubscriptionManager {
  constructor() {
    this.apiBase = "";
    this.subscriptions = [];
    this.token = null;
    this.init();
  }

  async init() {
    try {
      await this.loadConfig();
      await this.loadSubscriptions();
      this.bindEvents();
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  }

  bindEvents() {
    document
      .getElementById("addForm")
      ?.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addSubscription();
      });

    const addType = document.getElementById("modal-type");
    if (addType) {
      addType.addEventListener("change", (e) => {
        this.updateTypeUI("add", e.target.value);
      });
    }

    const editType = document.getElementById("edit-type");
    if (editType) {
      editType.addEventListener("change", (e) => {
        this.updateTypeUI("edit", e.target.value);
      });
    }
  }

  async loadConfig() {
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      this.token = config.token;
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  previewSubscription() {
    if (!this.token) {
      this.showMessage("Token未加载，请稍后再试", "error");
      return;
    }
    const format =
      typeof configManager?.getDefaultPreviewFormat === "function"
        ? configManager.getDefaultPreviewFormat()
        : "ss";
    const url = this.buildPreviewUrl(this.token, format);
    window.open(url, "_blank");
  }

  buildPreviewUrl(token, format) {
    const base = `/${token}`;
    const normalized = String(format || "").toLowerCase();
    if (normalized === "clash") {
      return `${base}?clash=1`;
    }
    return base;
  }

  refreshSubscription() {
    if (!this.token) {
      this.showMessage("Token未加载，请稍后再试", "error");
      return;
    }

    openConfirmModal(
      "确认刷新",
      "确定要刷新订阅缓存吗？<br><span style='color: #666; font-size: 13px;'>这将强制重新获取所有订阅内容，可能需要一些时间。</span>",
      async () => {
        try {
          const url = `/${this.token}?refresh=true`;
          const response = await fetch(url);
          if (response.ok) {
            this.showMessage("\u6d41\u91cf\u5df2\u5237\u65b0", "success");
          } else {
            this.showMessage("刷新失败，状态码：" + response.status, "error");
          }
        } catch (error) {
          this.showMessage("\u5237\u65b0\u6d41\u91cf\u5931\u8d25: " + error.message, "error");
        }
      }
    );
  }

  async loadSubscriptions() {
    try {
      console.log("Fetching subscriptions...");
      const response = await fetch(this.apiBase + "/api/subscriptions");
      if (!response.ok) throw new Error("Failed to fetch subscriptions");
      const data = await response.json();
      this.subscriptions = (data || []).map((sub) => {
        const isList = sub.type === "list" || sub.type === "node";
        if (isList) return sub;
        if (sub.userinfo && typeof sub.userinfo === "object") return sub;
        return { ...sub, userinfo: { pending: true } };
      });
      console.log("Fetched subscriptions:", this.subscriptions);
      this.renderSubscriptions(this.subscriptions);
      this.updateStats(this.subscriptions);
      this.loadUsage().catch((error) => {
        console.error("Error loading usage:", error);
      });
    } catch (error) {
      console.error("Error loading subscriptions:", error);
      document.getElementById("subscriptionsList").innerHTML =
        '<div class="error">加载失败，请稍后重试</div>';
    }
  }

  async loadUsage({ refresh = false } = {}) {
    const ids = this.subscriptions
      .filter((sub) => sub.type !== "list" && sub.type !== "node")
      .map((sub) => sub.id)
      .join(",");

    if (!ids) return;

    const url = `/api/subscriptions/usage?ids=${encodeURIComponent(ids)}${
      refresh ? "&refresh=1" : ""
    }`;
    const response = await fetch(url, { skipLoading: true });
    if (!response.ok) throw new Error("Failed to fetch usage");

    const result = await response.json();
    const usageMap = new Map(
      (result.data || []).map((item) => [String(item.id), item])
    );

    this.subscriptions = this.subscriptions.map((sub) => {
      const usage = usageMap.get(String(sub.id));
      if (!usage) return sub;
      return {
        ...sub,
        userinfo: usage.userinfo || {},
        _usageMeta: {
          isStale: usage.isStale,
          updatedAt: usage.updatedAt,
        },
      };
    });

    this.renderSubscriptions(this.subscriptions);
  }

  async refreshUsage() {
    try {
      await this.loadUsage({ refresh: true });
      this.showMessage("流量已刷新", "success");
    } catch (error) {
      console.error("Error refreshing usage:", error);
      this.showMessage("刷新流量失败: " + error.message, "error");
    }
  }

  updateStats(subscriptions) {
    const total = subscriptions.length;
    const active = subscriptions.filter((s) => s.active).length;
    const inactive = total - active;

    document.getElementById("totalCount").textContent = total;
    document.getElementById("activeCount").textContent = active;
    document.getElementById("inactiveCount").textContent = inactive;
  }

  getUsageClass(usage) {
    if (usage <= 50) return "low";
    if (usage <= 80) return "medium";
    return "high";
  }

  formatTraffic(bytes, total) {
    // 兼容保留：当只有合并使用率需要时仍可使用原展示（单色进度条）
    console.log("formatTraffic input:", { bytes, total });
    const bytesInGB = bytes / 1024 / 1024 / 1024;
    const totalInGB = total / 1024 / 1024 / 1024;
    console.log("formatTraffic converted:", { bytesInGB, totalInGB });

    if (!totalInGB) return "";
    const usage = Math.min(
      100,
      Math.round((bytesInGB / totalInGB) * 100)
    );
    const usageClass = this.getUsageClass(usage);
    return `
        <div class="usage-bar">
          <div class="usage-progress ${usageClass}" style="width: ${usage}%"></div>
        </div>
        <span class="usage-text">${usage}%</span>
      `;
  }

  formatUsageBar(upload, download, total) {
    // 仅返回分段进度条（不包含文本），文本将放到上一行显示
    if (!total || total <= 0) return "";

    const up = upload || 0;
    const down = download || 0;

    let downPct = Math.round((down / total) * 100);
    let upPct = Math.round((up / total) * 100);

    if (downPct + upPct > 100) {
      const scale = 100 / (downPct + upPct);
      downPct = Math.round(downPct * scale);
      upPct = 100 - downPct;
    }

    return `
        <div class="usage-bar">
          <div class="usage-download" style="width:${downPct}%"></div>
          <div class="usage-upload" style="width:${upPct}%"></div>
        </div>
      `;
  }

  formatUsageText(upload, download, total) {
    if (!total || total <= 0) return "0B / 0B";

    const used = (upload || 0) + (download || 0);

    const formatSize = (bytes) => {
      if (bytes === 0) return '0B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
    };

    return `${formatSize(used)} / ${formatSize(total)}`;
  }

  formatExpireDate(expire) {
    if (!expire) return "长期有效";
    const date = new Date(expire * 1000);
    return date.toISOString().split('T')[0];
  }

  formatGB(sub) {
    // 返回剩余流量，明确在无有效 total 时返回 "0GB"
    if (!sub || !sub.userinfo) return "0GB";

    const userinfo = sub.userinfo || {};

    // 如果没有 total 或者 total 非正，则直接返回 0GB（不再使用配置作为回退）
    if (!userinfo.total || userinfo.total <= 0) return "0GB";

    const used = (userinfo.upload || 0) + (userinfo.download || 0);
    const remaining = (userinfo.total - used) / 1024 / 1024 / 1024;

    if (!isFinite(remaining) || isNaN(remaining) || remaining <= 0)
      return "0GB";

    return `${Math.round(remaining)}GB`;
  }

  calculateUsage(userinfo) {
    // 仅在存在有效 total 时计算使用率，否则返回 0
    if (!userinfo || !userinfo.total || userinfo.total <= 0) return 0;

    const used = (userinfo.upload || 0) + (userinfo.download || 0);
    const usage = Math.min(
      100,
      Math.round((used / userinfo.total) * 100)
    );
    return usage;
  }

  renderSubscriptions(subscriptions) {
    const container = document.getElementById("subscriptionsList");

    if (!subscriptions || subscriptions.length === 0) {
      container.innerHTML =
        '<div class="no-subscriptions">暂无订阅数据</div>';
      return;
    }

    console.log("Rendering subscriptions:", subscriptions);
    const html = subscriptions
      .map((sub) => {
        console.log("Processing subscription:", sub);
        // 仅使用接口返回的 userinfo，不再从配置或页面读取 total
        const isList = sub.type === 'list' || sub.type === 'node';
        const userinfo = sub.userinfo || {};
        const usagePending = !isList && userinfo.pending === true;

        const usage = this.calculateUsage(userinfo);
        const usageClass = this.getUsageClass(usage);
        const usageHtml = usagePending
          ? '\u52a0\u8f7d\u4e2d...'
          : this.formatUsageBar(
              userinfo.upload || 0,
              userinfo.download || 0,
              userinfo.total
            );
        const usageText = usagePending
          ? '加载中...'
          : this.formatUsageText(
              userinfo.upload || 0,
              userinfo.download || 0,
              userinfo.total
            );
        const expireText = usagePending
          ? '...'
          : this.formatExpireDate(userinfo.expire);

        console.log("Processed values:", {
          usage,
          usageClass,
          usageHtml,
          usageText,
        });

        const typeLabel = isList ? "节点列表" : "订阅";
        const listCount = isList ? this.parseNodeUrls(sub.url || "").length : 0;

        return `
          <div class="subscription-item ${sub.active ? "active" : "inactive"
          }">
            <div class="subscription-header">
              <div class="subscription-name" style="position: relative;">
                ${isList ? '🔌' : '📡'} ${sub.name}
                <span style="font-size: 0.8em; color: #666; margin-left: 8px; font-weight: normal; background: #eee; padding: 2px 6px; border-radius: 4px;">
                  ${typeLabel}
                </span>
              </div>
              <div class="subscription-status ${sub.active ? "status-active" : "status-inactive"
          }">
                ${sub.active ? "活跃" : "已禁用"}
              </div>
            </div>
            <div class="subscription-url" title="${sub.url}" style="cursor: pointer;" onclick="subscriptionManager.copyToClipboard('${this.escapeJs(sub.url)}')">
              🔗 ${isList ? `本地节点列表 · ${listCount} 条` : this.getDomain(sub.url)}
            </div>
            ${sub.description
            ? `<div class="subscription-description">${sub.description}</div>`
            : ""
          }
            ${!isList ? `
            <div class="subscription-meta">
              <div class="subscription-meta-row" style="justify-content: space-between; margin-bottom: 8px;">
                <span class="meta-traffic${usagePending ? " pending" : ""}" style="font-size: 0.9em; color: #333;">${usageText}</span>
                <span class="meta-expire${usagePending ? " pending" : ""}" style="font-size: 0.9em; color: #666;">${expireText}</span>
              </div>
              <div class="subscription-meta-row">
                ${usageHtml}
              </div>
            </div>` : ''}
            <div class="subscription-actions">
              <button class="btn btn-primary btn-sm" onclick="subscriptionManager.copyToClipboard('${this.escapeJs(sub.url)}')">
                复制
              </button>
              <button class="btn btn-primary btn-sm" onclick="openEditModal(${sub.id
          }, '${this.escapeJs(sub.name)}', '${this.escapeJs(
            sub.url
          )}', '${this.escapeJs(sub.description || "")}', '${sub.type || "subscription"}')">
                            编辑
                        </button>
              <button class="btn btn-sm ${sub.active ? "btn-warning" : "btn-success"
          }" 
                onclick="subscriptionManager.toggleSubscription('${sub.id
          }')">
                ${sub.active ? "禁用" : "启用"}
              </button>
              <button class="btn btn-sm btn-danger" onclick="subscriptionManager.deleteSubscription('${sub.id
          }', '${this.escapeJs(sub.name)}')">删除</button>
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = html;
  }

  async addSubscription() {
    const type = document.getElementById("modal-type").value;
    const name = document.getElementById("modal-name").value.trim();
    const url = document.getElementById("modal-url").value.trim();
    const description = document
      .getElementById("modal-description")
      .value.trim();

    if (!url) {
      const label = type === "list" ? "节点列表" : "订阅";
      this.showMessage(`请填写${label}链接`, "error");
      return;
    }

    try {
      if (type === "list") {
        const urls = this.parseNodeUrls(url);
        if (urls.length === 0) {
          this.showMessage("请输入有效的节点链接", "error");
          return;
        }
        const finalName = name || "节点列表";
        const normalizedUrl = urls.join("\n");
        const response = await fetch("/api/subscriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: finalName,
            url: normalizedUrl,
            description,
            type,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          this.showMessage("节点列表添加成功！", "success");
          document.getElementById("addForm").reset();
          closeModal("addModal");
          this.loadSubscriptions();
        } else {
          this.showMessage("添加失败：" + result.error, "error");
        }
        return;
      }

      if (!name) {
        this.showMessage("请填写订阅名称", "error");
        return;
      }

      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, url, description, type }),
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage("订阅添加成功！", "success");
        document.getElementById("addForm").reset();
        closeModal("addModal");
        this.loadSubscriptions();
      } else {
        this.showMessage("添加失败：" + result.error, "error");
      }
    } catch (error) {
      this.showMessage("添加失败：" + error.message, "error");
    }
  }

  async toggleSubscription(id) {
    try {
      const response = await fetch(`/api/subscriptions/${id}/toggle`, {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage("订阅状态更新成功！", "success");
        this.loadSubscriptions();
      } else {
        this.showMessage("更新失败：" + result.error, "error");
      }
    } catch (error) {
      this.showMessage("更新失败：" + error.message, "error");
    }
  }

  deleteSubscription(id, name) {
    openConfirmModal(
      "确认删除",
      `确定要删除订阅 "${name}" 吗？此操作无法撤销。`,
      async () => {
        try {
          const response = await fetch(`/api/subscriptions/${id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (response.ok) {
            this.showMessage("订阅删除成功！", "success");
            this.loadSubscriptions();
          } else {
            this.showMessage("删除失败：" + result.error, "error");
          }
        } catch (error) {
          this.showMessage("删除失败：" + error.message, "error");
        }
      }
    );
  }

  async updateSubscription(id, name, url, description, type) {
    if (!name || !url) {
      const label = type === "node" ? "节点" : "订阅";
      this.showMessage(`${label}名称和链接不能为空`, "error");
      return;
    }

    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, url, description, type }),
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage("订阅更新成功！", "success");
        this.loadSubscriptions();
      } else {
        this.showMessage("更新失败：" + result.error, "error");
      }
    } catch (error) {
      this.showMessage("更新失败：" + error.message, "error");
    }
  }

  showMessage(message, type) {
    createGlobalToast(message, type);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  escapeJs(text) {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }

  getProtocol(url) {
    try {
      const index = url.indexOf("://");
      if (index > -1) {
        return url.substring(0, index).toUpperCase();
      }
      return "节点";
    } catch (e) {
      return "节点";
    }
  }

  getDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return url;
    }
  }

  parseNodeUrls(text) {
    return text
      .split(/[\r\n,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  updateTypeUI(mode, type) {
    const normalizedType = type === "node" ? "list" : type;
    const isList = normalizedType === "list";
    const label = isList ? "节点列表" : "订阅链接";
    const placeholder = isList
      ? "trojan://example.com:443?security=tls#节点名\nvmess://xxxx\n..."
      : "https://example.com/subscribe";
    const helpText = isList
      ? "可粘贴多条节点链接，每行一条"
      : "仅支持单条订阅链接";

    if (mode === "add") {
      const urlLabel = document.querySelector('label[for="modal-url"]');
      const urlInput = document.getElementById("modal-url");
      const urlHelp = document.getElementById("modal-url-help");
      if (urlLabel) urlLabel.textContent = `${label} *`;
      if (urlInput) urlInput.placeholder = placeholder;
      if (urlHelp) urlHelp.textContent = helpText;
    } else if (mode === "edit") {
      const urlLabel = document.querySelector('label[for="edit-url"]');
      const urlInput = document.getElementById("edit-url");
      const urlHelp = document.getElementById("edit-url-help");
      if (urlLabel) urlLabel.textContent = `${label} *`;
      if (urlInput) urlInput.placeholder = placeholder;
      if (urlHelp) urlHelp.textContent = helpText;
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showMessage("链接已复制到剪贴板", "success");
    } catch (err) {
      console.error("Copy failed", err);
      this.showMessage("复制失败 (请手动复制)", "error");
    }
  }
}

class ConfigManager {
  constructor() {
    this.extensionScriptEditor = new AceScriptEditor("modal-extensionScriptEditor");
    this.currentConfig = null;
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.bindEvents();
  }

  bindEvents() {
    document
      .getElementById("configForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveConfig();
      });
  }

  async loadConfig() {
    try {
      const [configResponse, scriptResponse] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/extension-script"),
      ]);

      if (!configResponse.ok) {
        throw new Error("加载系统配置失败");
      }
      if (!scriptResponse.ok) {
        throw new Error("加载扩展脚本失败");
      }

      const config = await configResponse.json();
      const scriptResult = await scriptResponse.json();
      this.populateForm(config, scriptResult.script);
    } catch (error) {
      this.showMessage("加载配置失败：" + error.message, "error");
    }
  }

  populateForm(config, extensionScript = DEFAULT_EXTENSION_SCRIPT) {
    document.getElementById("modal-token").value = config.token || "";
    document.getElementById("modal-fileName").value =
      config.fileName || "";
    const previewFormat = config.defaultPreviewFormat || "ss";
    const previewFormatEl = document.getElementById("modal-defaultPreviewFormat");
    if (previewFormatEl) {
      previewFormatEl.value = previewFormat;
    }
    document.getElementById("modal-subUpdateTime").value =
      config.subUpdateTime || 6;
    document.getElementById("modal-total").value = config.total ?? 0;
    document.getElementById("modal-botToken").value =
      config.botToken || "";
    document.getElementById("modal-chatId").value = config.chatId || "";
    document.getElementById("modal-adminPassword").value =
      config.adminPassword || "";
    this.extensionScriptEditor.setValue(extensionScript || DEFAULT_EXTENSION_SCRIPT);
    this.currentConfig = { ...config, defaultPreviewFormat: previewFormat };
  }

  async saveConfig() {
    const config = {
      token: document.getElementById("modal-token").value.trim(),
      fileName: document.getElementById("modal-fileName").value.trim(),
      defaultPreviewFormat:
        document.getElementById("modal-defaultPreviewFormat")?.value || "ss",
      subUpdateTime:
        parseInt(document.getElementById("modal-subUpdateTime").value) ||
        6,
      total:
        document.getElementById("modal-total").value === ""
          ? 0
          : parseInt(document.getElementById("modal-total").value, 10) || 0,
      botToken: document.getElementById("modal-botToken").value.trim(),
      chatId: document.getElementById("modal-chatId").value.trim(),
      adminPassword: document
        .getElementById("modal-adminPassword")
        .value.trim(),
    };

    if (!config.token || !config.fileName || !config.adminPassword) {
      this.showMessage("访问令牌、文件名称和管理员密码不能为空", "error");
      return;
    }

    try {
      const extensionScript = this.extensionScriptEditor.getValue();
      const [configResponse, scriptResponse] = await Promise.all([
        fetch("/api/config", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
        fetch("/api/extension-script", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ script: extensionScript }),
        }),
      ]);

      const configResult = await configResponse.json();
      const scriptResult = await scriptResponse.json();

      if (configResponse.ok && scriptResponse.ok) {
        this.showMessage("配置保存成功！", "success");
        this.currentConfig = configResult.config || config;
        closeModal("configModal");
      } else {
        const errorMsg = configResult.error || scriptResult.error || "保存失败";
        this.showMessage("保存失败：" + errorMsg, "error");
      }
    } catch (error) {
      this.showMessage("保存失败：" + error.message, "error");
    }
  }

  resetConfig() {
    openConfirmModal(
      "确认重置",
      "确定要重置配置为默认值吗？",
      async () => {
        try {
          const response = await fetch("/api/config/reset", {
            method: "POST",
          });

          const result = await response.json();

          if (response.ok) {
            this.showMessage("配置重置成功！", "success");
            this.populateForm(result.config, this.extensionScriptEditor.getValue());
          } else {
            this.showMessage("重置失败：" + result.error, "error");
          }
        } catch (error) {
          this.showMessage("重置失败：" + error.message, "error");
        }
      }
    );
  }

  getDefaultPreviewFormat() {
    return this.currentConfig?.defaultPreviewFormat || "ss";
  }

  showMessage(message, type) {
    createGlobalToast(message, type);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// 初始化订阅管理器和配置管理器
const subscriptionManager = new SubscriptionManager();
const configManager = new ConfigManager();

// 检查登录状态
async function checkAuthStatus() {
  try {
    const response = await fetch("/api/auth/status");
    if (!response.ok) {
      // 未登录或会话过期，跳转到登录页面
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("检查登录状态失败:", error);
    window.location.href = "/login";
  }
}

// 登出功能
// 登出功能
function logout() {
  openConfirmModal(
    "确认登出",
    "确定要登出吗？",
    async () => {
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
        });

        if (response.ok) {
          window.location.href = "/login";
        } else {
          createGlobalToast("登出失败，请重试", "error");
        }
      } catch (error) {
        console.error("登出失败:", error);
        // 即使登出失败，也跳转到登录页面
        window.location.href = "/login";
      }
    }
  );
}

// 定期检查会话状态（每5分钟检查一次）
setInterval(checkAuthStatus, 5 * 60 * 1000);

// 页面加载时检查一次
checkAuthStatus();

// 全局模态框控制函数
function openModal(modalId) {
  document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// 通用确认模态框函数
function openConfirmModal(title, message, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').innerHTML = message;

  const confirmBtn = document.getElementById('confirmBtn');
  // 克隆按钮以移除旧的事件监听器
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

  newBtn.addEventListener('click', () => {
    closeModal('confirmModal');
    if (onConfirm) onConfirm();
  });

  openModal('confirmModal');
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function openConfigModal() {
  configManager.loadConfig();
  openModal("configModal");
}
function openAddModal() {
  document.getElementById("addForm").reset();
  const type = document.getElementById("modal-type")?.value || "subscription";
  subscriptionManager.updateTypeUI("add", type);
  openModal("addModal");
}

function openEditModal(id, name, url, description, type) {
  document.getElementById("edit-id").value = id;
  document.getElementById("edit-name").value = name;
  document.getElementById("edit-url").value = url;
  document.getElementById("edit-description").value = description;
  const normalizedType = type === "node" ? "list" : (type || "subscription");
  document.getElementById("edit-type").value = normalizedType;
  subscriptionManager.updateTypeUI("edit", normalizedType);
  openModal("editModal");
}

// 编辑订阅表单提交处理
document
  .getElementById("editForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("edit-id").value;
    const name = document.getElementById("edit-name").value.trim();
    const url = document.getElementById("edit-url").value.trim();
    const description = document
      .getElementById("edit-description")
      .value.trim();
    const type = document.getElementById("edit-type").value;
    const normalizedType = type === "node" ? "list" : type;
    const urls = normalizedType === "list"
      ? subscriptionManager.parseNodeUrls(url)
      : [url];

    if (!url) {
      const label = normalizedType === "list" ? "节点列表" : "订阅";
      subscriptionManager.showMessage(`${label}链接不能为空`, "error");
      return;
    }

    const finalName =
      name ||
      (normalizedType === "list" ? "节点列表" : "");
    if (!finalName) {
      subscriptionManager.showMessage("请填写订阅名称", "error");
      return;
    }

    const normalizedUrl = normalizedType === "list" ? urls.join("\n") : urls[0];

    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: finalName,
          url: normalizedUrl,
          description,
          type: normalizedType,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        subscriptionManager.showMessage("订阅更新成功！", "success");
        closeModal("editModal");
        subscriptionManager.loadSubscriptions();
      } else {
        subscriptionManager.showMessage(
          "更新失败：" + result.error,
          "error"
        );
      }
    } catch (error) {
      subscriptionManager.showMessage(
        "更新失败：" + error.message,
        "error"
      );
    }
  });

// 移除点击模态框外部关闭功能，确保只能通过按钮关闭弹窗
// 这样可以避免用户在编辑时意外关闭弹窗

/* Toast Notification Logic */
function createGlobalToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Icon map
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '!'
  };

  // Safely escape HTML
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">${escapeHtml(message)}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 400); // Wait for transition
  }, 5000);
}
