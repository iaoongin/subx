# SubX 订阅管理系统

🚀 一个基于 Node.js 的轻量级订阅链接管理系统，支持订阅转换、在线管理和持久化存储。

## ✨ 功能特性

### 🔐 用户认证
- 安全的登录系统，支持浏览器密码保存
- Session 持久化存储，服务器重启后保持登录状态
- 7天会话有效期，自动清理过期会话

### 📋 订阅管理
- 在线添加、编辑、删除订阅链接
- 支持“节点列表”：可粘贴多条节点链接并统一管理
- 支持订阅状态切换（启用/禁用）
- 实时订阅数量统计
- 响应式设计，完美适配移动端

### ⚙️ 系统配置
- 可视化配置管理界面
- 支持访问令牌、文件名称等配置项
- Telegram 通知配置（可选）
- 配置热更新，无需重启服务

### 🔄 订阅转换
- 支持多种客户端格式转换（本地支持 ss/clash/v2ray，其他格式依赖远程转换）
- 智能客户端识别
- 批量订阅合并
- 公开API，无需登录即可使用
- **本地转换器**：项目内置原生解析与生成器（无需依赖 subconverter）
- **远程转换器**：支持调用远程转换 API
- **智能回退**：本地转换失败时自动切换到远程（可关闭）
- **灵活模式**：支持手动指定转换模式（native/remote）
- **SS 输出多协议**：原生模式下 SS 输出可保留多协议 URI

### 📊 日志系统
- **Winston 日志框架**：成熟稳定的企业级日志方案
- **多文件分类**：combined.log（全部）、error.log（错误）、按日期归档
- **按日期归档**：日志文件名为启动当日日期（跨日需重启才会生成新文件）
- **自动轮转**：单文件最大10MB，自动创建新文件
- **双重输出**：控制台彩色输出 + 文件持久化存储
- **详细追踪**：包含时间戳、日志级别、文件位置和行号

## 🛠️ 技术栈

- **后端**: Node.js + Express 5.1.0
- **前端**: 原生 HTML/CSS/JavaScript
- **存储**: JSON 文件持久化
- **会话**: session-file-store
- **包管理**: pnpm

## 📦 快速开始

### 环境要求

- Node.js 14.x 或更高版本
- pnpm（推荐）或 npm

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd subx
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **配置系统**
   ```bash
   # 复制配置模板
   cp data/config.template.json data/config.json
   
   # 编辑配置文件（可选）
   # 修改 data/config.json 中的相关配置
   ```

4. **启动服务**
   ```bash
   pnpm start
   ```

5. **访问系统**
   - 管理界面: http://localhost:3000/admin
   - 默认密码: 取决于 `data/config.json` 中的 `adminPassword`（模板为占位符，需自行填写）

## 🎯 使用指南

### 登录系统

1. 访问 http://localhost:3000
2. 输入管理员密码（以 `data/config.json` 的 `adminPassword` 为准）
3. 点击登录进入管理界面

### 管理订阅

1. **添加订阅**
   - 点击订阅列表右侧的"➕ 添加订阅"按钮
   - 填写订阅名称、链接和描述
   - 点击"添加订阅"保存

2. **编辑订阅**
   - 点击订阅项目的"编辑"按钮
   - 修改相关信息后保存

3. **管理状态**
   - 使用"启用/禁用"按钮控制订阅状态
   - 使用"删除"按钮移除不需要的订阅

### 系统配置

1. 点击右上角"⚙️ 系统配置"按钮
2. 修改以下配置项：
   - **访问令牌**: 用于订阅转换API的身份验证
   - **文件名称**: 订阅文件的显示名称
   - **更新间隔**: 订阅自动更新的时间间隔
   - **默认预览格式**: 预览按钮默认输出 ss 或 clash
   - **管理员密码**: 登录系统的密码
   - **Telegram配置**: 可选的通知功能

### 订阅转换API

#### 转换模式

系统支持三种转换模式：

1. **本地模式（native）**：使用内置转换器，速度快，无需外部依赖  
   - 原生输出支持：`ss` / `clash` / `v2ray`
2. **远程模式（remote）**：调用远程转换API，功能更强大  
   - 由远程服务决定支持的客户端格式（如 Surge/SingBox/QuanX/Loon 等）
3. **自动模式（默认）**：优先使用本地转换，失败后自动回退到远程（可通过 `fallbackEnabled` 关闭）

#### 基本用法

```
GET /{token}?参数=值
```

#### 模式切换

```bash
# 使用本地转换器
curl "http://localhost:3000/your-token?mode=native"

# 使用远程转换器
curl "http://localhost:3000/your-token?mode=remote"

# 自动模式（默认）
curl "http://localhost:3000/your-token"
```

#### 支持的客户端

- **Clash**: 在URL中添加 `?clash=1` 或使用Clash客户端User-Agent（native/remote 均支持）
- **SS**: 默认返回 SS 格式（native/remote 均支持）
- **Surge / SingBox / Quantumult X / Loon**: 需使用 `remote` 模式（或开启回退），由远程转换器提供支持

#### 示例

```bash
# Clash 格式
curl "http://localhost:3000/your-token?clash=1"

# SingBox 格式  
curl "http://localhost:3000/your-token?singbox=1"

# 默认格式
curl "http://localhost:3000/your-token"
```

## 📁 项目结构

```
subx/
├── data/                      # 数据目录
│   ├── config.json           # 实际配置文件（忽略提交）
│   ├── config.template.json  # 配置模板
│   └── sessions/             # 会话存储目录
├── logs/                      # 日志目录
│   ├── combined.log          # 合并日志（所有级别）
│   ├── error.log             # 错误日志
│   └── app-YYYY-MM-DD.log   # 按日期归档的日志
├── services/                  # 服务层
│   ├── cache.js              # 缓存服务
│   ├── converter.js          # 远程转换服务
│   └── native/               # 本地转换器
│       ├── index.js          # 转换器主入口
│       ├── fetcher.js        # 订阅源拉取
│       ├── merger.js         # 节点合并
│       ├── parsers/          # 节点解析器
│       └── generators/       # 格式生成器
├── routes/                    # 路由层
│   └── conversion.js         # 转换路由
├── utils/                     # 工具类
│   ├── logger.js             # 日志工具
│   └── network.js            # 网络请求
├── public/                    # 静态文件
│   ├── index.html            # 管理界面
│   └── login.html            # 登录页面
├── database.js               # 数据库管理类
├── index.js                  # 主服务器文件
├── package.json              # 项目配置
└── README.md                 # 项目文档
```

## ⚙️ 配置说明

### data/config.json

```json
{
  "subscriptions": [...],      // 订阅列表
  "nextId": 4,                // 下一个订阅ID
  "config": {
    "token": "your-api-token",           // API访问令牌
    "botToken": "telegram-bot-token",    // Telegram Bot Token
    "chatId": "telegram-chat-id",        // Telegram Chat ID
    "tg": 0,                            // Telegram功能开关
    "fileName": "订阅文件名",             // 订阅文件名称
    "subUpdateTime": 6,                 // 更新间隔（小时）
    "total": 99,                        // 总流量限制（TB）
    "timestamp": 4102329600000,         // 过期时间戳
    "adminPassword": "YOUR_ADMIN_PASSWORD_HERE", // 管理员密码
    "defaultPreviewFormat": "ss",       // 默认预览格式: ss/clash

    // 转换器配置
    "conversionMode": "native",         // 转换模式: auto/native/remote
    "fallbackEnabled": false,           // 启用自动回退
    "nativeConverterEnabled": true,     // 启用本地转换器
    "remoteConverterUrl": "https://subc.00321.xyz",  // 远程转换API
    "remoteConverterProtocol": "https"  // 远程API协议
  }
}
```

## 🚀 部署说明

### 开发环境

```bash
pnpm start
```

### 生产环境

1. **使用PM2**
   ```bash
   npm install -g pm2
   pm2 start index.js --name subx
   ```

2. **使用Docker**
   ```dockerfile
   FROM node:16-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["node", "index.js"]
   ```

3. **Nginx反向代理**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 🔧 环境变量

支持通过环境变量覆盖配置：

```bash
PORT=3000                    # 服务端口
TOKEN=your-token            # API令牌
TGTOKEN=telegram-bot-token  # Telegram Bot Token
TGID=telegram-chat-id       # Telegram Chat ID
TG=1                        # 启用Telegram通知
SUBNAME=订阅名称            # 订阅文件名称
SUBAPI=订阅转换API地址      # 自定义转换API
SUBCONFIG=配置文件URL       # 自定义配置文件
```

## 🛡️ 安全说明

1. **配置文件保护**
   - `data/config.json` 已加入 `.gitignore`
   - 包含敏感信息，请妥善保管

2. **访问控制**
   - 管理界面需要登录验证
   - 订阅转换API为公开接口
   - 定期更改管理员密码

3. **会话安全**
   - 使用httpOnly Cookie
   - 7天会话过期
   - 自动清理过期会话

## 🐛 常见问题

### Q: 忘记管理员密码怎么办？
A: 编辑 `data/config.json` 文件，修改 `config.adminPassword` 字段，然后重启服务。

### Q: 如何备份数据？
A: 备份整个 `data/` 目录即可，包含所有配置和会话信息。

### Q: 服务器重启后需要重新登录？
A: 正常情况下不需要，系统使用文件存储会话。如果仍需重新登录，请检查 `data/sessions/` 目录权限。

### Q: 如何自定义订阅转换API？
A: 设置环境变量 `SUBAPI=your-api-domain.com` 或在配置中修改 `subConverter`。

### Q: 如何查看系统日志？
A: 日志文件保存在 `logs/` 目录：
```bash
# 查看所有日志
type logs\combined.log

# 实时监控日志
powershell -Command "Get-Content logs\combined.log -Wait -Tail 30"

# 查看错误日志
type logs\error.log

# 查看今天的日志
type logs\app-2026-02-04.log
```

### Q: 本地转换器和远程转换器的区别？
A:
- **本地转换器**：速度快，无网络依赖，原生输出支持 `ss/clash/v2ray`
- **远程转换器**：功能更全面，需要网络连接，支持更多客户端格式
- **自动模式**：优先本地，失败时自动切换远程（可通过 `fallbackEnabled` 关闭）

### Q: 如何切换转换模式？
A:
1. **临时切换**：在URL中添加 `?mode=native` 或 `?mode=remote`
2. **永久切换**：修改 `data/config.json` 中的 `conversionMode` 字段

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 开源协议

本项目采用 ISC 协议开源，详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

感谢所有为此项目做出贡献的开发者！

---

**如有问题或建议，欢迎提交 Issue 或 Pull Request！** 🎉
