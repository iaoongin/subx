let loadingRequestCount = 0;
const THEME_STORAGE_KEY = "subx-theme";
const SELECTED_GROUP_QUERY_KEY = "group";
const STATUS_FILTER_QUERY_KEY = "status";
const TYPE_FILTER_QUERY_KEY = "type";
const SEARCH_QUERY_KEY = "search";

const DEFAULT_EXTENSION_SCRIPT = `function main(config, profileName) {
  const content = JSON.parse(JSON.stringify(config));
  return content;
}
`;

const originalFetch = window.fetch.bind(window);

window.fetch = async function wrappedFetch(resource, init = {}) {
  const finalInit = { ...init };
  const skipLoading = Boolean(finalInit.skipLoading);

  if ("skipLoading" in finalInit) {
    delete finalInit.skipLoading;
  }

  if (!skipLoading) {
    showLoading();
  }

  try {
    return await originalFetch(resource, finalInit);
  } finally {
    if (!skipLoading) {
      hideLoading();
    }
  }
};

function showLoading() {
  loadingRequestCount += 1;
  document.getElementById("loadingOverlay")?.classList.add("visible");
}

function hideLoading() {
  loadingRequestCount = Math.max(loadingRequestCount - 1, 0);
  if (loadingRequestCount === 0) {
    document.getElementById("loadingOverlay")?.classList.remove("visible");
  }
}

function normalizeType(type) {
  if (type === "node") return "list";
  return type || "subscription";
}

function normalizeStatusFilter(status) {
  return ["active", "inactive"].includes(status) ? status : "all";
}

function normalizeTypeFilter(type) {
  return ["subscription", "list"].includes(type) ? type : "all";
}

function getPageQueryParam(key) {
  try {
    return new URL(window.location.href).searchParams.get(key);
  } catch (error) {
    console.warn(`Failed to read URL parameter: ${key}`, error);
    return null;
  }
}

function setPageQueryParam(key, value) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(key, String(value));
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch (error) {
    console.warn(`Failed to save URL parameter: ${key}`, error);
  }
}

function deletePageQueryParam(key) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch (error) {
    console.warn(`Failed to clear URL parameter: ${key}`, error);
  }
}

function normalizePreviewFormat(format) {
  const normalized = String(format || "").toLowerCase();
  if (["clash", "v2ray"].includes(normalized)) return normalized;
  return "uri";
}

function getTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme, persist = false) {
  const activeTheme = theme === "light" ? "light" : "dark";
  const isDark = activeTheme === "dark";
  document.documentElement.dataset.theme = activeTheme;

  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    const targetLabel = isDark ? "切换至日间模式" : "切换至夜间模式";
    toggle.setAttribute("aria-label", targetLabel);
    toggle.setAttribute("title", targetLabel);
    toggle.setAttribute("aria-pressed", String(isDark));
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
    } catch (error) {
      console.warn("Failed to save theme preference:", error);
    }
  }
}

function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark", true);
}

function isActiveSubscription(subscription) {
  return (
    subscription.active === 1 ||
    subscription.active === true ||
    subscription.active === "1"
  );
}

function escapeHtml(text = "") {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function escapeJs(text = "") {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );
  const result = value / 1024 ** exponent;
  return `${result.toFixed(result >= 100 || exponent === 0 ? 0 : 2)} ${units[exponent]}`;
}

class CustomSelect {
  static instances = new Map();
  static openInstance = null;

  static initAll(root = document) {
    root.querySelectorAll("select").forEach((select) => {
      if (!CustomSelect.instances.has(select)) {
        const instance = new CustomSelect(select);
        CustomSelect.instances.set(select, instance);
      }
    });
  }

  static syncById(id) {
    const select = document.getElementById(id);
    if (!select) return;
    CustomSelect.instances.get(select)?.syncFromSelect();
  }

  static focusById(id) {
    const select = document.getElementById(id);
    if (!select) return;
    CustomSelect.instances.get(select)?.focus();
  }

  constructor(select) {
    this.select = select;
    this.wrapper = null;
    this.trigger = null;
    this.valueNode = null;
    this.dropdown = null;
    this.optionsContainer = null;
    this.optionButtons = [];
    this.observer = null;

    this.build();
    this.bindEvents();
    this.observe();
    this.syncFromSelect();
  }

  build() {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const valueNode = document.createElement("span");
    valueNode.className = "custom-select-value";
    trigger.appendChild(valueNode);

    const dropdown = document.createElement("div");
    dropdown.className = "custom-select-dropdown";

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "custom-select-options";
    optionsContainer.setAttribute("role", "listbox");

    dropdown.appendChild(optionsContainer);

    this.select.classList.add("native-select-hidden");
    this.select.parentNode.insertBefore(wrapper, this.select);
    wrapper.append(this.select, trigger, dropdown);

    this.wrapper = wrapper;
    this.trigger = trigger;
    this.valueNode = valueNode;
    this.dropdown = dropdown;
    this.optionsContainer = optionsContainer;
  }

  bindEvents() {
    this.trigger.addEventListener("click", () => {
      if (this.select.disabled) return;
      this.toggle();
    });

    this.trigger.addEventListener("keydown", (event) => {
      if (this.select.disabled) return;

      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        if (!this.isOpen()) {
          this.open();
        }
        this.focusSelectedOption(event.key === "ArrowUp" ? -1 : 1);
      }

      if (event.key === "Escape") {
        this.close();
      }
    });

    if (this.select.id) {
      document
        .querySelectorAll(`label[for="${this.select.id}"]`)
        .forEach((label) =>
          label.addEventListener("click", (event) => {
            event.preventDefault();
            this.focus();
          })
        );
    }
  }

  observe() {
    this.observer = new MutationObserver(() => {
      this.syncFromSelect();
    });

    this.observer.observe(this.select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
  }

  syncFromSelect() {
    const options = Array.from(this.select.options).map((option) => ({
      value: option.value,
      label: option.textContent,
      disabled: option.disabled,
      selected: option.selected,
    }));

    this.optionsContainer.innerHTML = "";
    this.optionButtons = [];

    options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "custom-select-option";
      button.textContent = option.label;
      button.dataset.value = option.value;
      button.dataset.index = String(index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", option.selected ? "true" : "false");

      if (option.selected) {
        button.classList.add("is-selected");
      }

      if (option.disabled) {
        button.disabled = true;
      }

      if (option.value === "") {
        button.classList.add("is-placeholder");
      }

      button.addEventListener("click", () => {
        if (button.disabled) return;
        this.selectValue(option.value);
      });

      button.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          this.close();
          this.focus();
          return;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          this.focusOptionByIndex(index + direction);
        }
      });

      this.optionsContainer.appendChild(button);
      this.optionButtons.push(button);
    });

    const selectedOption =
      this.select.options[this.select.selectedIndex] || this.select.options[0];
    this.valueNode.textContent = selectedOption?.textContent || "";
    this.wrapper.classList.toggle("is-disabled", this.select.disabled);
    this.trigger.disabled = this.select.disabled;
  }

  selectValue(value) {
    const previousValue = this.select.value;
    this.select.value = value;
    this.syncFromSelect();
    this.close();
    this.focus();

    if (previousValue !== value) {
      this.select.dispatchEvent(new Event("change", { bubbles: true }));
      this.select.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  focusSelectedOption(direction = 1) {
    const selectedIndex = this.select.selectedIndex >= 0 ? this.select.selectedIndex : 0;
    this.focusOptionByIndex(selectedIndex + (this.isOpen() ? 0 : direction));
  }

  focusOptionByIndex(index) {
    if (!this.optionButtons.length) return;

    const enabledButtons = this.optionButtons.filter((button) => !button.disabled);
    if (!enabledButtons.length) return;

    const currentButton =
      this.optionButtons[index] && !this.optionButtons[index].disabled
        ? this.optionButtons[index]
        : enabledButtons[Math.max(0, Math.min(enabledButtons.length - 1, index))] ||
          enabledButtons[0];

    currentButton.focus();
  }

  isOpen() {
    return this.wrapper.classList.contains("is-open");
  }

  open() {
    if (CustomSelect.openInstance && CustomSelect.openInstance !== this) {
      CustomSelect.openInstance.close();
    }

    this.wrapper.classList.add("is-open");
    this.trigger.setAttribute("aria-expanded", "true");
    CustomSelect.openInstance = this;

    if (!CustomSelect.boundOutsideHandler) {
      CustomSelect.boundOutsideHandler = true;
      document.addEventListener("click", (event) => {
        if (!CustomSelect.openInstance) return;
        if (!CustomSelect.openInstance.wrapper.contains(event.target)) {
          CustomSelect.openInstance.close();
        }
      });
    }
  }

  close() {
    this.wrapper.classList.remove("is-open");
    this.trigger.setAttribute("aria-expanded", "false");
    if (CustomSelect.openInstance === this) {
      CustomSelect.openInstance = null;
    }
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.open();
  }

  focus() {
    this.trigger.focus();
  }
}

class AceScriptEditor {
  constructor(editorId) {
    this.editor = null;
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
    if (this.editor) {
      this.editor.setValue(value || DEFAULT_EXTENSION_SCRIPT, -1);
    }
  }

  getValue() {
    if (!this.editor) {
      return DEFAULT_EXTENSION_SCRIPT;
    }
    return this.editor.getValue();
  }
}

class SubscriptionManager {
  constructor() {
    this.subscriptions = [];
    this.currentGroupId = null;
    this.currentGroupToken = null;
    this.filters = {
      search: (getPageQueryParam(SEARCH_QUERY_KEY) || "").trim().toLowerCase(),
      status: normalizeStatusFilter(getPageQueryParam(STATUS_FILTER_QUERY_KEY)),
      type: normalizeTypeFilter(getPageQueryParam(TYPE_FILTER_QUERY_KEY)),
    };
  }

  init() {
    const searchInput = document.getElementById("subscriptionSearch");
    if (searchInput) {
      searchInput.value = this.filters.search;
    }

    const typeFilter = document.getElementById("subscriptionTypeFilter");
    if (typeFilter) {
      typeFilter.value = this.filters.type;
      CustomSelect.syncById("subscriptionTypeFilter");
    }

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById("addForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.addSubscription();
    });

    document.getElementById("editForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveEditedSubscription();
    });

    document.getElementById("modal-type")?.addEventListener("change", (event) => {
      this.updateTypeUI("add", event.target.value);
    });

    document.getElementById("edit-type")?.addEventListener("change", (event) => {
      this.updateTypeUI("edit", event.target.value);
    });

    document
      .getElementById("subscriptionSearch")
      ?.addEventListener("input", (event) => {
        this.filters.search = event.target.value.trim().toLowerCase();
        this.saveSearchFilter();
        this.render();
      });

    document
      .querySelectorAll("[data-status-filter]")
      .forEach((button) =>
        button.addEventListener("click", () => {
          this.filters.status = normalizeStatusFilter(button.dataset.statusFilter);
          this.saveStatusFilter();
          this.updateFilterButtons();
          this.render();
        })
      );

    document
      .getElementById("subscriptionTypeFilter")
      ?.addEventListener("change", (event) => {
        this.filters.type = normalizeTypeFilter(event.target.value);
        this.saveTypeFilter();
        this.render();
      });

    this.updateTypeUI("add", document.getElementById("modal-type")?.value || "subscription");
    this.updateTypeUI("edit", document.getElementById("edit-type")?.value || "subscription");
    this.updateFilterButtons();
  }

  setGroup(groupId, groupToken) {
    this.currentGroupId = groupId ? String(groupId) : null;
    this.currentGroupToken = groupToken || null;
  }

  clearSubscriptions() {
    this.subscriptions = [];
    this.updateStats([]);
    this.render();
  }

  hasActiveFilters() {
    return (
      Boolean(this.filters.search) ||
      this.filters.status !== "all" ||
      this.filters.type !== "all"
    );
  }

  updateFilterButtons() {
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.statusFilter === this.filters.status
      );
    });
  }

  saveStatusFilter() {
    if (this.filters.status === "all") {
      deletePageQueryParam(STATUS_FILTER_QUERY_KEY);
      return;
    }

    setPageQueryParam(STATUS_FILTER_QUERY_KEY, this.filters.status);
  }

  saveTypeFilter() {
    if (this.filters.type === "all") {
      deletePageQueryParam(TYPE_FILTER_QUERY_KEY);
      return;
    }

    setPageQueryParam(TYPE_FILTER_QUERY_KEY, this.filters.type);
  }

  saveSearchFilter() {
    if (!this.filters.search) {
      deletePageQueryParam(SEARCH_QUERY_KEY);
      return;
    }

    setPageQueryParam(SEARCH_QUERY_KEY, this.filters.search);
  }

  getFilteredSubscriptions() {
    return this.subscriptions.filter((subscription) => {
      const type = normalizeType(subscription.type);
      const haystack = [
        subscription.name,
        subscription.description,
        subscription.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !this.filters.search || haystack.includes(this.filters.search);
      const matchesStatus =
        this.filters.status === "all" ||
        (this.filters.status === "active" && Boolean(subscription.active)) ||
        (this.filters.status === "inactive" && !subscription.active);
      const matchesType =
        this.filters.type === "all" || this.filters.type === type;

      return matchesSearch && matchesStatus && matchesType;
    });
  }

  updateStats(subscriptions) {
    const total = subscriptions.length;
    const active = subscriptions.filter((item) => item.active).length;
    const inactive = total - active;

    document.getElementById("totalCount").textContent = String(total);
    document.getElementById("activeCount").textContent = String(active);
    document.getElementById("inactiveCount").textContent = String(inactive);
  }

  render() {
    const filtered = this.getFilteredSubscriptions();

    document.getElementById("filteredCount").textContent = String(filtered.length);
    document.getElementById("visibleTotalCount").textContent = String(this.subscriptions.length);

    this.renderSubscriptions(filtered);

    if (typeof groupManager !== "undefined") {
      groupManager.renderCurrentGroupSummary(this.subscriptions.length);
    }
  }

  previewSubscription() {
    if (!this.currentGroupToken) {
      this.showMessage("请先选择一个分组。", "error");
      return;
    }

    const format = configManager.getDefaultPreviewFormat();
    window.open(this.buildPreviewUrl(this.currentGroupToken, format), "_blank");
  }

  buildPreviewUrl(token, format) {
    const normalized = normalizePreviewFormat(format);
    const basePath = `/${token}`;
    if (normalized === "clash") return `${basePath}?clash=1`;
    if (normalized === "v2ray") return `${basePath}?v2ray=1`;
    return `${basePath}?uri=1`;
  }

  refreshSubscription() {
    if (!this.currentGroupToken) {
      this.showMessage("请先选择一个分组。", "error");
      return;
    }

    openConfirmModal(
      "刷新缓存",
      "这会强制重新拉取当前分组下的订阅内容，可能需要几秒钟。",
      async () => {
        try {
          const response = await fetch(`/${this.currentGroupToken}?refresh=true`);
          if (!response.ok) {
            throw new Error(`状态码 ${response.status}`);
          }
          this.showMessage("订阅缓存已刷新。", "success");
        } catch (error) {
          this.showMessage(`刷新失败：${error.message}`, "error");
        }
      }
    );
  }

  async loadSubscriptions() {
    if (!this.currentGroupId) {
      this.clearSubscriptions();
      return;
    }

    try {
      const response = await fetch(`/api/groups/${this.currentGroupId}/subscriptions`);
      if (!response.ok) {
        throw new Error("获取当前分组订阅失败");
      }

      const data = await response.json();
      this.subscriptions = (data || []).map((subscription) => {
        const type = normalizeType(subscription.type);
        const active = isActiveSubscription(subscription);
        if (type === "list") {
          return { ...subscription, type, nodeCount: this.parseNodeUrls(subscription.url || "").length };
        }

        if (!active) {
          return {
            ...subscription,
            type,
            userinfo: {},
            _usageMeta: { skipped: "inactive" },
          };
        }

        if (subscription.userinfo && typeof subscription.userinfo === "object") {
          return { ...subscription, type };
        }

        return {
          ...subscription,
          type,
          userinfo: { pending: true },
        };
      });

      this.updateStats(this.subscriptions);
      this.render();

      this.loadUsage().catch((error) => {
        console.error("Failed to load usage:", error);
        this.markUsageLoadFailed(error);
      });
      this.loadNodeCounts().catch((error) => {
        console.error("Failed to load node counts:", error);
        this.markNodeCountLoadFailed(error);
      });
    } catch (error) {
      console.error("Failed to load subscriptions:", error);
      this.subscriptions = [];
      document.getElementById("filteredCount").textContent = "0";
      document.getElementById("visibleTotalCount").textContent = "0";
      document.getElementById("subscriptionsList").innerHTML = this.createErrorState(
        "订阅加载失败",
        "请稍后重试，或检查当前分组和服务状态是否正常。"
      );
      this.updateStats([]);
      if (typeof groupManager !== "undefined") {
        groupManager.renderCurrentGroupSummary(0);
      }
    }
  }

  async loadUsage({ refresh = false } = {}) {
    const ids = this.subscriptions
      .filter(
        (subscription) =>
          isActiveSubscription(subscription) &&
          normalizeType(subscription.type) !== "list"
      )
      .map((subscription) => subscription.id)
      .join(",");

    if (!ids) {
      this.render();
      return;
    }

    const params = new URLSearchParams({
      ids,
      groupId: this.currentGroupId,
    });

    if (refresh) {
      params.set("refresh", "1");
    }

    const response = await fetch(`/api/subscriptions/usage?${params.toString()}`, {
      skipLoading: true,
    });

    if (!response.ok) {
      throw new Error("获取流量信息失败");
    }

    const result = await response.json();
    const usageMap = new Map((result.data || []).map((item) => [String(item.id), item]));

    this.subscriptions = this.subscriptions.map((subscription) => {
      const usage = usageMap.get(String(subscription.id));
      if (!usage) {
        if (
          isActiveSubscription(subscription) &&
          normalizeType(subscription.type) !== "list" &&
          subscription.userinfo?.pending === true
        ) {
          return {
            ...subscription,
            userinfo: {},
            _usageMeta: {
              error: "missing_result",
              errorReason: "未收到流量信息结果",
              fromCache: false,
            },
          };
        }
        return subscription;
      }

      return {
        ...subscription,
        userinfo: usage.userinfo || {},
        _usageMeta: {
          isStale: Boolean(usage.isStale),
          updatedAt: usage.updatedAt || 0,
          error: usage.error || null,
          errorReason: usage.errorReason || null,
          fromCache: Boolean(usage.fromCache),
          skipped: usage.skipReason || null,
        },
      };
    });

    this.render();
  }

  markUsageLoadFailed(error) {
    const reason = error?.message || "获取流量信息失败";
    this.subscriptions = this.subscriptions.map((subscription) => {
      if (
        isActiveSubscription(subscription) &&
        normalizeType(subscription.type) !== "list" &&
        subscription.userinfo?.pending === true
      ) {
        return {
          ...subscription,
          userinfo: {},
          _usageMeta: { error: "fetch_failed", errorReason: reason, fromCache: false },
        };
      }
      return subscription;
    });
    this.render();
  }

  async loadNodeCounts() {
    const ids = this.subscriptions
      .filter(
        (subscription) =>
          isActiveSubscription(subscription) &&
          normalizeType(subscription.type) !== "list"
      )
      .map((subscription) => subscription.id)
      .join(",");

    if (!ids) return;

    const params = new URLSearchParams({ ids, groupId: this.currentGroupId });
    const response = await fetch(`/api/subscriptions/node-counts?${params.toString()}`, {
      skipLoading: true,
    });
    if (!response.ok) throw new Error("获取节点数量失败");

    const result = await response.json();
    const counts = new Map((result.data || []).map((item) => [String(item.id), item]));
    this.subscriptions = this.subscriptions.map((subscription) => {
      const nodeCount = counts.get(String(subscription.id));
      if (!isActiveSubscription(subscription) || normalizeType(subscription.type) === "list") {
        return subscription;
      }
      return nodeCount
        ? {
            ...subscription,
            nodeCount: nodeCount.count,
            _nodeCountError: nodeCount.error || null,
            _nodeCountErrorReason: nodeCount.errorReason || null,
          }
        : {
            ...subscription,
            nodeCount: null,
            _nodeCountError: "missing_result",
            _nodeCountErrorReason: "未收到节点数量结果",
          };
    });
    this.render();
  }

  markNodeCountLoadFailed(error) {
    const reason = error?.message || "获取节点数量失败";
    this.subscriptions = this.subscriptions.map((subscription) => {
      if (
        isActiveSubscription(subscription) &&
        normalizeType(subscription.type) !== "list" &&
        subscription.nodeCount === undefined
      ) {
        return {
          ...subscription,
          nodeCount: null,
          _nodeCountError: "fetch_failed",
          _nodeCountErrorReason: reason,
        };
      }
      return subscription;
    });
    this.render();
  }

  async refreshUsage() {
    if (!this.currentGroupId) {
      this.showMessage("请先选择一个分组。", "error");
      return;
    }

    try {
      await this.loadUsage({ refresh: true });
      this.showMessage("流量信息已刷新。", "success");
    } catch (error) {
      console.error("Failed to refresh usage:", error);
      this.showMessage(`刷新失败：${error.message}`, "error");
    }
  }

  renderSubscriptions(subscriptions) {
    const container = document.getElementById("subscriptionsList");

    if (!this.currentGroupId) {
      container.innerHTML = this.createEmptyState(
        "还没有选中分组",
        groupManager?.hasGroups()
          ? "先从左侧选择一个分组，再查看或管理其中的订阅。"
          : "当前没有任何分组，先创建分组，再开始整理订阅。",
        groupManager?.hasGroups() ? "去选分组" : "新建分组",
        groupManager?.hasGroups() ? "focusGroupSelect()" : "openGroupManageModal()"
      );
      return;
    }

    if (this.subscriptions.length === 0) {
      container.innerHTML = this.createEmptyState(
        "这个分组还是空的",
        "可以直接新建订阅，或者把已有订阅绑定到当前分组。",
        "新建订阅",
        "openAddModal()"
      );
      return;
    }

    if (subscriptions.length === 0) {
      container.innerHTML = this.createEmptyState(
        "没有匹配结果",
        "当前筛选条件下没有找到订阅，可以清空搜索词或切换筛选条件。",
        "清空筛选",
        "subscriptionManager.resetFilters()"
      );
      return;
    }

    container.innerHTML = subscriptions.map((subscription) => this.renderSubscriptionCard(subscription)).join("");
  }

  renderSubscriptionCard(subscription) {
    const type = normalizeType(subscription.type);
    const isList = type === "list";
    const isActive = isActiveSubscription(subscription);
    const typeLabel = isList ? "节点列表" : "订阅链接";
    const statusLabel = isActive ? "启用中" : "已停用";
    const userinfo = subscription.userinfo || {};
    const usageMeta = subscription._usageMeta || {};
    const usagePending = !isList && userinfo.pending === true;
    const usageSkipped = !isActive || usageMeta.skipped === "inactive";
    const usageFailed = Boolean(usageMeta.error);
    const nodeCountFailed = Boolean(subscription._nodeCountError);
    const nodeCountText = isList
      ? String(subscription.nodeCount ?? 0)
      : !isActive
        ? "未读取"
        : subscription.nodeCount === undefined
          ? "读取中..."
          : nodeCountFailed
            ? `读取失败：${subscription._nodeCountErrorReason || "未知错误"}`
            : String(subscription.nodeCount);
    const isExhausted =
      !isList &&
      isActive &&
      !usagePending &&
      !usageFailed &&
      this.isUsageExhausted(userinfo);
    const isFiltered = isExhausted && this.isExhaustedFilteringEnabled();
    const usageText = usagePending
      ? "流量读取中..."
      : usageFailed && !usageMeta.fromCache
        ? "读取失败"
        : `${formatBytes((userinfo.upload || 0) + (userinfo.download || 0))} / ${formatBytes(userinfo.total || 0)}`;
    const expireText = usagePending || (usageFailed && !usageMeta.fromCache)
      ? "--"
      : this.formatExpireDate(userinfo.expire);
    const usageNotice = usageSkipped
      ? "订阅已停用，不读取流量信息"
      : usageFailed
        ? `流量读取失败：${usageMeta.errorReason || "未知错误"}${usageMeta.fromCache ? "（当前显示缓存数据）" : ""}`
        : "";
    const urlPreview = isList
      ? `节点列表 · ${this.parseNodeUrls(subscription.url || "").length} 条`
      : this.getDomain(subscription.url);

    return `
      <article class="subscription-item ${isActive ? "" : "inactive"}">
        <!-- 标题行：名称+类型（左）| 状态（右） -->
        <div class="subscription-header">
          <div class="subscription-title">
            <span class="subscription-name">${escapeHtml(subscription.name)}</span>
            <span class="subscription-type">${typeLabel}</span>
          </div>
          <span class="subscription-status ${isFiltered ? "status-exhausted" : isActive ? "status-active" : "status-inactive"}">
            ${isFiltered ? "已用尽" : statusLabel}
          </span>
        </div>

        <!-- 备注（保留） -->
        ${subscription.description
          ? `<p class="subscription-description">${escapeHtml(subscription.description)}</p>`
          : ""}

        <!-- URL 单行显示 -->
        <button
          type="button"
          class="subscription-url"
          title="${escapeHtml(subscription.url)}"
          onclick="subscriptionManager.copyToClipboard('${escapeJs(subscription.url)}')"
        >
          <span class="subscription-url-text">${escapeHtml(urlPreview)}</span>
        </button>

        ${isList
          ? `<div class="subscription-footnote">节点数：${escapeHtml(nodeCountText)} · 节点列表不会读取流量信息</div>`
          : `
            <!-- 元数据横向排列 -->
            <div class="subscription-meta">
              <span>更新: ${escapeHtml(expireText)}</span>
              <span class="meta-separator">|</span>
              <span>流量: ${escapeHtml(usageText)}</span>
              <span class="meta-separator">|</span>
              <span>节点: ${escapeHtml(nodeCountText)}</span>
            </div>
            ${usageNotice ? `<div class="subscription-footnote ${usageFailed ? "usage-error" : ""}">${escapeHtml(usageNotice)}</div>` : ""}
            ${!usagePending && !usageSkipped && (!usageFailed || usageMeta.fromCache) ? this.formatUsageBar(userinfo.upload, userinfo.download, userinfo.total) : ""}
          `}

        <div class="subscription-actions">
          <button type="button" class="btn btn-primary btn-sm" onclick="subscriptionManager.copyToClipboard('${escapeJs(subscription.url)}')">
            复制
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            onclick="openEditModal(${subscription.id}, '${escapeJs(subscription.name)}', '${escapeJs(subscription.url)}', '${escapeJs(subscription.description || "")}', '${escapeJs(type)}')"
          >
            编辑
          </button>
          <button
            type="button"
            class="btn ${isActive ? "btn-warning" : "btn-success"} btn-sm"
            onclick="subscriptionManager.toggleSubscription('${escapeJs(subscription.id)}')"
          >
            ${isActive ? "停用" : "启用"}
          </button>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            onclick="subscriptionManager.deleteSubscription('${escapeJs(subscription.id)}', '${escapeJs(subscription.name)}')"
          >
            删除
          </button>
          <button
            type="button"
            class="btn btn-neutral btn-sm"
            onclick="groupManager.detachSubscription('${escapeJs(subscription.id)}', '${escapeJs(subscription.name)}')"
          >
            解绑
          </button>
        </div>
      </article>
    `;
  }

  createEmptyState(title, description, actionLabel, action) {
    const button = actionLabel && action
      ? `<button type="button" class="btn btn-primary" onclick="${action}">${escapeHtml(actionLabel)}</button>`
      : "";

    return `
      <div class="empty-state">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(description)}</p>
          ${button}
        </div>
      </div>
    `;
  }

  createErrorState(title, description) {
    return `
      <div class="error-state">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(description)}</p>
        </div>
      </div>
    `;
  }

  formatUsageBar(upload, download, total) {
    const normalizedTotal = Number(total) || 0;
    if (normalizedTotal <= 0) {
      return '<div class="usage-bar"></div>';
    }
    const normalizedUpload = Number(upload) || 0;
    const normalizedDownload = Number(download) || 0;
    const used = Math.min(normalizedUpload + normalizedDownload, normalizedTotal);
    if (used <= 0) {
      return '<div class="usage-bar"></div>';
    }
    let downloadPercentage = Math.round((normalizedDownload / normalizedTotal) * 100);
    let uploadPercentage = Math.round((normalizedUpload / normalizedTotal) * 100);
    if (downloadPercentage + uploadPercentage > 100) {
      const scale = 100 / (downloadPercentage + uploadPercentage);
      downloadPercentage = Math.round(downloadPercentage * scale);
      uploadPercentage = 100 - downloadPercentage;
    }
    return `<div class="usage-bar"><div class="usage-download" style="width:${downloadPercentage}%"></div><div class="usage-upload" style="width:${uploadPercentage}%"></div></div>`;
  }

  isUsageExhausted(userinfo) {
    const total = Number(userinfo?.total) || 0;
    const used = (Number(userinfo?.upload) || 0) + (Number(userinfo?.download) || 0);
    return total > 0 && used >= total;
  }

  isExhaustedFilteringEnabled() {
    return typeof configManager === "undefined" ||
      configManager.currentConfig?.filterExhaustedSubscriptions !== false;
  }

  formatExpireDate(expire) {
    if (!expire) {
      return "长期有效";
    }

    const date = new Date(Number(expire) * 1000);
    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toISOString().slice(0, 10);
  }

  parseNodeUrls(text = "") {
    return String(text)
      .split(/[\r\n,;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return "点击复制原始链接";
    }
  }

  updateTypeUI(mode, type) {
    const normalizedType = normalizeType(type);
    const isList = normalizedType === "list";

    const config = {
      title: isList ? "节点列表" : "订阅链接",
      namePlaceholder: isList ? "可选，默认显示为“节点列表”" : "例如：机场 A",
      urlPlaceholder: isList
        ? "trojan://...\nvmess://...\nvless://..."
        : "https://example.com/subscribe",
      helpText: isList
        ? "支持一次粘贴多条节点链接，系统会自动按换行拆分。"
        : "这里只接收一条标准订阅链接。",
      modalTitle: isList
        ? (mode === "add" ? "新建节点列表" : "编辑节点列表")
        : (mode === "add" ? "新建订阅" : "编辑订阅"),
    };

    if (mode === "add") {
      document.getElementById("addModalTitle").textContent = config.modalTitle;
      document.getElementById("modal-name-label").textContent = isList ? "名称" : "名称 *";
      document.getElementById("modal-url-label").textContent = `${config.title} *`;
      document.getElementById("modal-name").placeholder = config.namePlaceholder;
      document.getElementById("modal-name").required = !isList;
      document.getElementById("modal-url").placeholder = config.urlPlaceholder;
      document.getElementById("modal-url-help").textContent = config.helpText;
      return;
    }

    document.getElementById("editModalTitle").textContent = config.modalTitle;
    document.getElementById("edit-name-label").textContent = isList ? "名称" : "名称 *";
    document.getElementById("edit-url-label").textContent = `${config.title} *`;
    document.getElementById("edit-name").placeholder = config.namePlaceholder;
    document.getElementById("edit-name").required = !isList;
    document.getElementById("edit-url").placeholder = config.urlPlaceholder;
    document.getElementById("edit-url-help").textContent = config.helpText;
  }

  resetFilters() {
    this.filters = {
      search: "",
      status: "all",
      type: "all",
    };

    deletePageQueryParam(SEARCH_QUERY_KEY);
    deletePageQueryParam(STATUS_FILTER_QUERY_KEY);
    deletePageQueryParam(TYPE_FILTER_QUERY_KEY);

    document.getElementById("subscriptionSearch").value = "";
    document.getElementById("subscriptionTypeFilter").value = "all";
    CustomSelect.syncById("subscriptionTypeFilter");
    this.updateFilterButtons();
    this.render();
  }

  buildPayload(prefix) {
    const type = normalizeType(document.getElementById(`${prefix}-type`).value);
    const nameInput = document.getElementById(`${prefix}-name`);
    const urlInput = document.getElementById(`${prefix}-url`);
    const descriptionInput = document.getElementById(`${prefix}-description`);

    const rawUrl = urlInput.value.trim();
    const urls = type === "list" ? this.parseNodeUrls(rawUrl) : [rawUrl];
    const finalUrl = type === "list" ? urls.join("\n") : urls[0];
    const finalName = nameInput.value.trim() || (type === "list" ? "节点列表" : "");

    return {
      type,
      finalName,
      finalUrl,
      description: descriptionInput.value.trim(),
      urls,
    };
  }

  validatePayload({ type, finalName, urls, finalUrl }) {
    if (!finalUrl) {
      this.showMessage(type === "list" ? "请粘贴至少一条节点链接。" : "请填写订阅链接。", "error");
      return false;
    }

    if (type === "list" && urls.length === 0) {
      this.showMessage("节点列表不能为空。", "error");
      return false;
    }

    if (type !== "list" && !finalName) {
      this.showMessage("请填写订阅名称。", "error");
      return false;
    }

    return true;
  }

  async addSubscription() {
    if (!this.currentGroupId) {
      this.showMessage("请先选择一个分组，再新增订阅。", "error");
      return;
    }

    const payload = this.buildPayload("modal");

    if (!this.validatePayload(payload)) {
      return;
    }

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: payload.finalName,
          url: payload.finalUrl,
          description: payload.description,
          type: payload.type,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "新增订阅失败");
      }

      const attachResponse = await fetch(`/api/groups/${this.currentGroupId}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: result.data.id }),
      });

      const attachResult = await attachResponse.json();
      if (!attachResponse.ok) {
        throw new Error(attachResult.error || "订阅创建成功，但绑定分组失败");
      }

      document.getElementById("addForm").reset();
      this.updateTypeUI("add", "subscription");
      closeModal("addModal");
      this.showMessage("订阅已创建并绑定到当前分组。", "success");
      await this.loadSubscriptions();
    } catch (error) {
      this.showMessage(`新增失败：${error.message}`, "error");
    }
  }

  async saveEditedSubscription() {
    const id = document.getElementById("edit-id").value;
    const payload = this.buildPayload("edit");

    if (!this.validatePayload(payload)) {
      return;
    }

    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: payload.finalName,
          url: payload.finalUrl,
          description: payload.description,
          type: payload.type,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "更新订阅失败");
      }

      closeModal("editModal");
      this.showMessage("订阅修改已保存。", "success");
      await this.loadSubscriptions();
    } catch (error) {
      this.showMessage(`更新失败：${error.message}`, "error");
    }
  }

  async toggleSubscription(id) {
    try {
      const response = await fetch(`/api/subscriptions/${id}/toggle`, {
        method: "POST",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "切换状态失败");
      }

      this.showMessage("订阅状态已更新。", "success");
      await this.loadSubscriptions();
    } catch (error) {
      this.showMessage(`操作失败：${error.message}`, "error");
    }
  }

  deleteSubscription(id, name) {
    openConfirmModal(
      "删除订阅",
      `确定要删除「${escapeHtml(name)}」吗？删除后无法恢复。`,
      async () => {
        try {
          const response = await fetch(`/api/subscriptions/${id}`, {
            method: "DELETE",
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || "删除失败");
          }

          this.showMessage("订阅已删除。", "success");
          await this.loadSubscriptions();
        } catch (error) {
          this.showMessage(`删除失败：${error.message}`, "error");
        }
      }
    );
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showMessage("已复制到剪贴板。", "success");
    } catch (error) {
      console.error("Copy failed:", error);
      this.showMessage("复制失败，请手动复制。", "error");
    }
  }

  showMessage(message, type = "info") {
    createGlobalToast(message, type);
  }
}

class ConfigManager {
  constructor() {
    this.extensionScriptEditor = new AceScriptEditor("modal-extensionScriptEditor");
    this.currentConfig = null;
  }

  init() {
    this.bindEvents();
    this.loadConfig().catch((error) => {
      console.error("Failed to initialize config:", error);
    });
  }

  bindEvents() {
    document.getElementById("configForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
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
        throw new Error("读取系统配置失败");
      }

      if (!scriptResponse.ok) {
        throw new Error("读取扩展脚本失败");
      }

      const config = await configResponse.json();
      const scriptResult = await scriptResponse.json();
      this.populateForm(config, scriptResult.script);
    } catch (error) {
      this.showMessage(`加载配置失败：${error.message}`, "error");
    }
  }

  populateForm(config, extensionScript = DEFAULT_EXTENSION_SCRIPT) {
    document.getElementById("modal-token").value = config.token || "";
    document.getElementById("modal-fileName").value = config.fileName || "";
    document.getElementById("modal-defaultPreviewFormat").value =
      normalizePreviewFormat(config.defaultPreviewFormat);
    CustomSelect.syncById("modal-defaultPreviewFormat");
    document.getElementById("modal-subUpdateTime").value = config.subUpdateTime || 6;
    document.getElementById("modal-total").value = config.total ?? 0;
    document.getElementById("modal-filterExhaustedSubscriptions").value =
      config.filterExhaustedSubscriptions !== false ? "true" : "false";
    CustomSelect.syncById("modal-filterExhaustedSubscriptions");
    document.getElementById("modal-botToken").value = config.botToken || "";
    document.getElementById("modal-chatId").value = config.chatId || "";
    document.getElementById("modal-adminPassword").value = config.adminPassword || "";

    this.extensionScriptEditor.setValue(extensionScript || DEFAULT_EXTENSION_SCRIPT);
    this.currentConfig = {
      ...config,
      defaultPreviewFormat: normalizePreviewFormat(config.defaultPreviewFormat),
    };
    if (typeof subscriptionManager !== "undefined") {
      subscriptionManager.render();
    }
  }

  async saveConfig() {
    const config = {
      token: document.getElementById("modal-token").value.trim(),
      fileName: document.getElementById("modal-fileName").value.trim(),
      defaultPreviewFormat:
        normalizePreviewFormat(document.getElementById("modal-defaultPreviewFormat").value),
      subUpdateTime:
        parseInt(document.getElementById("modal-subUpdateTime").value, 10) || 6,
      total:
        document.getElementById("modal-total").value === ""
          ? 0
          : parseInt(document.getElementById("modal-total").value, 10) || 0,
      filterExhaustedSubscriptions:
        document.getElementById("modal-filterExhaustedSubscriptions").value === "true",
      botToken: document.getElementById("modal-botToken").value.trim(),
      chatId: document.getElementById("modal-chatId").value.trim(),
      adminPassword: document.getElementById("modal-adminPassword").value.trim(),
    };

    if (!config.token || !config.fileName || !config.adminPassword) {
      this.showMessage("访问 Token、文件名和管理员密码不能为空。", "error");
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

      if (!configResponse.ok || !scriptResponse.ok) {
        throw new Error(configResult.error || scriptResult.error || "保存失败");
      }

      this.currentConfig = configResult.config || config;
      subscriptionManager.render();
      closeModal("configModal");
      this.showMessage("系统配置已保存。", "success");
    } catch (error) {
      this.showMessage(`保存失败：${error.message}`, "error");
    }
  }

  resetConfig() {
    openConfirmModal(
      "恢复默认配置",
      "确定要把系统配置恢复为默认值吗？这不会覆盖当前扩展脚本。",
      async () => {
        try {
          const response = await fetch("/api/config/reset", {
            method: "POST",
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || "重置失败");
          }

          this.populateForm(result.config, this.extensionScriptEditor.getValue());
          this.showMessage("系统配置已恢复默认值。", "success");
        } catch (error) {
          this.showMessage(`重置失败：${error.message}`, "error");
        }
      }
    );
  }

  getDefaultPreviewFormat() {
    return normalizePreviewFormat(this.currentConfig?.defaultPreviewFormat);
  }

  showMessage(message, type = "info") {
    createGlobalToast(message, type);
  }
}

class GroupManager {
  constructor() {
    this.groups = [];
    this.currentGroup = null;
  }

  init() {
    this.bindEvents();
    this.loadGroups().catch((error) => {
      console.error("Failed to initialize groups:", error);
    });
  }

  bindEvents() {
    document.getElementById("groupEditForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveGroup();
    });
  }

  hasGroups() {
    return this.groups.length > 0;
  }

  async loadGroups(preferredGroupId = null) {
    try {
      const response = await fetch("/api/groups");
      if (!response.ok) {
        throw new Error("获取分组列表失败");
      }

      this.groups = await response.json();
      this.renderGroupSelect();

      if (!this.groups.length) {
        this.clearUrlGroupId();
        this.currentGroup = null;
        subscriptionManager.setGroup(null, null);
        subscriptionManager.clearSubscriptions();
        this.renderCurrentGroupSummary(0);
        this.renderGroupList();
        return;
      }

      const candidateId =
        preferredGroupId ||
        this.currentGroup?.id ||
        this.getUrlGroupId() ||
        this.groups[0]?.id;

      const nextGroup =
        this.groups.find((group) => String(group.id) === String(candidateId)) ||
        this.groups[0];

      this.renderGroupList();
      await this.onGroupChange(nextGroup.id);
    } catch (error) {
      console.error("Failed to load groups:", error);
      createGlobalToast(`加载分组失败：${error.message}`, "error");
    }
  }

  renderGroupSelect() {
    const select = document.getElementById("groupSelect");
    if (!select) {
      return;
    }

    if (!this.groups.length) {
      select.innerHTML = '<option value="">暂无分组</option>';
      select.disabled = true;
      CustomSelect.syncById("groupSelect");
      return;
    }

    select.disabled = false;
    select.innerHTML = this.groups
      .map((group) => {
        const selected =
          this.currentGroup && String(this.currentGroup.id) === String(group.id)
            ? "selected"
            : "";
        return `<option value="${group.id}" ${selected}>${escapeHtml(group.name)}</option>`;
      })
      .join("");
    CustomSelect.syncById("groupSelect");
  }

  renderCurrentGroupSummary(subscriptionCount = 0) {
    const groupName = document.getElementById("selectedGroupName");
    const groupHint = document.getElementById("selectedGroupHint");
    const groupStatus = document.getElementById("selectedGroupStatus");
    const groupLink = document.getElementById("selectedGroupLink");
    const groupToken = document.getElementById("selectedGroupToken");
    const groupCount = document.getElementById("selectedGroupCount");

    if (!this.currentGroup) {
      groupName.textContent = this.hasGroups() ? "未选择分组" : "还没有分组";
      groupHint.textContent = "";
      groupStatus.textContent = "未连接";
      groupStatus.classList.remove("is-active");
      groupLink.value = "";
      groupToken.textContent = "Token: --";
      groupCount.textContent = "0 条订阅";
      this.updateGroupActionState();
      return;
    }

    groupName.textContent = this.currentGroup.name;
    groupHint.textContent = "操作将作用于此分组";
    groupStatus.textContent = "已连接";
    groupStatus.classList.add("is-active");
    groupLink.value = this.getCurrentGroupUrl();
    groupToken.textContent = `Token: ${this.currentGroup.token}`;
    groupCount.textContent = `${subscriptionCount} 条订阅`;
    this.updateGroupActionState();
  }

  updateGroupActionState() {
    const disabled = !this.currentGroup;
    document.querySelectorAll("[data-group-required]").forEach((element) => {
      element.disabled = disabled;
    });
  }

  async onGroupChange(groupId) {
    const group = this.groups.find((item) => String(item.id) === String(groupId));
    if (!group) {
      this.clearUrlGroupId();
      this.currentGroup = null;
      subscriptionManager.setGroup(null, null);
      subscriptionManager.clearSubscriptions();
      this.renderCurrentGroupSummary(0);
      this.renderGroupList();
      return;
    }

    this.currentGroup = group;
    this.saveUrlGroupId(group.id);
    document.getElementById("groupSelect").value = String(group.id);
    CustomSelect.syncById("groupSelect");
    subscriptionManager.setGroup(group.id, group.token);
    this.renderCurrentGroupSummary(subscriptionManager.subscriptions.length);
    this.renderGroupList();
    await subscriptionManager.loadSubscriptions();
  }

  getUrlGroupId() {
    return getPageQueryParam(SELECTED_GROUP_QUERY_KEY);
  }

  saveUrlGroupId(groupId) {
    setPageQueryParam(SELECTED_GROUP_QUERY_KEY, groupId);
  }

  clearUrlGroupId() {
    deletePageQueryParam(SELECTED_GROUP_QUERY_KEY);
  }

  getCurrentGroupUrl() {
    if (!this.currentGroup) {
      return "";
    }

    return `${window.location.origin}/${this.currentGroup.token}`;
  }

  async copyGroupToken() {
    if (!this.currentGroup) {
      createGlobalToast("请先选择一个分组。", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(this.getCurrentGroupUrl());
      createGlobalToast("分组订阅地址已复制。", "success");
    } catch (error) {
      console.error("Failed to copy group token:", error);
      createGlobalToast("复制失败，请手动复制。", "error");
    }
  }

  renderGroupList() {
    const container = document.getElementById("groupList");
    if (!container) {
      return;
    }

    if (!this.groups.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div>
            <strong>还没有分组</strong>
            <p>先建一个分组，再把订阅按用途或来源组织起来。</p>
            <button type="button" class="btn btn-primary" onclick="groupManager.openAddGroupModal()">新建分组</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.groups
      .map((group) => {
        const isCurrent =
          this.currentGroup && String(this.currentGroup.id) === String(group.id);

        return `
          <div class="group-item">
            <div class="group-item-info">
              <div class="group-item-name">
                ${escapeHtml(group.name)}
                ${isCurrent ? '<span class="status-chip is-active">当前分组</span>' : ""}
              </div>
              <div class="group-item-token">${escapeHtml(group.token)}</div>
            </div>
            <div class="group-item-actions">
              <button type="button" class="btn btn-neutral btn-sm" onclick="groupManager.onGroupChange(${group.id})">
                切换
              </button>
              <button type="button" class="btn btn-primary btn-sm" onclick="groupManager.openEditGroupModal(${group.id})">
                编辑
              </button>
              <button type="button" class="btn btn-danger btn-sm" onclick="groupManager.deleteGroup(${group.id}, '${escapeJs(group.name)}')">
                删除
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  openAddGroupModal() {
    document.getElementById("groupEdit-id").value = "";
    document.getElementById("groupEdit-name").value = "";
    document.getElementById("groupEdit-token").value = "";
    document.getElementById("groupEditTitle").textContent = "新建分组";
    openModal("groupEditModal");
  }

  openEditGroupModal(id) {
    const group = this.groups.find((item) => String(item.id) === String(id));
    if (!group) {
      return;
    }

    document.getElementById("groupEdit-id").value = group.id;
    document.getElementById("groupEdit-name").value = group.name;
    document.getElementById("groupEdit-token").value = group.token;
    document.getElementById("groupEditTitle").textContent = "编辑分组";
    openModal("groupEditModal");
  }

  generateToken() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let index = 0; index < 16; index += 1) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById("groupEdit-token").value = token;
  }

  async saveGroup() {
    const id = document.getElementById("groupEdit-id").value;
    const name = document.getElementById("groupEdit-name").value.trim();
    const token = document.getElementById("groupEdit-token").value.trim();

    if (!name || !token) {
      createGlobalToast("分组名称和 Token 不能为空。", "error");
      return;
    }

    const isEdit = Boolean(id);

    try {
      const response = await fetch(isEdit ? `/api/groups/${id}` : "/api/groups", {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, token }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "保存分组失败");
      }

      closeModal("groupEditModal");
      createGlobalToast(isEdit ? "分组已更新。" : "分组已创建。", "success");
      await this.loadGroups(isEdit ? id : result.data.id);
    } catch (error) {
      createGlobalToast(`保存失败：${error.message}`, "error");
    }
  }

  deleteGroup(id, name) {
    openConfirmModal(
      "删除分组",
      `确定要删除「${escapeHtml(name)}」吗？分组内的订阅关联会被清空，但订阅本身不会被删除。`,
      async () => {
        try {
          const response = await fetch(`/api/groups/${id}`, {
            method: "DELETE",
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || "删除分组失败");
          }

          createGlobalToast("分组已删除。", "success");

          if (this.currentGroup && String(this.currentGroup.id) === String(id)) {
            this.currentGroup = null;
          }

          await this.loadGroups();
        } catch (error) {
          createGlobalToast(`删除失败：${error.message}`, "error");
        }
      }
    );
  }

  async openAttachModal() {
    if (!this.currentGroup) {
      createGlobalToast("请先选择一个分组。", "error");
      return;
    }

    const container = document.getElementById("attachSubList");
    container.innerHTML = '<div class="loading">正在加载可绑定的订阅...</div>';
    openModal("attachSubModal");

    try {
      const [allResponse, groupResponse] = await Promise.all([
        fetch("/api/subscriptions"),
        fetch(`/api/groups/${this.currentGroup.id}/subscriptions`),
      ]);

      if (!allResponse.ok || !groupResponse.ok) {
        throw new Error("读取订阅信息失败");
      }

      const allSubscriptions = await allResponse.json();
      const currentSubscriptions = await groupResponse.json();
      const boundIds = new Set(currentSubscriptions.map((item) => Number(item.id)));
      const unboundSubscriptions = allSubscriptions.filter(
        (item) => !boundIds.has(Number(item.id))
      );

      if (!unboundSubscriptions.length) {
        container.innerHTML = `
          <div class="empty-state">
            <div>
              <strong>没有可绑定的订阅</strong>
              <p>所有订阅都已经绑定到当前分组，或者你还没有创建新的订阅。</p>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = unboundSubscriptions
        .map((subscription) => `
          <div class="attach-sub-item">
            <div class="attach-sub-info">
              <div class="attach-sub-name">${escapeHtml(subscription.name)}</div>
              <span class="attach-sub-type">${normalizeType(subscription.type) === "list" ? "节点列表" : "订阅链接"}</span>
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              onclick="groupManager.attachSubscription(${subscription.id}, '${escapeJs(subscription.name)}')"
            >
              绑定
            </button>
          </div>
        `)
        .join("");
    } catch (error) {
      container.innerHTML = `
        <div class="error-state">
          <div>
            <strong>加载失败</strong>
            <p>${escapeHtml(error.message)}</p>
          </div>
        </div>
      `;
    }
  }

  async attachSubscription(subscriptionId, name) {
    if (!this.currentGroup) {
      return;
    }

    try {
      const response = await fetch(`/api/groups/${this.currentGroup.id}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscriptionId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "绑定失败");
      }

      closeModal("attachSubModal");
      createGlobalToast(`已把「${name}」绑定到当前分组。`, "success");
      await subscriptionManager.loadSubscriptions();
    } catch (error) {
      createGlobalToast(`绑定失败：${error.message}`, "error");
    }
  }

  detachSubscription(subscriptionId, name) {
    if (!this.currentGroup) {
      return;
    }

    openConfirmModal(
      "解绑订阅",
      `确定要把「${escapeHtml(name)}」从当前分组移除吗？订阅本身仍会保留。`,
      async () => {
        try {
          const response = await fetch(
            `/api/groups/${this.currentGroup.id}/subscriptions/${subscriptionId}`,
            {
              method: "DELETE",
            }
          );

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || "解绑失败");
          }

          createGlobalToast(`已从当前分组解绑「${name}」。`, "success");
          await subscriptionManager.loadSubscriptions();
        } catch (error) {
          createGlobalToast(`解绑失败：${error.message}`, "error");
        }
      }
    );
  }
}

const subscriptionManager = new SubscriptionManager();
const configManager = new ConfigManager();
const groupManager = new GroupManager();

CustomSelect.initAll();
applyTheme(getTheme());
subscriptionManager.init();
configManager.init();
groupManager.init();

async function checkAuthStatus() {
  try {
    const response = await fetch("/api/auth/status", { skipLoading: true });
    if (!response.ok) {
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Auth check failed:", error);
    window.location.href = "/login";
  }
}

function openModal(modalId) {
  document.getElementById(modalId)?.classList.add("is-open");
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove("is-open");
}

function openConfirmModal(title, message, onConfirm) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").innerHTML = message;

  const confirmButton = document.getElementById("confirmBtn");
  const clonedButton = confirmButton.cloneNode(true);
  confirmButton.parentNode.replaceChild(clonedButton, confirmButton);

  clonedButton.addEventListener("click", async () => {
    closeModal("confirmModal");
    if (onConfirm) {
      await onConfirm();
    }
  });

  openModal("confirmModal");
}

function openConfigModal() {
  configManager.loadConfig();
  openModal("configModal");
}

function openGroupManageModal() {
  groupManager.renderGroupList();
  openModal("groupManageModal");
}

function openAddModal() {
  if (!groupManager.currentGroup) {
    createGlobalToast("请先选择一个分组。", "error");
    return;
  }

  document.getElementById("addForm").reset();
  document.getElementById("modal-type").value = "subscription";
  CustomSelect.syncById("modal-type");
  subscriptionManager.updateTypeUI("add", "subscription");
  openModal("addModal");
}

function openEditModal(id, name, url, description, type) {
  const normalizedType = normalizeType(type);
  document.getElementById("edit-id").value = id;
  document.getElementById("edit-name").value = name;
  document.getElementById("edit-url").value = url;
  document.getElementById("edit-description").value = description;
  document.getElementById("edit-type").value = normalizedType;
  CustomSelect.syncById("edit-type");
  subscriptionManager.updateTypeUI("edit", normalizedType);
  openModal("editModal");
}

function focusGroupSelect() {
  CustomSelect.focusById("groupSelect");
}

function createGlobalToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: "✓",
    error: "!",
    info: "i",
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">${escapeHtml(message)}</div>
    <button type="button" class="toast-close" aria-label="关闭">×</button>
  `;

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => {
      toast.remove();
    }, 240);
  }, 4200);
}

function logout() {
  openConfirmModal("退出登录", "确定要退出当前管理会话吗？", async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("退出失败");
      }

      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      createGlobalToast("退出失败，请重试。", "error");
    }
  });
}

window.setInterval(checkAuthStatus, 5 * 60 * 1000);
checkAuthStatus();
