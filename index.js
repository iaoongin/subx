const express = require("express");
const { Buffer } = require("buffer");
const path = require("path");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const Database = require("./database");

const app = express();
const port = process.env.PORT || 3000;
const db = new Database();

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Session 配置 - 使用文件存储实现持久化
app.use(
  session({
    store: new FileStore({
      path: path.join(__dirname, "data", "sessions"),
      ttl: 7 * 24 * 60 * 60, // 7天过期
      reapInterval: 24 * 60 * 60, // 每24小时清理过期session
      logFn: function () {}, // 禁用日志
    }),
    secret: "subx-admin-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // 在生产环境中应该设置为 true（需要HTTPS）
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    },
  })
);

// 身份验证中间件
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    return res.status(401).json({ error: "需要身份验证" });
  }
}

// 检查是否需要身份验证的中间件（排除订阅转换路由）
function checkAuthForAdmin(req, res, next) {
  // 排除登录相关路由和订阅转换路由
  const publicPaths = ["/login", "/api/auth/login", "/api/auth/status"];
  const isSubscriptionRoute =
    /^\/[^/]+$/.test(req.path) && req.path !== "/admin";

  if (publicPaths.includes(req.path) || isSubscriptionRoute) {
    return next();
  }

  // 管理相关路由需要身份验证
  if (req.path.startsWith("/admin") || req.path.startsWith("/api/")) {
    return requireAuth(req, res, next);
  }

  next();
}

// 配置变量，将从数据库动态加载
let myToken = "";
let BotToken = "";
let ChatID = "";
let TG = 0;
let FileName = "";
let SUBUpdateTime = 6;
let total = 99; // TB
let timestamp = 4102329600000;

// 初始化配置从数据库加载
async function loadConfigFromDatabase() {
  try {
    const config = await db.getConfig();
    // 默认为空，如果数据库中没有配置则使用默认值
    myToken = config.token || "";
    BotToken = config.botToken || "";
    ChatID = config.chatId || "";
    TG = config.tg !== undefined ? config.tg : 0;
    FileName = config.fileName || "";
    SUBUpdateTime =
      config.subUpdateTime !== undefined ? config.subUpdateTime : 6;
    total = config.total !== undefined ? config.total : 99;
    timestamp =
      config.timestamp !== undefined ? config.timestamp : 4102329600000;
    console.log("从数据库加载配置成功");
  } catch (error) {
    console.error("加载配置失败，使用默认值:", error.message);
  }
}

// 启动时加载配置
loadConfigFromDatabase();

// 默认订阅数据（为空，将从数据库动态获取）
let MainData = "";

// 默认服务配置（非敏感信息）
let subConverter = "subc.00321.xyz";
let subConfig =
  "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini";
let subProtocol = "https";

// 应用身份验证中间件
app.use(checkAuthForAdmin);

// =========================== API 路由 ===========================

// 身份验证API
app.post("/api/auth/login", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "请输入密码" });
    }

    const config = await db.getConfig();

    if (password === config.adminPassword) {
      req.session.authenticated = true;
      req.session.loginTime = new Date().toISOString();
      res.json({ message: "登录成功" });
    } else {
      res.status(401).json({ error: "密码错误" });
    }
  } catch (error) {
    console.error("登录失败:", error);
    res.status(500).json({ error: "服务器错误" });
  }
});

// 检查登录状态
app.get("/api/auth/status", (req, res) => {
  if (req.session && req.session.authenticated) {
    res.json({
      authenticated: true,
      loginTime: req.session.loginTime,
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// 登出
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("登出失败:", err);
      return res.status(500).json({ error: "登出失败" });
    }
    res.json({ message: "登出成功" });
  });
});

// 获取所有订阅地址
app.get("/api/subscriptions", async (req, res) => {
  try {
    const subscriptions = await db.getAllSubscriptions();
    // 实时拉取每个订阅的流量信息，接口为订阅的 url 字段
    const result = await Promise.all(
      subscriptions.map(async (sub) => {
        let userinfo = { upload: 0, download: 0, total: 0, expire: 0 };
        try {
          if (sub.url) {
            const resp = await fetch(sub.url, {
              headers: { "User-Agent": "Clash" },
            });
            if (resp.ok) {
              // 从响应头获取 subscription-userinfo
              const infoStr = resp.headers.get("subscription-userinfo");
              if (infoStr) {
                // 解析格式：upload=...; download=...; total=...; expire=...
                infoStr.split(";").forEach((pair) => {
                  const [key, value] = pair.split("=").map((s) => s.trim());
                  if (["upload", "download", "total", "expire"].includes(key)) {
                    userinfo[key] = Number(value) || 0;
                  }
                });
              }
            }
          }
        } catch (e) {
          console.error("拉取流量信息失败", sub.url, e);
        }
        return { ...sub, userinfo };
      })
    );
    res.json(result);
  } catch (error) {
    console.error("获取订阅列表失败:", error);
    res.status(500).json({ error: "获取订阅列表失败" });
  }
});

// 添加新订阅
app.post("/api/subscriptions", async (req, res) => {
  try {
    const { name, url, description } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: "订阅名称和链接不能为空" });
    }

    const result = await db.addSubscription(name, url, description || "");
    res.json({ message: "订阅添加成功", data: result });
  } catch (error) {
    console.error("添加订阅失败:", error);
    if (error.message.includes("UNIQUE constraint failed")) {
      res.status(400).json({ error: "该订阅链接已存在" });
    } else {
      res.status(500).json({ error: "添加订阅失败" });
    }
  }
});

// 更新订阅
app.put("/api/subscriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, description, active } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: "订阅名称和链接不能为空" });
    }

    const result = await db.updateSubscription(
      id,
      name,
      url,
      description || "",
      active !== undefined ? active : 1
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "订阅不存在" });
    }

    res.json({ message: "订阅更新成功" });
  } catch (error) {
    console.error("更新订阅失败:", error);
    if (error.message.includes("UNIQUE constraint failed")) {
      res.status(400).json({ error: "该订阅链接已存在" });
    } else {
      res.status(500).json({ error: "更新订阅失败" });
    }
  }
});

// 删除订阅
app.delete("/api/subscriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.deleteSubscription(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "订阅不存在" });
    }

    res.json({ message: "订阅删除成功" });
  } catch (error) {
    console.error("删除订阅失败:", error);
    res.status(500).json({ error: "删除订阅失败" });
  }
});

// 切换订阅状态
app.post("/api/subscriptions/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.toggleSubscription(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "订阅不存在" });
    }

    res.json({ message: "订阅状态更新成功" });
  } catch (error) {
    console.error("切换订阅状态失败:", error);
    res.status(500).json({ error: "切换订阅状态失败" });
  }
});

// 登录页面路由
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 管理页面路由（需要身份验证）
app.get("/admin", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 默认路由重定向到登录页面
app.get("/", (req, res) => {
  if (req.session && req.session.authenticated) {
    res.redirect("/admin");
  } else {
    res.redirect("/login");
  }
});

// =========================== 配置管理API ===========================

// 获取所有配置
app.get("/api/config", async (req, res) => {
  try {
    const config = await db.getConfig();
    res.json(config);
  } catch (error) {
    console.error("获取配置失败:", error);
    res.status(500).json({ error: "获取配置失败" });
  }
});

// 更新配置
app.put("/api/config", async (req, res) => {
  try {
    const newConfig = req.body;
    const result = await db.updateConfig(newConfig);
    res.json({ message: "配置更新成功", config: result.config });
  } catch (error) {
    console.error("更新配置失败:", error);
    res.status(500).json({ error: "更新配置失败" });
  }
});

// 获取特定配置项
app.get("/api/config/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const value = await db.getConfigValue(key);
    res.json({ key, value });
  } catch (error) {
    console.error("获取配置项失败:", error);
    res.status(500).json({ error: "获取配置项失败" });
  }
});

// 设置特定配置项
app.put("/api/config/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await db.setConfigValue(key, value);
    res.json({ message: "配置项更新成功", key, value });
  } catch (error) {
    console.error("设置配置项失败:", error);
    res.status(500).json({ error: "设置配置项失败" });
  }
});

// 重置配置为默认值
app.post("/api/config/reset", async (req, res) => {
  try {
    const result = await db.resetConfig();
    res.json({ message: "配置重置成功", config: result.config });
  } catch (error) {
    console.error("重置配置失败:", error);
    res.status(500).json({ error: "重置配置失败" });
  }
});

// =========================== 订阅转换路由 ===========================

app.get("/:path", async (req, res) => {
  try {
    const token = req.query.token || "";
    const pathToken = req.params.path;

    // 从数据库动态获取配置
    const config = await db.getConfig();

    // 使用环境变量覆盖配置数据库值
    const currentToken = process.env.TOKEN || config.token;
    const currentBotToken = process.env.TGTOKEN || config.botToken;
    const currentChatID = process.env.TGID || config.chatId;
    const currentTG = process.env.TG ? Number(process.env.TG) : config.tg;
    const currentFileName = process.env.SUBNAME || config.fileName;
    const currentSUBUpdateTime = config.subUpdateTime;

    subConverter = process.env.SUBAPI || subConverter;
    subConfig = process.env.SUBCONFIG || subConfig;

    if (token !== currentToken && pathToken !== currentToken) {
      res
        .status(403)
        .type("text/plain; charset=utf-8")
        .set("Profile-Update-Interval", currentSUBUpdateTime.toString());
      return res.send("oh no!");
    }

    if (subConverter.startsWith("http://")) {
      subConverter = subConverter.split("//")[1];
      subProtocol = "http";
    } else {
      subConverter = subConverter.split("//")[1] || subConverter;
    }

    const userAgentHeader = (req.headers["user-agent"] || "").toLowerCase();

    let 订阅格式 = "ss";
    if (
      userAgentHeader.includes("null") ||
      userAgentHeader.includes("subconverter") ||
      userAgentHeader.includes("nekobox") ||
      userAgentHeader.includes("cf-workers-sub")
    ) {
      订阅格式 = "ss";
    } else if (
      userAgentHeader.includes("clash") ||
      ("clash" in req.query && !userAgentHeader.includes("subconverter"))
    ) {
      订阅格式 = "clash";
    } else if (
      userAgentHeader.includes("sing-box") ||
      userAgentHeader.includes("singbox") ||
      (("sb" in req.query || "singbox" in req.query) &&
        !userAgentHeader.includes("subconverter"))
    ) {
      订阅格式 = "singbox";
    } else if (
      userAgentHeader.includes("surge") ||
      ("surge" in req.query && !userAgentHeader.includes("subconverter"))
    ) {
      订阅格式 = "surge";
    } else if (
      userAgentHeader.includes("quantumult%20x") ||
      ("quanx" in req.query && !userAgentHeader.includes("subconverter"))
    ) {
      订阅格式 = "quanx";
    } else if (
      userAgentHeader.includes("loon") ||
      ("loon" in req.query && !userAgentHeader.includes("subconverter"))
    ) {
      订阅格式 = "loon";
    }

    console.log("订阅格式: ", 订阅格式);

    // 从数据库获取活跃的订阅地址
    let 订阅转换URL;
    try {
      const activeUrls = await db.getActiveSubscriptionUrls();
      if (activeUrls.length === 0) {
        // 如果数据库中没有活跃订阅，使用默认数据
        console.log("数据库中没有活跃订阅，使用默认数据");
        订阅转换URL = await ADD(MainData);
      } else {
        console.log("从数据库获取到", activeUrls.length, "个活跃订阅");
        订阅转换URL = activeUrls;
      }
    } catch (dbError) {
      console.error("数据库查询失败，使用默认数据:", dbError);
      订阅转换URL = await ADD(MainData);
    }
    let 订阅转换URLs = 订阅转换URL.join("|");
    let 编码后的订阅URLs = encodeURIComponent(订阅转换URLs);

    let subContent = "";
    if (订阅格式 === "ss") {
      // 协议数组
      const 协议列表 = ["ss", "ssr", "v2ray", "trojan"];
      let 合并内容 = await fetchInBatches(协议列表, 编码后的订阅URLs);
      // 最终 Base64 编码
      subContent = base64Encode(合并内容.trim());
    } else {
      let subConverterUrl = `${subProtocol}://${subConverter}/sub?target=${订阅格式}&url=${编码后的订阅URLs}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
      const response = await fetch(subConverterUrl, {
        headers: {
          "User-Agent": "Node-fetch",
          Accept: "*/*",
        },
        redirect: "manual",
      });
      subContent = await response.text();
    }

    res.set({
      "content-type": "text/plain; charset=utf-8",
      "Profile-Update-Interval": currentSUBUpdateTime.toString(),
    });

    res.send(subContent);
  } catch (error) {
    console.error("错误:", error);
    res.status(500).send("服务器内部错误");
  }
});

async function fetchInBatches(协议列表, 编码后的订阅URLs) {
  // 构造所有请求的 Promise 数组
  const fetchPromises = 协议列表.map(async (协议) => {
    let url = `${subProtocol}://${subConverter}/sub?target=${协议}&url=${编码后的订阅URLs}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Node-fetch", Accept: "*/*" },
      });
      let text = await resp.text();
      return base64Decode(text.trim());
    } catch (err) {
      console.error("请求异常", err);
      return ""; // 出错返回空字符串，避免 Promise.all 拒绝
    }
  });

  // 等待所有请求完成
  const results = await Promise.all(fetchPromises);

  // 合并所有结果，之间用换行隔开
  return results.join("\n") + "\n";
}

async function ADD(envAdd) {
  let addText = envAdd.replace(/[\t"'|\r\n]+/g, "\n").replace(/\n+/g, "\n");
  if (addText.charAt(0) === "\n") addText = addText.slice(1);
  if (addText.charAt(addText.length - 1) === "\n")
    addText = addText.slice(0, addText.length - 1);
  const add = addText.split("\n");
  console.log("节点列表:", add);
  return add;
}

function base64Encode(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

function base64Decode(base64) {
  return Buffer.from(base64, "base64").toString("utf-8");
}

// 启动服务器
app.listen(port, "0.0.0.0", () => {
  console.log(`服务器运行在 http://0.0.0.0:${port}`);
  console.log(`管理页面访问地址: http://0.0.0.0:${port}/admin`);
  // 在服务器启动后加载配置
  loadConfigFromDatabase().catch((error) => {
    console.error("加载配置失败:", error);
  });
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n正在关闭服务器...");
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n正在关闭服务器...");
  db.close();
  process.exit(0);
});
