/**
 * Native subscription converter
 * Coordinates fetch, parse, merge, and format generation.
 */
const SubscriptionFetcher = require("./fetcher");
const NodeMerger = require("./merger");
const generators = require("./generators");
const { normalizeOutputFormat } = require("./formats");

class NativeConverter {
  constructor() {
    this.fetcher = new SubscriptionFetcher();
    this.merger = new NodeMerger();
  }

  async convert(subscriptionUrls, targetFormat, subscriptionSources = []) {
    let currentStep = "init";
    try {
      console.log("========== Native conversion start ==========");
      console.log(`sources=${subscriptionUrls.length}, targetFormat=${targetFormat}`);

      currentStep = "fetch-subscriptions";
      console.log("[step 1] fetching subscriptions...");
      const fetchResults = await Promise.all(
        subscriptionUrls.map(async (url, index) => {
          const result = await this.fetcher.fetch(url);
          return {
            ...result,
            sourceName: subscriptionSources[index]?.name || "",
          };
        }),
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

          const failInfo = failureCount > 0 ? `, parseFailed=${failureCount}` : "";
          const typeSuffix = typeInfo ? `, byType=${typeInfo}` : "";
          console.log(
            `  source ${i + 1}: success nodes=${nodeCount}${failInfo}${typeSuffix} [${result.format}] ${shortUrl}`,
          );

          if (failureCount > 0) {
            for (const failure of result.failures) {
              const reason = failure.reason ? ` | reason=${failure.reason}` : "";
              console.log(`    - [${failure.protocol}] ${failure.preview}${reason}`);
            }
          }
        } else {
          failCount++;
          console.error(`  source ${i + 1}: fetch failed - ${result.error} ${shortUrl}`);
          if (result.attempts && result.attempts.length > 0) {
            result.attempts.forEach((attempt) => console.error(`    - ${attempt}`));
          }
        }
      }

      console.log(
        `fetch summary: subscriptions=${fetchResults.length}, success=${successCount}, failed=${failCount}, nodes=${totalNodes}, parseFailed=${totalFailures}${this.formatStats(fetchedTypeStats) ? `, byType=${this.formatStats(fetchedTypeStats)}` : ""}`,
      );
      this.logAuditStage("fetched", this.getCountSummaryFromTypeStats(fetchedTypeStats));

      currentStep = "merge-nodes";
      console.log("[step 2] merging nodes...");
      const mergeResult = this.merger.merge(fetchResults);
      const allNodes = mergeResult.nodes;
      const dedupReport = mergeResult.dedupReport;

      if (allNodes.length === 0) {
        throw new Error("no valid nodes parsed");
      }

      const mergedStats = this.merger.getStats(allNodes);
      console.log(
        `merge summary: total=${mergedStats.total}${this.formatStats(mergedStats.byType) ? `, byType=${this.formatStats(mergedStats.byType)}` : ""}`,
      );
      this.logAuditStage("merged", mergedStats);

      if (dedupReport.length > 0) {
        const duplicateTypeStats = this.countDuplicateTypes(dedupReport);
        const duplicateCount = Object.values(duplicateTypeStats).reduce((sum, count) => sum + count, 0);
        const duplicateTypeStr = this.formatStats(duplicateTypeStats);

        console.log(
          `dedup detail: duplicates=${duplicateCount}, groups=${dedupReport.length}${duplicateTypeStr ? `, byType=${duplicateTypeStr}` : ""}`,
        );

        for (const group of dedupReport) {
          console.log(`  dedup key ${group.key}`);
          console.log(`    kept ${this.formatNodeRecord(group.kept)}`);
          for (const duplicate of group.duplicates) {
            console.log(`    dropped ${this.formatNodeRecord(duplicate)}`);
            console.log(`      ${this.summarizeNodeDifference(group.kept, duplicate)}`);
          }
        }
      }

      currentStep = "generate-output";
      console.log(`[step 3] generating ${targetFormat} format...`);
      const Generator = this.getGenerator(targetFormat);
      if (!Generator) {
        throw new Error(`unsupported format: ${targetFormat}`);
      }

      const generator = new Generator();
      const generatorAudit =
        typeof generator.generateWithAudit === "function"
          ? generator.generateWithAudit(allNodes)
          : null;

      const validNodes = generatorAudit
        ? generatorAudit.validNodes
        : generator.filterValidNodes(allNodes);
      const result = generatorAudit ? generatorAudit.content : generator.generate(allNodes);
      const generatedNodes = generatorAudit ? generatorAudit.generatedNodes : validNodes;

      this.logAuditStage("valid", {
        total: validNodes.length,
        byType: this.countNodesByType(validNodes),
      });

      const outputStats = this.getOutputStats(targetFormat, result, generatedNodes);
      if (outputStats) {
        const total = Object.values(outputStats).reduce((sum, count) => sum + count, 0);
        this.logAuditStage("generated", { total, byType: outputStats }, ` format=${targetFormat}`);
      }

      const discardedNodes = [
        ...this.flattenDedupDiscarded(dedupReport),
        ...(generatorAudit ? generatorAudit.discarded : []),
      ];
      this.logDiscardSummary(discardedNodes);

      console.log("========== Native conversion done ==========\n");
      return result;
    } catch (error) {
      console.error(
        `Native conversion failed [step=${currentStep}] [targetFormat=${targetFormat}] [sources=${subscriptionUrls.length}]:`,
        error,
      );
      throw error;
    }
  }

  getGenerator(format) {
    const normalizedFormat = normalizeOutputFormat(format);
    return generators[normalizedFormat] || null;
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
    const fmt = normalizeOutputFormat(format);
    if (fmt === "uri") {
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

  flattenDedupDiscarded(dedupReport) {
    const discarded = [];
    for (const group of dedupReport || []) {
      for (const node of group.duplicates || []) {
        discarded.push({
          reason: "deduplicated",
          type: node?.type || "unknown",
          name: node?.name || "",
          server: node?.server || "",
          port: node?.port ?? null,
        });
      }
    }
    return discarded;
  }

  groupDiscardedNodes(discardedNodes) {
    const grouped = {};

    for (const item of discardedNodes || []) {
      const reason = item?.reason || "unknown";
      const type = item?.type || "unknown";

      if (!grouped[reason]) {
        grouped[reason] = { total: 0, byType: {} };
      }

      grouped[reason].total += 1;
      grouped[reason].byType[type] = (grouped[reason].byType[type] || 0) + 1;
    }

    return grouped;
  }

  logAuditStage(stage, stats, extra = "") {
    const total = stats?.total || 0;
    const byType = this.formatStats(stats?.byType || {});
    console.log(
      `[native-audit] stage=${stage}${extra} total=${total}${byType ? ` byType=${byType}` : ""}`,
    );
  }

  logDiscardSummary(discardedNodes) {
    const grouped = this.groupDiscardedNodes(discardedNodes);
    for (const [reason, summary] of Object.entries(grouped)) {
      const byType = this.formatStats(summary.byType);
      console.log(
        `[native-audit] discard reason=${reason} total=${summary.total}${byType ? ` byType=${byType}` : ""}`,
      );
    }
  }

  getCountSummaryFromTypeStats(byType) {
    const total = Object.values(byType || {}).reduce((sum, count) => sum + count, 0);
    return { total, byType: byType || {} };
  }
}

module.exports = NativeConverter;
