/**
 * 原生订阅转换器
 * 主入口，负责协调订阅拉取、节点解析、格式生成
 */
const SubscriptionFetcher = require("./fetcher");
const NodeMerger = require("./merger");
const generators = require("./generators");

class NativeConverter {
  constructor() {
    this.fetcher = new SubscriptionFetcher();
    this.merger = new NodeMerger();
  }

  /**
   * 转换订阅
   * @param {Array<string>} subscriptionUrls - 订阅 URL 列表
   * @param {string} targetFormat - 目标格式 (ss/clash/v2ray)
   * @returns {Promise<string>} 转换后的订阅内容
   */
  async convert(subscriptionUrls, targetFormat) {
    let currentStep = "init";
    try {
      console.log(`========== 原生转换开始 ==========`);
      console.log(
        `订阅源数量: ${subscriptionUrls.length}, 目标格式: ${targetFormat}`,
      );

      // 步骤 1: 拉取所有订阅源
      currentStep = "fetch-subscriptions";
      console.log("[步骤 1] 拉取订阅源...");
      const fetchResults = await Promise.all(
        subscriptionUrls.map((url) => this.fetcher.fetch(url)),
      );

      // 按订阅分组输出日志
      let totalNodes = 0;
      let totalFailures = 0;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < fetchResults.length; i++) {
        const r = fetchResults[i];
        const shortUrl = r.url.replace(/token=[^&]+/, "token=***");
        const nodeCount = r.nodes.length;
        const failureCount = r.failures.length;

        if (r.success) {
          successCount++;
          totalNodes += nodeCount;
          totalFailures += failureCount;
          const failInfo =
            failureCount > 0
              ? `, 解析失败 ${failureCount}`
              : "";
          console.log(
            `  订阅 ${i + 1}: 成功 ${nodeCount} 个节点${failInfo} [${r.format}] ${shortUrl}`,
          );
          // 列出具体解析失败的条目
          if (failureCount > 0) {
            for (const f of r.failures) {
              const reason = f.reason ? ` | reason=${f.reason}` : "";
              console.log(`    └─ [${f.protocol}] ${f.preview}${reason}`);
            }
          }
        } else {
          failCount++;
          console.error(`  订阅 ${i + 1}: 拉取失败 - ${r.error} ${shortUrl}`);
          if (r.attempts && r.attempts.length > 0) {
            r.attempts.forEach(a => console.error(`    └─ ${a}`));
          }
        }
      }

      console.log(
        `拉取汇总: 订阅 ${fetchResults.length}, 成功 ${successCount}, 失败 ${failCount}, 节点 ${totalNodes}, 解析失败 ${totalFailures}`,
      );

      // 步骤 2: 合并节点
      currentStep = "merge-nodes";
      console.log("[步骤 2] 合并节点...");
      const allNodes = this.merger.merge(fetchResults);

      if (allNodes.length === 0) {
        throw new Error("未解析到任何有效节点");
      }

      // 输出统计信息
      const stats = this.merger.getStats(allNodes);
      const mergedTypeStr = this.formatStats(stats.byType);
      console.log(`合并去重后: 总计 ${stats.total}${mergedTypeStr ? `，协议: ${mergedTypeStr}` : ""}`);

      // 步骤 3: 生成目标格式
      currentStep = "generate-output";
      console.log(`[步骤 3] 生成 ${targetFormat} 格式...`);
      const Generator = this.getGenerator(targetFormat);
      if (!Generator) {
        throw new Error(`不支持的格式: ${targetFormat}`);
      }

      const generator = new Generator();
      const validNodes = generator.filterValidNodes(allNodes);
      const result = generator.generate(allNodes);

      const outputStats = this.getOutputStats(targetFormat, result, validNodes);
      if (outputStats) {
        const total = Object.values(outputStats).reduce((sum, n) => sum + n, 0);
        const outputTypeStr = this.formatStats(outputStats);
        console.log(`输出协议统计: 总计 ${total}${outputTypeStr ? `，协议: ${outputTypeStr}` : ""}`);
      }
      console.log(`========== 原生转换完成 ==========\n`);
      return result;
    } catch (error) {
      console.error(
        `原生转换失败 [step=${currentStep}] [targetFormat=${targetFormat}] [sources=${subscriptionUrls.length}]:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 获取生成器类
   * @param {string} format - 格式名称
   * @returns {Class|null} 生成器类
   */
  getGenerator(format) {
    const formatMap = {
      ss: generators.SSGenerator,
      clash: generators.ClashGenerator,
      v2ray: generators.V2RayGenerator,
      // 兼容其他可能的格式名称
      shadowsocks: generators.SSGenerator,
      "clash.yaml": generators.ClashGenerator,
      "v2ray.json": generators.V2RayGenerator,
    };

    return formatMap[format.toLowerCase()] || null;
  }

  formatStats(stats) {
    if (!stats) return "";
    return Object.entries(stats)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return String(a[0]).localeCompare(String(b[0]));
      })
      .map(([t, n]) => `${t}: ${n}`)
      .join(", ");
  }

  getOutputStats(format, result, nodes) {
    const fmt = (format || "").toLowerCase();
    if (fmt === "ss" || fmt === "shadowsocks") {
      try {
        const decoded = Buffer.from(result || "", "base64").toString("utf8");
        const lines = decoded.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const stats = {};
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
          const protocol = match ? match[1].toLowerCase() : "unknown";
          stats[protocol] = (stats[protocol] || 0) + 1;
        }
        return stats;
      } catch (e) {
        return null;
      }
    }

    const stats = {};
    for (const node of nodes || []) {
      const type = node.type || "unknown";
      stats[type] = (stats[type] || 0) + 1;
    }
    return stats;
  }
}

module.exports = NativeConverter;
