const fs = require("fs");
const path = require("path");

class Database {
  constructor() {
    this.dataFile = path.join(__dirname, "data", "config.json");
    // 初始化空数据结构，实际配置将从 config.json 或默认值加载
    this.data = {
      groups: [],
      subscriptions: [],
      groupSubscriptions: [],
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
        conversionMode: "remote",
        fallbackEnabled: true,
        nativeConverterEnabled: true,
        remoteConverterUrl: "https://subc.00321.xyz",
        remoteConverterProtocol: "https",
        defaultPreviewFormat: "ss",
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
    this.migrateGroups();
    console.log("JSON数据库初始化完成");
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const jsonData = fs.readFileSync(this.dataFile, "utf8");
        this.data = JSON.parse(jsonData);
        // 配置迁移：添加新配置项的默认值
        this.migrateConfig();
        this.migrateSubscriptions();
        // console.log("从JSON文件加载数据成功");
      } else {
        console.log("JSON文件不存在，使用默认数据");
        this.createDefaultData();
      }
    } catch (error) {
      console.error("加载JSON数据失败:", error.message);
      this.createDefaultData();
    }
  }

  migrateConfig() {
    let needsSave = false;
    const defaultConversionConfig = {
      conversionMode: "remote",
      fallbackEnabled: true,
      nativeConverterEnabled: true,
      remoteConverterUrl: "https://subc.00321.xyz",
      remoteConverterProtocol: "https",
      defaultPreviewFormat: "ss",
    };

    for (const [key, defaultValue] of Object.entries(defaultConversionConfig)) {
      if (this.data.config[key] === undefined) {
        this.data.config[key] = defaultValue;
        needsSave = true;
        console.log(`配置迁移: 添加 ${key} = ${defaultValue}`);
      }
    }

    if (needsSave) {
      this.saveData();
    }
  }

  migrateSubscriptions() {
    let needsSave = false;
    if (Array.isArray(this.data.subscriptions)) {
      for (const sub of this.data.subscriptions) {
        if (sub && sub.type === "node") {
          sub.type = "list";
          needsSave = true;
        }
      }
    }
    if (needsSave) {
      this.saveData();
    }
  }

  // 分组数据迁移：若 groups 不存在，创建默认分组并关联所有订阅
  migrateGroups() {
    if (Array.isArray(this.data.groups) && this.data.groups.length > 0) {
      // 确保 groupSubscriptions 数组存在
      if (!Array.isArray(this.data.groupSubscriptions)) {
        this.data.groupSubscriptions = [];
        this.saveData();
      }
      return;
    }

    console.log("分组迁移: 创建默认分组并关联所有订阅");

    const defaultToken = this.data.config.token || "subx123";
    const now = new Date().toISOString();
    const defaultGroup = {
      id: this.data.nextId++,
      name: "默认分组",
      token: defaultToken,
      created_at: now,
      updated_at: now,
    };

    this.data.groups = [defaultGroup];
    this.data.groupSubscriptions = [];

    // 将所有现有订阅关联到默认分组
    if (Array.isArray(this.data.subscriptions)) {
      for (const sub of this.data.subscriptions) {
        this.data.groupSubscriptions.push({
          groupId: defaultGroup.id,
          subscriptionId: sub.id,
        });
      }
    }

    this.saveData();
    console.log(
      `分组迁移完成: 默认分组 id=${defaultGroup.id}, 关联 ${this.data.groupSubscriptions.length} 个订阅`
    );
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
    const now = new Date().toISOString();
    this.data = {
      groups: [
        {
          id: 1,
          name: "默认分组",
          token: "subx123",
          created_at: now,
          updated_at: now,
        },
      ],
      subscriptions: [
        {
          id: 2,
          name: "示例订阅1",
          type: "subscription",
          url: "https://example.com/api/v1/client/subscribe?token=YOUR_TOKEN_HERE",
          description: "示例订阅链接1",
          active: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: 3,
          name: "示例订阅2",
          type: "subscription",
          url: "https://example.com/api/v1/client/subscribe?token=YOUR_TOKEN_HERE_2",
          description: "示例订阅链接2",
          active: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: 4,
          name: "示例订阅3",
          type: "subscription",
          url: "https://example.com/share/example/config-id/speed.yaml",
          description: "示例订阅链接3",
          active: 1,
          created_at: now,
          updated_at: now,
        },
      ],
      groupSubscriptions: [
        { groupId: 1, subscriptionId: 2 },
        { groupId: 1, subscriptionId: 3 },
        { groupId: 1, subscriptionId: 4 },
      ],
      nextId: 5,
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
        conversionMode: "remote",
        fallbackEnabled: true,
        nativeConverterEnabled: true,
        remoteConverterUrl: "https://subc.00321.xyz",
        remoteConverterProtocol: "https",
        defaultPreviewFormat: "ss",
      },
    };
    this.saveData();
    console.log("创建默认订阅数据和配置（不包含敏感信息）");
  }

  // 获取所有活跃的订阅地址
  getActiveSubscriptions() {
    // 确保获取最新数据
    this.loadData();
    return new Promise((resolve) => {
      const activeSubscriptions = this.data.subscriptions.filter(
        (sub) => sub.active === 1
      );
      resolve(activeSubscriptions);
    });
  }

  // 获取所有订阅地址（包括非活跃的）
  getAllSubscriptions() {
    // 确保获取最新数据
    this.loadData();
    return new Promise((resolve) => {
      resolve([...this.data.subscriptions]);
    });
  }

  // 添加新的订阅地址
  addSubscription(name, url, description = "", type = "subscription") {
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
        type,
        active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      this.data.subscriptions.push(newSubscription);

      if (this.saveData()) {
        resolve({ id: newSubscription.id, name, url, description, type });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 更新订阅地址
  updateSubscription(id, name, url, description, type = "subscription", active) {
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

      const currentSub = this.data.subscriptions[index];

      this.data.subscriptions[index] = {
        ...currentSub,
        name,
        url,
        description,
        type,
        active: active !== undefined ? active : currentSub.active,
        updated_at: new Date().toISOString(),
      };

      if (this.saveData()) {
        resolve({ changes: 1 });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 删除订阅地址（同时清理所有分组关联）
  deleteSubscription(id) {
    return new Promise((resolve, reject) => {
      const index = this.data.subscriptions.findIndex((sub) => sub.id == id);
      if (index === -1) {
        resolve({ changes: 0 });
        return;
      }

      this.data.subscriptions.splice(index, 1);

      // 级联清理所有分组关联
      if (Array.isArray(this.data.groupSubscriptions)) {
        this.data.groupSubscriptions = this.data.groupSubscriptions.filter(
          (gs) => gs.subscriptionId != id
        );
      }

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
    // 确保获取最新数据
    this.loadData();
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
    // 确保获取最新数据
    this.loadData();
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
          conversionMode: "remote",
          fallbackEnabled: true,
          nativeConverterEnabled: true,
          remoteConverterUrl: "https://subc.00321.xyz",
          remoteConverterProtocol: "https",
          defaultPreviewFormat: "ss",
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

  // ========================= 分组管理方法 =========================

  // 获取所有分组
  getGroups() {
    this.loadData();
    return new Promise((resolve) => {
      resolve([...(this.data.groups || [])]);
    });
  }

  // 根据 token 获取分组
  getGroupByToken(token) {
    this.loadData();
    return new Promise((resolve) => {
      const group = (this.data.groups || []).find((g) => g.token === token);
      resolve(group || null);
    });
  }

  // 添加分组
  addGroup(name, token) {
    return new Promise((resolve, reject) => {
      // token 必须唯一
      const exists = (this.data.groups || []).find((g) => g.token === token);
      if (exists) {
        reject(new Error("该 Token 已被其他分组使用"));
        return;
      }

      const now = new Date().toISOString();
      const newGroup = {
        id: this.data.nextId++,
        name,
        token,
        created_at: now,
        updated_at: now,
      };

      if (!Array.isArray(this.data.groups)) {
        this.data.groups = [];
      }
      this.data.groups.push(newGroup);

      if (this.saveData()) {
        resolve(newGroup);
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 更新分组
  updateGroup(id, name, token) {
    return new Promise((resolve, reject) => {
      const index = (this.data.groups || []).findIndex((g) => g.id == id);
      if (index === -1) {
        resolve({ changes: 0 });
        return;
      }

      // token 唯一性检查（排除自身）
      const tokenConflict = (this.data.groups || []).find(
        (g) => g.token === token && g.id != id
      );
      if (tokenConflict) {
        reject(new Error("该 Token 已被其他分组使用"));
        return;
      }

      const current = this.data.groups[index];
      this.data.groups[index] = {
        ...current,
        name,
        token,
        updated_at: new Date().toISOString(),
      };

      if (this.saveData()) {
        resolve({ changes: 1, group: this.data.groups[index] });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 删除分组（级联删除关联关系）
  deleteGroup(id) {
    return new Promise((resolve, reject) => {
      const index = (this.data.groups || []).findIndex((g) => g.id == id);
      if (index === -1) {
        resolve({ changes: 0 });
        return;
      }

      this.data.groups.splice(index, 1);

      // 级联删除该分组下的所有关联
      if (Array.isArray(this.data.groupSubscriptions)) {
        this.data.groupSubscriptions = this.data.groupSubscriptions.filter(
          (gs) => gs.groupId != id
        );
      }

      if (this.saveData()) {
        resolve({ changes: 1 });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 获取分组下的订阅列表（通过关联表）
  getSubscriptionsByGroup(groupId) {
    this.loadData();
    return new Promise((resolve) => {
      const relatedIds = (this.data.groupSubscriptions || [])
        .filter((gs) => gs.groupId == groupId)
        .map((gs) => gs.subscriptionId);

      const subscriptions = (this.data.subscriptions || []).filter((sub) =>
        relatedIds.includes(sub.id)
      );

      resolve(subscriptions);
    });
  }

  // 获取分组下活跃的订阅列表
  getActiveSubscriptionsByGroup(groupId) {
    this.loadData();
    return new Promise((resolve) => {
      const relatedIds = (this.data.groupSubscriptions || [])
        .filter((gs) => gs.groupId == groupId)
        .map((gs) => gs.subscriptionId);

      const subscriptions = (this.data.subscriptions || []).filter(
        (sub) => relatedIds.includes(sub.id) && sub.active === 1
      );

      resolve(subscriptions);
    });
  }

  // 绑定订阅到分组
  attachSubscriptionToGroup(groupId, subscriptionId) {
    return new Promise((resolve, reject) => {
      // 验证分组和订阅存在
      const groupExists = (this.data.groups || []).some((g) => g.id == groupId);
      if (!groupExists) {
        reject(new Error("分组不存在"));
        return;
      }
      const subExists = (this.data.subscriptions || []).some(
        (s) => s.id == subscriptionId
      );
      if (!subExists) {
        reject(new Error("订阅不存在"));
        return;
      }

      // 检查关联是否已存在
      if (!Array.isArray(this.data.groupSubscriptions)) {
        this.data.groupSubscriptions = [];
      }
      const exists = this.data.groupSubscriptions.some(
        (gs) => gs.groupId == groupId && gs.subscriptionId == subscriptionId
      );
      if (exists) {
        reject(new Error("该订阅已关联到此分组"));
        return;
      }

      this.data.groupSubscriptions.push({
        groupId: Number(groupId),
        subscriptionId: Number(subscriptionId),
      });

      if (this.saveData()) {
        resolve({ success: true });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  // 从分组中解绑订阅
  detachSubscriptionFromGroup(groupId, subscriptionId) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(this.data.groupSubscriptions)) {
        resolve({ changes: 0 });
        return;
      }

      const before = this.data.groupSubscriptions.length;
      this.data.groupSubscriptions = this.data.groupSubscriptions.filter(
        (gs) => !(gs.groupId == groupId && gs.subscriptionId == subscriptionId)
      );
      const after = this.data.groupSubscriptions.length;

      if (before === after) {
        resolve({ changes: 0 });
        return;
      }

      if (this.saveData()) {
        resolve({ changes: 1 });
      } else {
        reject(new Error("保存数据失败"));
      }
    });
  }

  close() {
    // JSON存储不需要关闭连接
    console.log("JSON数据库已关闭");
  }
}

module.exports = Database;
