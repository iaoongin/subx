# SubX 订阅管理系统

🚀 一个基于 Node.js 的轻量级订阅链接管理系统，支持订阅转换、在线管理和持久化存储。

## ✨ 功能特性

### 🔐 用户认证
- 安全的登录系统，支持浏览器密码保存
- Session 持久化存储，服务器重启后保持登录状态
- 7天会话有效期，自动清理过期会话

### 📋 订阅管理
- 在线添加、编辑、删除订阅链接
- 支持订阅状态切换（启用/禁用）
- 实时订阅数量统计
- 响应式设计，完美适配移动端

### ⚙️ 系统配置
- 可视化配置管理界面
- 支持访问令牌、文件名称等配置项
- Telegram 通知配置（可选）
- 配置热更新，无需重启服务

### 🔄 订阅转换
- 支持多种客户端格式转换（Clash、Surge、SingBox等）
- 智能客户端识别
- 批量订阅合并
- 公开API，无需登录即可使用

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
   - 默认密码: `admin123`

## 🎯 使用指南

### 登录系统

1. 访问 http://localhost:3000
2. 输入管理员密码（默认: `admin123`）
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
   - **管理员密码**: 登录系统的密码
   - **Telegram配置**: 可选的通知功能

### 订阅转换API

#### 基本用法

```
GET /{token}?参数=值
```

#### 支持的客户端

- **Clash**: 在URL中添加 `?clash=1` 或使用Clash客户端User-Agent
- **Surge**: 在URL中添加 `?surge=1` 或使用Surge客户端User-Agent  
- **SingBox**: 在URL中添加 `?sb=1` 或 `?singbox=1`
- **Quantumult X**: 在URL中添加 `?quanx=1`
- **Loon**: 在URL中添加 `?loon=1`
- **其他**: 默认返回SS格式

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
├── public/                   # 静态文件
│   ├── index.html           # 管理界面
│   └── login.html           # 登录页面
├── database.js              # 数据库管理类
├── index.js                 # 主服务器文件
├── package.json             # 项目配置
└── README.md               # 项目文档
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
    "adminPassword": "admin123"         // 管理员密码
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