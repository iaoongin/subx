# 订阅分组 + 独立 Token 方案 Spec（多对多）

## 背景与目标
现有系统只有全局订阅列表与单一 `token`。本方案引入“分组（Group）”作为订阅列表上层抽象，每个分组拥有独立 `token`，通过 `/{token}` 访问该分组对应的订阅集合，实现多分组隔离。

## 目标范围（MVP）
- 新增“分组”数据结构（name + token）。
- 订阅实体独立存在，与分组为多对多关系。
- 新增“分组-订阅关联”结构（GroupSubscription）。
- 转换入口 `/token` 根据分组 token 获取订阅集合。
- 兼容旧数据：自动迁移到默认分组关联。

## 非目标
- 第一版不做分组级配置覆盖（如 conversionMode、fileName 等仍使用全局 config）。
- 不引入多租户权限/鉴权（沿用现有逻辑）。

## 数据模型

### Group
```
{
  id: number,
  name: string,
  token: string,
  created_at: string,
  updated_at: string
}
```

### Subscription
```
{
  ...
}
```

### GroupSubscription（关联表）
```
{
  groupId: number,
  subscriptionId: number
}
```

### 数据文件结构（data/config.json）
```
{
  groups: [Group],
  subscriptions: [Subscription],
  groupSubscriptions: [GroupSubscription],
  nextId: number,
  config: {...}
}
```

## 接口设计

### 分组管理
- `GET /api/groups`
- `POST /api/groups`  body: `{ name, token }`
- `PUT /api/groups/:id` body: `{ name, token }`
- `DELETE /api/groups/:id`

### 订阅管理（订阅实体）
- `GET /api/subscriptions`
- `POST /api/subscriptions` body: `{ name, url, description, type }`
- `PUT /api/subscriptions/:id` body: `{ name, url, description, type }`
- `DELETE /api/subscriptions/:id`

### 分组-订阅关联
- `GET /api/groups/:id/subscriptions`
- `POST /api/groups/:id/subscriptions` body: `{ subscriptionId }`（关联已有订阅）
- `DELETE /api/groups/:id/subscriptions/:subscriptionId`（解绑）

### 使用量查询
- `GET /api/subscriptions/usage?groupId=1`（按分组关联过滤）
- 继续支持 `ids` 参数（兼容原逻辑）

### 转换入口
- `GET /:token`
- 通过 `token` 查询分组，获取对应分组的 active subscriptions

## 迁移策略（兼容旧数据）
- 若 `groups` 不存在：
  - 创建默认分组 `default`，`token` 使用 `config.token`
  - 将所有历史订阅建立关联 `groupId = default.id`
- 保留 `config.token` 作为兜底兼容（后续可逐步弃用）

## 后端改造点

### database.js
- 新增 `groups` 与 `groupSubscriptions` 数据结构与迁移逻辑
- 新增方法：
  - `getGroups()`
  - `getGroupByToken(token)`
  - `addGroup(name, token)`
  - `updateGroup(id, name, token)`
  - `deleteGroup(id)`
  - `getSubscriptionsByGroup(groupId)`（通过关联表）
  - `attachSubscriptionToGroup(groupId, subscriptionId)`
  - `detachSubscriptionFromGroup(groupId, subscriptionId)`
- `addSubscription/updateSubscription` 不再接收 `groupId`

### routes/conversion.js
- `/ :token` 根据 token 获取分组
- 使用分组订阅集合生成订阅内容

### routes/subscriptions.js
- `GET /api/subscriptions` 不再支持 `groupId` 过滤
- `GET /api/subscriptions/usage` 支持 `groupId`（通过关联表）

## 前端改造点
- 新增分组选择器（默认“默认分组”）
- 切换分组时重载订阅列表与 usage（通过关联）
- 分组内订阅管理：
  - 绑定已有订阅
  - 新建订阅并绑定
  - 解绑订阅
- 分组管理弹窗（可选：仅 name + token）

## 注意事项
- `token` 必须唯一，否则转换入口冲突
- 删除分组前需清空其订阅关联（或强制级联删除关联）
- 订阅删除时需清理所有分组关联
- 迁移需要保证老数据零中断

## 可选扩展（下一阶段）
- 分组级配置覆盖：`fileName`、`conversionMode`、`subUpdateTime` 等
- 分组级统计与独立缓存

