# 提交日志规范 Spec

## 目标

- 统一仓库提交日志格式，降低历史记录的阅读成本。
- 让功能、修复、文档、重构等改动类型一眼可辨。
- 为后续变更追踪、版本整理和发布说明提供稳定基础。

## 适用范围

- 适用于本仓库所有开发提交。
- 建议在合并前整理提交日志，保证进入主分支的提交可读。

## 格式

首行格式：

```text
type(scope): summary
```

可省略 scope：

```text
type: summary
```

允许破坏性改动标记：

```text
type(scope)!: summary
```

## 允许的 type

- `feat`：新功能
- `fix`：缺陷修复
- `refactor`：重构，不改变外部行为
- `docs`：文档更新
- `style`：样式或格式调整，不涉及业务逻辑
- `test`：测试相关改动
- `chore`：杂项维护、脚手架、非业务改动
- `perf`：性能优化
- `build`：构建或打包相关改动
- `ci`：CI/CD 配置相关改动
- `revert`：显式回滚某次改动
- `reset`：重置或恢复某个模块到既定状态

## scope 规范

- scope 可选。
- 推荐使用小写英文或短横线。
- 推荐 scope 与改动模块直接对应。

示例：

- `ui`
- `web`
- `readme`
- `subscriptions`
- `groups`
- `native`

## summary 规范

- 使用简洁中文描述本次改动结果。
- 不写“做了一些修改”这种空泛描述。
- 不以句号或感叹号结尾。
- 建议控制在 72 个字符以内。

推荐写法：

- `feat: 新增订阅分组管理`
- `fix(ui): 修复停用卡片置灰不明显的问题`
- `docs(readme): 同步后台工作台说明`

不推荐写法：

- `update`
- `fix bug`
- `修改一下页面`
- `feat: 新增后台工作台。`

## 特殊情况

以下 Git 自动生成提交允许跳过规范校验：

- `Merge ...`
- `Revert ...`

## 本仓库落地方式

### 校验脚本

- `scripts/validate-commit-msg.js`

### Git hook

- `.githooks/commit-msg`

### 安装方式

执行一次：

```bash
pnpm hooks:install
```

该命令会将仓库本地 `core.hooksPath` 指向 `.githooks`。

## 验收标准

- 新提交默认遵循 `type(scope): summary`。
- 非法提交会在 `commit-msg` hook 阶段被拦截。
- README 中必须能找到该规范的入口说明。
