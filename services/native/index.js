/**
 * 原生订阅转换器
 * 负责协调订阅拉取、节点解析、节点合并和格式生成
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
      console.log("========== 原生转换开始 ==========");
      console.log(`订阅源数量: ${subscriptionUrls.length}, 目标格式: ${targetFormat}`);

      currentStep = "fetch-subscriptions";
      console.log("[步骤 1] 拉取订阅源...");
      const fetchResults = await Promise.all(
        subscriptionUrls.map((url) => this.fetcher.fetch(url)),
      );

      let totalNodes = 0;
      let totalFailures = 0;
      let successCount = 0;
      let failCount = 0;
      const fetchedTypeStats = {};

      for (let i = 0; i < fetchResults.length; i++) {
        const result = fetchResults[i];
        const shortUrl = this.maskSensitiveText(result.url);
        const nodeCount = result.nodes.length;
        const failureCount = result.failures.length;
        const typeStats = this.countNodesByType(result.nodes);
        const typeInfo = this.formatStats(typeStats);

        if (result.success) {
          successCount++;
          totalNodes += nodeCount;
          totalFailures += failureCount;
          this.mergeStats(fetchedTypeStats, typeStats);

          const failInfo = failureCount > 0 ? `, 解析失败 ${failureCount}` : "";
          const typeSuffix = typeInfo ? `, 协议: ${typeInfo}` : "";
          console.log(
            `  订阅 ${i + 1}: 成功 ${nodeCount} 个节点${failInfo}${typeSuffix} [${result.format}] ${shortUrl}`,
          );

          if (failureCount > 0) {
            for (const failure of result.failures) {
              const reason = failure.reason ? ` | reason=${failure.reason}` : "";
              console.log(`    - [${failure.protocol}] ${failure.preview}${reason}`);
            }
          }
        } else {
          failCount++;
          console.error(`  订阅 ${i + 1}: 拉取失败 - ${result.error} ${shortUrl}`);
          if (result.attempts && result.attempts.length > 0) {
            result.attempts.forEach((attempt) => console.error(`    - ${attempt}`));
          }
        }
      }

      const fetchedTypeInfo = this.formatStats(fetchedTypeStats);
      console.log(
        `拉取汇总: 订阅 ${fetchResults.length}, 成功 ${successCount}, 失败 ${failCount}, 节点 ${totalNodes}, 解析失败 ${totalFailures}${fetchedTypeInfo ? `, 协议: ${fetchedTypeInfo}` : ""}`,
      );

      currentStep = "merge-nodes";
      console.log("[步骤 2] 合并节点...");
      const mergeResult = this.merger.merge(fetchResults);
      const allNodes = mergeResult.nodes;
      const dedupReport = mergeResult.dedupReport;

      if (allNodes.length === 0) {
        throw new Error("未解析到任何有效节点");
      }

      const stats = this.merger.getStats(allNodes);
      const mergedTypeStr = this.formatStats(stats.byType);
      console.log(`合并去重后: 总计 ${stats.total}${mergedTypeStr ? `，协议: ${mergedTypeStr}` : ""}`);

      if (dedupReport.length > 0) {
        const duplicateTypeStats = this.countDuplicateTypes(dedupReport);
        const duplicateCount = Object.values(duplicateTypeStats).reduce((sum, count) => sum + count, 0);
        const duplicateTypeStr = this.formatStats(duplicateTypeStats);

        console.log(
          `去重明细: 重复 ${duplicateCount} 条，分组 ${dedupReport.length}${duplicateTypeStr ? `，协议: ${duplicateTypeStr}` : ""}`,
        );

        for (const group of dedupReport) {
          console.log(`  去重键: ${group.key}`);
          console.log(`    保留 ${this.formatNodeRecord(group.kept)}`);
          for (const duplicate of group.duplicates) {
            console.log(`    重复 ${this.formatNodeRecord(duplicate)}`);
            console.log(`      ${this.summarizeNodeDifference(group.kept, duplicate)}`);
          }
        }
      }

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
        const total = Object.values(outputStats).reduce((sum, count) => sum + count, 0);
        const outputTypeStr = this.formatStats(outputStats);
        console.log(`输出协议统计: 总计 ${total}${outputTypeStr ? `，协议: ${outputTypeStr}` : ""}`);
      }

      console.log("========== 原生转换完成 ==========\n");
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
      shadowsocks: generators.SSGenerator,
      "clash.yaml": generators.ClashGenerator,
      "v2ray.json": generators.V2RayGenerator,
    };

    return formatMap[format.toLowerCase()] || null;
  }

  countNodesByType(nodes) {
    const stats = {};
    for (const node of nodes || []) {
      const type = node.type || "unknown";
      stats[type] = (stats[type] || 0) + 1;
    }
    return stats;
  }

  countDuplicateTypes(dedupReport) {
    const stats = {};
    for (const group of dedupReport || []) {
      for (const node of group.duplicates || []) {
        const type = node.type || "unknown";
        stats[type] = (stats[type] || 0) + 1;
      }
    }
    return stats;
  }

  mergeStats(target, source) {
    for (const [type, count] of Object.entries(source || {})) {
      target[type] = (target[type] || 0) + count;
    }
    return target;
  }

  formatStats(stats) {
    if (!stats || Object.keys(stats).length === 0) return "";
    return Object.entries(stats)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return String(a[0]).localeCompare(String(b[0]));
      })
      .map(([type, count]) => `${type}: ${count}`)
      .join(", ");
  }

  formatNodeRecord(node) {
    const type = node?.type || "unknown";
    const name = node?.name || "(no-name)";
    const server = node?.server || "(no-server)";
    const port = node?.port ?? "(no-port)";
    const raw = this.rawAsIs(node?.raw);
    return `[${type}] name=${name} server=${server} port=${port}${raw ? ` raw=${raw}` : ""}`;
  }

  rawAsIs(raw) {
    if (!raw) return "";
    return String(raw);
  }

  summarizeNodeDifference(kept, duplicate) {
    if (this.onlyFragmentDiffers(kept?.raw, duplicate?.raw)) {
      return `差异: 仅 fragment/name 不同，保留="${kept?.name || ""}"，重复="${duplicate?.name || ""}"`;
    }

    return `差异: 不止 fragment/name 不同，保留="${kept?.name || ""}"，重复="${duplicate?.name || ""}"`;
  }

  onlyFragmentDiffers(leftRaw, rightRaw) {
    if (!leftRaw || !rightRaw) return false;

    const left = String(leftRaw);
    const right = String(rightRaw);
    if (left === right) return false;

    const [leftBase] = left.split("#");
    const [rightBase] = right.split("#");
    return leftBase === rightBase;
  }

  maskSensitiveText(text) {
    if (!text) return "";

    return String(text)
      .replace(/token=([^&\s]+)/gi, "token=***")
      .replace(/([a-z][a-z0-9+.-]*:\/\/)([^@\/?#]+)@/gi, "$1***@");
  }

  getOutputStats(format, result, nodes) {
    const fmt = (format || "").toLowerCase();
    if (fmt === "ss" || fmt === "shadowsocks") {
      try {
        const decoded = Buffer.from(result || "", "base64").toString("utf8");
        const lines = decoded.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const stats = {};
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
          const protocol = match ? match[1].toLowerCase() : "unknown";
          stats[protocol] = (stats[protocol] || 0) + 1;
        }
        return stats;
      } catch (error) {
        return null;
      }
    }

    return this.countNodesByType(nodes);
  }
}

module.exports = NativeConverter;
