# UI 布局紧凑化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 SubX 订阅工作台进行布局紧凑化优化，减少 30-50% 垂直空间占用

**Architecture:** 纯前端 CSS/HTML 重构，不涉及后端改动。通过调整圆角、内边距、字号和布局结构实现紧凑化。

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript

---

## File Structure

**修改文件：**
- `public/index.css` - 主样式文件，所有 CSS 改动
- `public/index.html` - HTML 结构调整（Hero 区域、统计卡片、侧边栏）

**不需要修改：**
- `public/index.js` - JavaScript 逻辑保持不变
- 后端文件 - 不涉及

---

### Task 1: 更新 CSS 变量

**Files:**
- Modify: `public/index.css:19-22`

- [ ] **Step 1: 更新圆角变量**

修改 `:root` 中的圆角变量：

```css
:root {
    /* 圆角 - 紧凑化 */
    --radius-xl: 16px;  /* 原 28px */
    --radius-lg: 14px;  /* 原 22px */
    --radius-md: 12px;  /* 原 16px */
    --radius-sm: 10px;  /* 原 12px */
    /* ... 其他变量保持不变 */
}
```

- [ ] **Step 2: 验证变量生效**

打开浏览器访问 `http://localhost:3000`，检查：
- 所有使用 `var(--radius-*)` 的元素圆角是否变小
- 整体布局是否更紧凑

- [ ] **Step 3: Commit**

```bash
git add public/index.css
git commit -m "style: 更新 CSS 圆角变量，整体缩小 30-40%"
```

---

### Task 2: 重构 Hero 区域 HTML 结构

**Files:**
- Modify: `public/index.html:13-29`

- [ ] **Step 1: 修改 Hero HTML 结构**

将现有的 Hero 区域从：
```html
<header class="hero-panel">
  <div class="hero-copy">
    <h1>SubX 订阅工作台</h1>
    <p>轻松管理您的订阅链接，支持实时添加、编辑和删除</p>
  </div>
  <div class="hero-actions">
    <!-- 按钮 -->
  </div>
</header>
```

改为：
```html
<header class="hero-panel">
  <div class="hero-copy">
    <h1>SubX 订阅工作台</h1>
    <p>轻松管理您的订阅链接，支持实时添加、编辑和删除</p>
  </div>
  <div class="hero-right">
    <div class="hero-actions">
      <button type="button" class="hero-btn hero-btn-secondary" onclick="openGroupManageModal()">
        管理分组
      </button>
      <button type="button" class="hero-btn hero-btn-secondary" onclick="openConfigModal()">
        系统配置
      </button>
      <button type="button" class="hero-btn hero-btn-ghost" onclick="logout()">
        退出登录
      </button>
    </div>
    <div class="hero-stats">
      <span class="hero-stat">
        <span class="hero-stat-number" id="totalCount">0</span>
        <span class="hero-stat-label">订阅</span>
      </span>
      <span class="hero-stat">
        <span class="hero-stat-number hero-stat-active" id="activeCount">0</span>
        <span class="hero-stat-label">启用</span>
      </span>
      <span class="hero-stat">
        <span class="hero-stat-number hero-stat-inactive" id="inactiveCount">0</span>
        <span class="hero-stat-label">停用</span>
      </span>
    </div>
  </div>
</header>
```

- [ ] **Step 2: 验证 HTML 结构**

刷新页面，检查：
- Hero 区域显示是否正常（此时样式可能错乱，下一步会修复）
- 统计数字元素是否正确渲染

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "refactor: 重构 Hero 区域 HTML，整合统计信息"
```

---

### Task 3: 移除独立统计卡片

**Files:**
- Modify: `public/index.html:31-47`

- [ ] **Step 1: 删除统计卡片 HTML**

删除整个 `<section class="stats">` 区块：
```html
<!-- 删除这部分 -->
<section class="stats">
  <article class="stat-card">
    <span class="stat-kicker">当前分组</span>
    <div class="stat-number" id="totalCount">0</div>
    <div class="stat-label">订阅总数</div>
  </article>
  <!-- ... 其他两个 stat-card -->
</section>
```

- [ ] **Step 2: 验证统计卡片已移除**

刷新页面，检查：
- 顶部不再显示三个独立的统计卡片
- 约 80-100px 垂直空间被释放

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "refactor: 移除独立统计卡片，已整合到 Hero 区域"
```

---

### Task 4: 优化 Hero 区域 CSS（桌面端）

**Files:**
- Modify: `public/index.css:96-206`

- [ ] **Step 1: 更新 .hero-panel 样式**

```css
.hero-panel {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 24px;
    padding: 18px 20px;  /* 原 24px */
    margin-bottom: 18px;
    border-radius: var(--radius-xl);  /* 使用变量 */
    background: linear-gradient(135deg, #2a1810 0%, #5f2f0e 50%, #cb5c2f 100%);
    color: #fff4ea;
    box-shadow: var(--shadow-lg);
    position: relative;
}

/* 移除装饰圆形 */
/* 删除 .hero-panel::after 规则 */
```

- [ ] **Step 2: 更新 .hero-copy 样式**

```css
.hero-copy {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.hero-copy h1 {
    font-size: 22px;  /* 原 clamp(2.2rem, 4vw, 3.6rem) */
    line-height: 1.2;
    margin-bottom: 6px;
    font-weight: 700;
}

.hero-copy p {
    max-width: 560px;
    color: rgba(255, 244, 234, 0.6);  /* 原 0.86 */
    line-height: 1.4;
    font-size: 13px;  /* 原 1rem */
}
```

- [ ] **Step 3: 添加 .hero-right 样式**

```css
.hero-right {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    flex-shrink: 0;
}
```

- [ ] **Step 4: 更新 .hero-actions 样式**

```css
.hero-actions {
    display: flex;
    gap: 6px;  /* 原 8px */
}
```

- [ ] **Step 5: 更新 .hero-btn 样式**

```css
.hero-btn {
    padding: 8px 14px;  /* 原 10px 14px */
    font-weight: 600;
    border-radius: 12px;  /* 原 999px */
    font-size: 13px;
}
```

- [ ] **Step 6: 添加统计数字样式**

```css
.hero-stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
}

.hero-stat {
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.hero-stat-number {
    font-weight: 700;
    font-size: 16px;
    color: #fff4ea;
}

.hero-stat-active {
    color: #81c784;
}

.hero-stat-inactive {
    color: #ef9a9a;
}

.hero-stat-label {
    color: rgba(255, 244, 234, 0.5);
}
```

- [ ] **Step 7: 验证桌面端 Hero**

在浏览器中检查（宽度 > 768px）：
- 标题在左侧，按钮和统计在右侧
- 按钮在右上，统计在右下
- 圆角、字号、间距符合设计

- [ ] **Step 8: Commit**

```bash
git add public/index.css
git commit -m "style: 优化 Hero 区域桌面端布局和样式"
```

---

### Task 5: 添加 Hero 区域移动端样式

**Files:**
- Modify: `public/index.css` (添加新的媒体查询)

- [ ] **Step 1: 添加 768px 断点的 Hero 样式**

在现有媒体查询后添加（或修改现有的 980px 断点）：

```css
@media (max-width: 768px) {
    .hero-panel {
        flex-direction: column;
        align-items: flex-start;
    }

    .hero-right {
        width: 100%;
        align-items: flex-start;
    }

    .hero-actions {
        flex-wrap: wrap;
    }

    .hero-stats {
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.15);
        width: 100%;
    }
}
```

- [ ] **Step 2: 验证移动端 Hero**

调整浏览器窗口到 < 768px 宽度，检查：
- 布局改为竖向排列
- 标题 → 按钮 → 统计，从上到下
- 按钮换行显示

- [ ] **Step 3: Commit**

```bash
git add public/index.css
git commit -m "style: 添加 Hero 区域移动端响应式布局"
```

---

### Task 6: 优化订阅卡片 HTML 结构

**Files:**
- Modify: `public/index.js:738-818` (renderSubscription 方法)

- [ ] **Step 1: 重构订阅卡片 HTML**

修改 `renderSubscription` 方法中的 HTML 模板：

```javascript
return `
  <article class="subscription-item ${subscription.active ? "" : "inactive"}">
    <!-- 标题行：名称+类型（左）| 状态（右） -->
    <div class="subscription-header">
      <div class="subscription-title">
        <span class="subscription-name">${escapeHtml(subscription.name)}</span>
        <span class="subscription-type">${typeLabel}</span>
      </div>
      <span class="subscription-status ${subscription.active ? "status-active" : "status-inactive"}">
        ${statusLabel}
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
      ? `<div class="subscription-footnote">节点列表不会读取流量信息</div>`
      : `
        <!-- 元数据横向排列 -->
        <div class="subscription-meta">
          <span>更新: ${escapeHtml(expireText)}</span>
          <span class="meta-separator">|</span>
          <span>流量: ${escapeHtml(usageText)}</span>
          ${usagePercent ? `<span class="meta-usage">${usagePercent}%</span>` : ''}
        </div>
      `}

    <!-- 操作按钮 -->
    <div class="subscription-actions">
      <!-- 保持现有按钮不变 -->
    </div>
  </article>
`;
```

- [ ] **Step 2: 更新元数据计算逻辑**

在 `renderSubscription` 方法开头添加：

```javascript
// 计算使用百分比
let usagePercent = '';
if (subscription.upload && subscription.download && subscription.total) {
  const used = (subscription.upload || 0) + (subscription.download || 0);
  const total = subscription.total || 1;
  usagePercent = Math.round((used / total) * 100);
}
```

- [ ] **Step 3: 验证订阅卡片**

刷新页面，检查：
- 状态标签在标题右侧
- 备注显示正常
- URL 单行显示，超长用省略号
- 元数据横向排列

- [ ] **Step 4: Commit**

```bash
git add public/index.js
git commit -m "refactor: 重构订阅卡片 HTML 结构，实现紧凑布局"
```

---

### Task 7: 优化订阅卡片 CSS

**Files:**
- Modify: `public/index.css:646-831`

- [ ] **Step 1: 更新 .subscription-item 样式**

```css
.subscription-item {
    display: flex;
    flex-direction: column;
    gap: 10px;  /* 原 12px */
    padding: 12px;  /* 原 14px */
    border-radius: 14px;  /* 原 18px */
    border: 1px solid rgba(88, 61, 27, 0.1);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 250, 243, 0.86) 100%);
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}
```

- [ ] **Step 2: 更新 .subscription-header 样式**

```css
.subscription-header {
    display: flex;
    justify-content: space-between;
    align-items: center;  /* 原 flex-start */
    gap: 12px;
}

.subscription-title {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;  /* 原 10px */
    align-items: center;
    margin-bottom: 0;  /* 原 6px */
}
```

- [ ] **Step 3: 更新 .subscription-url 样式**

```css
.subscription-url {
    display: block;
    padding: 10px;  /* 原 12px */
    border-radius: 8px;  /* 原 18px */
    border: 1px solid #eee;  /* 原虚线 */
    background: rgba(20, 122, 108, 0.05);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: #23544d;
    white-space: nowrap;  /* 新增 */
    overflow: hidden;  /* 新增 */
    text-overflow: ellipsis;  /* 新增 */
}

/* 移除 .subscription-url small 的 margin-top */
.subscription-url small {
    display: none;  /* 隐藏"点击复制"提示 */
}
```

- [ ] **Step 4: 更新 .subscription-meta 样式**

```css
.subscription-meta {
    display: flex;  /* 原 grid */
    flex-wrap: wrap;
    gap: 8px;  /* 原 10px */
    align-items: center;
    padding: 0;  /* 原 12px */
    border-radius: 0;  /* 原 18px */
    background: transparent;  /* 原 rgba(38, 25, 15, 0.03) */
    border: none;  /* 原 1px solid var(--line) */
    font-size: 12px;
    color: #999;
}

.meta-separator {
    color: #ddd;
}
```

- [ ] **Step 5: 更新按钮样式**

```css
.btn {
    min-height: 30px;  /* 原 34px */
    padding: 0 10px;  /* 原 12px */
    font-weight: 600;
    border-radius: 16px;  /* 原 999px */
    font-size: 12px;  /* 新增 */
}
```

- [ ] **Step 6: 验证订阅卡片样式**

刷新页面，检查：
- 卡片圆角、内边距更小
- URL 单行省略显示
- 元数据横向排列，无背景框
- 按钮更紧凑

- [ ] **Step 7: Commit**

```bash
git add public/index.css
git commit -m "style: 优化订阅卡片样式，实现紧凑布局"
```

---

### Task 8: 优化左侧边栏 HTML 结构

**Files:**
- Modify: `public/index.html:50-119`

- [ ] **Step 1: 修改"当前分组"区域**

```html
<section class="context-card">
  <div class="panel-heading">
    <h2>当前分组</h2>
    <!-- 移除描述文字 -->
  </div>

  <div class="field-stack">
    <select id="groupSelect" onchange="groupManager.onGroupChange(this.value)">
      <option value="">加载中...</option>
    </select>
  </div>

  <div class="group-summary">
    <div class="group-summary-header">
      <strong id="selectedGroupName">未选择分组</strong>
      <span id="selectedGroupStatus" class="status-chip">未连接</span>
    </div>

    <div class="inline-field">
      <input id="selectedGroupLink" type="text" readonly placeholder="选择分组后自动生成" />
      <button type="button" class="inline-copy-btn" data-group-required onclick="groupManager.copyGroupToken()">
        复制
      </button>
    </div>

    <div class="group-meta">
      <span id="selectedGroupToken">Token: --</span>
      <span id="selectedGroupCount">0 条订阅</span>
    </div>
  </div>

  <!-- 操作按钮改为 3 列 -->
  <div class="sidebar-actions sidebar-actions-triple">
    <button type="button" class="section-action-btn" data-group-required onclick="subscriptionManager.previewSubscription()">
      预览
    </button>
    <button type="button" class="section-action-btn section-action-btn-muted" data-group-required onclick="subscriptionManager.refreshSubscription()">
      刷新缓存
    </button>
    <button type="button" class="section-action-btn section-action-btn-muted" data-group-required onclick="subscriptionManager.refreshUsage()">
      刷新流量
    </button>
  </div>
</section>
```

- [ ] **Step 2: 修改"分组内操作"区域**

```html
<!-- 移除独立卡片，改为分割线 -->
<div class="sidebar-divider"></div>

<div class="sidebar-inline-actions">
  <h2>分组内操作</h2>
  <div class="sidebar-actions stacked">
    <button type="button" class="section-action-btn" data-group-required onclick="openAddModal()">
      新建订阅
    </button>
    <button type="button" class="section-action-btn section-action-btn-outline" data-group-required onclick="groupManager.openAttachModal()">
      绑定已有订阅
    </button>
  </div>
</div>
```

- [ ] **Step 3: 验证侧边栏结构**

刷新页面，检查：
- "当前分组"描述文字已移除
- 操作按钮改为 3 列
- "分组内操作"不再是独立卡片

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "refactor: 优化左侧边栏 HTML 结构"
```

---

### Task 9: 优化左侧边栏 CSS

**Files:**
- Modify: `public/index.css:250-532`

- [ ] **Step 1: 更新 .context-card 样式**

```css
.context-card {
    padding: 14px;  /* 原 16px */
    border-radius: var(--radius-lg);
}

.panel-heading h2 {
    font-size: 15px;  /* 原 1.1rem */
    margin-bottom: 0;  /* 原 4px */
}
```

- [ ] **Step 2: 更新 .group-summary 样式**

```css
.group-summary {
    margin-top: 10px;  /* 原 12px */
    padding: 10px;  /* 原 14px */
    border-radius: 12px;  /* 原 20px */
    background: #f9f7f4;  /* 原渐变 */
    border: 1px solid #eee;  /* 原 rgba(203, 92, 47, 0.12) */
}

.group-summary-header strong {
    font-size: 14px;  /* 原 1.1rem */
}
```

- [ ] **Step 3: 添加 3 列按钮样式**

```css
.sidebar-actions-triple {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.section-action-btn {
    min-height: 32px;  /* 原 40px */
    padding: 0 10px;  /* 原 12px */
    font-size: 12px;  /* 新增 */
    border-radius: 10px;  /* 原 999px */
}
```

- [ ] **Step 4: 添加分割线和内联操作样式**

```css
.sidebar-divider {
    height: 1px;
    background: #eee;
    margin: 12px 0;
}

.sidebar-inline-actions h2 {
    font-size: 14px;  /* 原 18px */
    font-weight: 700;
    margin-bottom: 10px;
}

.sidebar-inline-actions .section-action-btn {
    min-height: 36px;  /* 原 40px */
}
```

- [ ] **Step 5: 验证侧边栏样式**

刷新页面，检查：
- 圆角、内边距更小
- 摘要框背景简化
- 按钮 3 列显示
- 分割线分隔两个区域

- [ ] **Step 6: Commit**

```bash
git add public/index.css
git commit -m "style: 优化左侧边栏样式，实现紧凑布局"
```

---

### Task 10: 优化工具栏 HTML 结构

**Files:**
- Modify: `public/index.html:135-154`

- [ ] **Step 1: 修改工具栏 HTML**

```html
<div class="subscriptions-toolbar">
  <input id="subscriptionSearch" type="search" placeholder="搜索订阅..." />

  <div class="toolbar-divider"></div>

  <div class="filter-chip-group">
    <button type="button" class="filter-chip is-active" data-status-filter="all">全部</button>
    <button type="button" class="filter-chip" data-status-filter="active">启用</button>
    <button type="button" class="filter-chip" data-status-filter="inactive">停用</button>
  </div>

  <div class="toolbar-divider"></div>

  <select id="subscriptionTypeFilter">
    <option value="all">全部类型</option>
    <option value="subscription">订阅链接</option>
    <option value="list">节点列表</option>
  </select>
</div>
```

- [ ] **Step 2: 验证工具栏结构**

刷新页面，检查：
- "搜索"标签已移除
- 所有元素在一行显示
- 分割线分隔不同功能区

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "refactor: 优化工具栏 HTML 结构"
```

---

### Task 11: 优化工具栏 CSS

**Files:**
- Modify: `public/index.css:578-638`

- [ ] **Step 1: 更新 .subscriptions-toolbar 样式**

```css
.subscriptions-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;  /* 原 10px */
    margin-bottom: 14px;  /* 原 16px */
    padding: 10px;  /* 原 12px */
    border-radius: 12px;  /* 原 20px */
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid #eee;
    align-items: center;
}

.subscriptions-toolbar input[type="search"] {
    flex: 1;
    min-width: 200px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid #e0e0e0;
    background: white;
    font-size: 13px;
}
```

- [ ] **Step 2: 添加分割线样式**

```css
.toolbar-divider {
    width: 1px;
    height: 28px;
    background: #e0e0e0;
}
```

- [ ] **Step 3: 更新筛选按钮样式**

```css
.filter-chip-group {
    display: flex;
    gap: 4px;  /* 原 8px */
}

.filter-chip {
    padding: 6px 10px;  /* 原 8px 12px */
    border-radius: 8px;  /* 原 999px */
    background: transparent;
    color: #999;
    font-weight: 600;
    font-size: 12px;
}

.filter-chip.is-active {
    background: rgba(203, 92, 47, 0.12);
    color: #a23d1d;
}

.subscriptions-toolbar select {
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    color: #666;
    width: auto;
}
```

- [ ] **Step 4: 移除旧的 .search-field 样式**

删除或注释掉 `.search-field` 规则（如果存在）。

- [ ] **Step 5: 添加工具栏移动端样式**

```css
@media (max-width: 768px) {
    .subscriptions-toolbar {
        flex-direction: column;
        align-items: stretch;
    }

    .toolbar-divider {
        width: 100%;
        height: 1px;
    }
}
```

- [ ] **Step 6: 验证工具栏样式**

刷新页面，检查：
- 一行排列，分割线分隔
- 按钮更紧凑
- 移动端换行显示

- [ ] **Step 7: Commit**

```bash
git add public/index.css
git commit -m "style: 优化工具栏样式，实现紧凑布局"
```

---

### Task 12: 清理废弃的统计卡片 CSS

**Files:**
- Modify: `public/index.css:208-248`

- [ ] **Step 1: 删除统计卡片相关 CSS**

删除以下 CSS 规则：
```css
/* 删除这些规则 */
.stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
}

.stat-card { ... }
.stat-kicker { ... }
.stat-number { ... }
.stat-label { ... }
```

- [ ] **Step 2: 验证无样式错误**

刷新页面，检查控制台无 CSS 错误。

- [ ] **Step 3: Commit**

```bash
git add public/index.css
git commit -m "chore: 清理废弃的统计卡片 CSS"
```

---

### Task 13: 更新订阅列表网格间距

**Files:**
- Modify: `public/index.css:640-644`

- [ ] **Step 1: 更新网格间距**

```css
#subscriptionsList {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;  /* 原 12px */
}
```

- [ ] **Step 2: 验证网格布局**

刷新页面，检查订阅列表间距更紧凑。

- [ ] **Step 3: Commit**

```bash
git add public/index.css
git commit -m "style: 缩小订阅列表网格间距"
```

---

### Task 14: 整体验证和最终调整

- [ ] **Step 1: 桌面端完整测试**

在宽度 > 1200px 的浏览器中检查：
- Hero 区域布局正确
- 统计数字显示正确
- 侧边栏紧凑
- 工具栏一行显示
- 订阅卡片紧凑
- 整体空间利用更高效

- [ ] **Step 2: 平板端测试**

在宽度 768px - 1180px 检查：
- 布局是否正常
- 响应式是否生效

- [ ] **Step 3: 移动端测试**

在宽度 < 768px 检查：
- Hero 竖向布局
- 侧边栏单列
- 订阅列表单列
- 工具栏换行

- [ ] **Step 4: 功能测试**

验证以下功能正常：
- 切换分组
- 新建/编辑/删除订阅
- 复制链接
- 筛选和搜索
- 预览订阅

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "style: UI 布局紧凑化优化完成

- Hero 区域重构，整合统计信息
- 订阅卡片紧凑化
- 左侧边栏优化
- 工具栏一行排列
- 响应式布局完善

预计节省 150-200px 垂直空间"
```

---

## Implementation Priority

**Phase 1 (P0 - 核心改动):**
1. Task 1: CSS 变量
2. Task 2-3: Hero 区域 + 移除统计卡片
3. Task 4-5: Hero 样式
4. Task 6-7: 订阅卡片

**Phase 2 (P1 - 重要改动):**
5. Task 8-9: 左侧边栏
6. Task 10-11: 工具栏

**Phase 3 (P2 - 清理):**
7. Task 12-13: 清理废弃代码
8. Task 14: 整体验证

---

## Testing Checklist

- [ ] 桌面端布局正确（> 1200px）
- [ ] 平板端布局正确（768-1180px）
- [ ] 移动端布局正确（< 768px）
- [ ] 统计数字显示正确
- [ ] 订阅卡片功能正常
- [ ] 侧边栏功能正常
- [ ] 工具栏筛选正常
- [ ] 无控制台错误
- [ ] 页面加载性能无明显下降
