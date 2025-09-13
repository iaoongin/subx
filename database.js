const fs = require("fs");
const path = require("path");

class Database {
  constructor() {
    this.dataFile = path.join(__dirname, "data", "config.json");
    // 初始化空数据结构，实际配置将从 config.json 或默认值加载
    this.data = {
      subscriptions: [],
      nextId: 1,
      config: {
        token: "",
        botToken: "",
        chatId: "",
        tg: 0,
        fileName: "",
        subUpdateTime: 6,
        total: 99,
        timestamp: 4102329600000,
        adminPassword: "",
      },
    };
    this.init();
  }

  init() {
    // 确保 data 目录存在
    const dataDir = path.dirname(this.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log("创建 data 目录");
    }

    this.loadData();
    console.log("JSON数据库初始化完成");
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const jsonData = fs.readFileSync(this.dataFile, "utf8");
        this.data = JSON.parse(jsonData);
        console.log("从JSON文件加载数据成功");
      } else {
        console.log("JSON文件不存在，使用默认数据");
        this.createDefaultData();
      }
    } catch (error) {
      console.error("加载JSON数据失败:", error.message);
      this.createDefaultData();
    }
  }

  saveData() {
    try {
      fs.writeFileSync(
        this.dataFile,
        JSON.stringify(this.data, null, 2),
        "utf8"
      );
      return true;
    } catch (error) {
      console.error("保存JSON数据失败:", error.message);
      return false;
    }
  }

  createDefaultData() {
    // 创建默认数据结构，不包含敏感信息
    this.data = {
      subscriptions: [
        {
          id: 1,
          name: "示例订阅1",
          url: "https://example.com/api/v1/client/subscribe?token=YOUR_TOKEN_HERE",
          description: "示例订阅链接1",
          active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: "示例订阅2",
          url: "https://example.com/api/v1/client/subscribe?token=YOUR_TOKEN_HERE_2",
          description: "示例订阅链接2",
          active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 3,
          name: "示例订阅3",
          url: "https://example.com/share/example/config-id/speed.yaml",
          description: "示例订阅链接3",
          active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      nextId: 4,
      config: {
        token: "subx123",
        botToken: "",
        chatId: "",
        tg: 0,
        fileName: "SubX",
        subUpdateTime: 6,
        total: 99,
        timestamp: 4102329600000,
        adminPassword: "admin123",
      },
    };
    this.saveData();
    console.log("创建默认订阅数据和配置（不包含敏感信息）");
  }

  // 获取所有活跃的订阅地址
  getActiveSubscriptions() {
    return new Promise((resolve) => {
      const activeSubscriptions = this.data.subscriptions.filter(
        (sub) => sub.active === 1
      );
      resolve(activeSubscriptions);
    });
  }

  // 获取所有订阅地址（包括非活跃的）
  getAllSubscriptions() {
    return new Promise((resolve) => {
      resolve([...this.data.subscriptions]);
    });
  }

  // 添加新的订阅地址
  addSubscription(name, url, description = "") {
    return new Promise((resolve, reject) => {
      // 检查URL是否已存在
      const exists = this.data.subscriptions.find((sub) => sub.url === url);
      if (exists) {
        reject(new Error("UNIQUE constraint failed: 该订阅链接已存在"));
        return;
      }

      const newSubscription = {
        id: this.data.nextId++,
        name,
        url,
        description,
        active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      this.data.subscriptions.push(newSubscription);

      if (this.saveData()) {
        resolve({ id: newSubscription.id, name, url, description });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 更新订阅地址
  updateSubscription(id, name, url, description, active = 1) {
    return new Promise((resolve, reject) => {
      const index = this.data.subscriptions.findIndex((sub) => sub.id == id);
      if (index === -1) {
        resolve({ changes: 0 });
        return;
      }

      // 检查URL是否与其他订阅冲突（排除自己）
      const exists = this.data.subscriptions.find(
        (sub) => sub.url === url && sub.id != id
      );
      if (exists) {
        reject(new Error("UNIQUE constraint failed: 该订阅链接已存在"));
        return;
      }

      this.data.subscriptions[index] = {
        ...this.data.subscriptions[index],
        name,
        url,
        description,
        active,
        updated_at: new Date().toISOString(),
      };

      if (this.saveData()) {
        resolve({ changes: 1 });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 删除订阅地址
  deleteSubscription(id) {
    return new Promise((resolve, reject) => {
      const index = this.data.subscriptions.findIndex((sub) => sub.id == id);
      if (index === -1) {
        resolve({ changes: 0 });
        return;
      }

      this.data.subscriptions.splice(index, 1);

      if (this.saveData()) {
        resolve({ changes: 1 });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 切换订阅地址的活跃状态
  toggleSubscription(id) {
    return new Promise((resolve, reject) => {
      const index = this.data.subscriptions.findIndex((sub) => sub.id == id);
      if (index === -1) {
        resolve({ changes: 0 });
        return;
      }

      this.data.subscriptions[index].active =
        1 - this.data.subscriptions[index].active;
      this.data.subscriptions[index].updated_at = new Date().toISOString();

      if (this.saveData()) {
        resolve({ changes: 1 });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 获取活跃订阅地址的URL列表
  getActiveSubscriptionUrls() {
    return new Promise((resolve) => {
      const activeUrls = this.data.subscriptions
        .filter((sub) => sub.active === 1)
        .map((sub) => sub.url);
      resolve(activeUrls);
    });
  }

  // ========================= 配置管理方法 =========================

  // 获取所有配置
  getConfig() {
    return new Promise((resolve) => {
      resolve({ ...this.data.config });
    });
  }

  // 更新配置
  updateConfig(newConfig) {
    return new Promise((resolve, reject) => {
      try {
        // 只更新提供的配置项，保留其他配置
        this.data.config = {
          ...this.data.config,
          ...newConfig,
        };

        if (this.saveData()) {
          resolve({ success: true, config: { ...this.data.config } });
        } else {
          reject(new Error("保存配置失败"));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // 获取特定配置项
  getConfigValue(key) {
    return new Promise((resolve) => {
      resolve(this.data.config[key]);
    });
  }

  // 设置特定配置项
  setConfigValue(key, value) {
    return new Promise((resolve, reject) => {
      try {
        this.data.config[key] = value;

        if (this.saveData()) {
          resolve({ success: true, key, value });
        } else {
          reject(new Error("保存配置失败"));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // 重置配置为默认值（不包含敏感信息）
  resetConfig() {
    return new Promise((resolve, reject) => {
      try {
        this.data.config = {
          token: "",
          botToken: "",
          chatId: "",
          tg: 0,
          fileName: "",
          subUpdateTime: 6,
          total: 99,
          timestamp: 4102329600000,
          adminPassword: "",
        };

        if (this.saveData()) {
          resolve({ success: true, config: { ...this.data.config } });
        } else {
          reject(new Error("重置配置失败"));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  close() {
    // JSON存储不需要关闭连接
    console.log("JSON数据库已关闭");
  }
}

module.exports = Database;
