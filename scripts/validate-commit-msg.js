#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const TYPES = [
  "feat",
  "fix",
  "refactor",
  "docs",
  "style",
  "test",
  "chore",
  "perf",
  "build",
  "ci",
  "revert",
  "reset",
];

const ALLOWED_SPECIAL_PREFIXES = ["Merge ", "Revert "];
const HEADER_REGEX = new RegExp(
  `^(${TYPES.join("|")})(\\([a-z0-9-]+\\))?(!)?:\\s(.+)$`
);

function readCommitMessage() {
  const target = process.argv[2];

  if (!target) {
    console.error("Missing commit message file path.");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), target);
  return fs.readFileSync(resolvedPath, "utf8");
}

function validateHeader(header) {
  if (!header) {
    return "提交信息不能为空。";
  }

  if (ALLOWED_SPECIAL_PREFIXES.some((prefix) => header.startsWith(prefix))) {
    return null;
  }

  const match = header.match(HEADER_REGEX);
  if (!match) {
    return "首行必须符合 `type(scope): 摘要` 格式。";
  }

  const subject = match[4].trim();

  if (subject.length < 4) {
    return "摘要太短，至少写清楚本次改动做了什么。";
  }

  if (subject.length > 72) {
    return "摘要过长，请尽量控制在 72 个字符以内。";
  }

  if (/[。.!！]$/.test(subject)) {
    return "摘要末尾不要加句号或感叹号。";
  }

  return null;
}

function printHelp(errorMessage) {
  console.error("");
  console.error("Commit message check failed");
  console.error(errorMessage);
  console.error("");
  console.error("Allowed format:");
  console.error("  type(scope): summary");
  console.error("  type: summary");
  console.error("");
  console.error(`Allowed types: ${TYPES.join(", ")}`);
  console.error("");
  console.error("Examples:");
  console.error("  feat: 新增订阅分组管理");
  console.error("  fix(ui): 修复停用卡片置灰表现");
  console.error("  docs(readme): 同步后台工作台说明");
  console.error("  refactor(subscriptions): 拆分列表渲染逻辑");
  console.error("");
}

function main() {
  const message = readCommitMessage();
  const header = message.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || "";
  const error = validateHeader(header);

  if (error) {
    printHelp(error);
    process.exit(1);
  }
}

main();
