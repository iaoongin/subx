const fs = require("fs");
const path = require("path");
const vm = require("vm");
const yaml = require("js-yaml");

const DEFAULT_EXTENSION_SCRIPT = `function main(config, profileName) {
  let content = JSON.parse(JSON.stringify(config));
  return content;
}
`;

const SCRIPT_FILE = path.join(__dirname, "..", "data", "extension-script.js");
const TEMPLATE_SCRIPT_FILE = path.join(
  __dirname,
  "..",
  "data",
  "extension-script.template.js",
);

function normalizeScript(script) {
  if (typeof script !== "string" || !script.trim()) {
    return DEFAULT_EXTENSION_SCRIPT;
  }
  return script;
}

function ensureScriptFile() {
  const dataDir = path.dirname(SCRIPT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(SCRIPT_FILE)) {
    const templateScript = fs.existsSync(TEMPLATE_SCRIPT_FILE)
      ? fs.readFileSync(TEMPLATE_SCRIPT_FILE, "utf8")
      : DEFAULT_EXTENSION_SCRIPT;
    fs.writeFileSync(SCRIPT_FILE, normalizeScript(templateScript), "utf8");
  }
}

function getExtensionScript() {
  ensureScriptFile();
  const content = fs.readFileSync(SCRIPT_FILE, "utf8");
  return normalizeScript(content);
}

function saveExtensionScript(script) {
  ensureScriptFile();
  const normalized = normalizeScript(script);
  fs.writeFileSync(SCRIPT_FILE, normalized, "utf8");
  return normalized;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runExtensionScript(script, inputConfig, profileName = "SubX") {
  const sandbox = {
    inputConfig: deepClone(inputConfig),
    profileName,
    output: undefined,
  };

  const scriptContent = normalizeScript(script);
  const runner = `
"use strict";
${scriptContent}
if (typeof main !== "function") {
  throw new Error("Extension script must define main(config, profileName)");
}
output = main(inputConfig, profileName);
`;

  vm.runInNewContext(runner, sandbox, {
    timeout: 1000,
    displayErrors: true,
  });

  const result =
    sandbox.output === undefined ? sandbox.inputConfig : sandbox.output;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Extension script main must return an object");
  }
  return result;
}

function applyExtensionScriptToContent(script, content, format, profileName) {
  if (typeof script !== "string" || !script.trim()) {
    return content;
  }

  const normalizedFormat = String(format || "").toLowerCase();

  if (normalizedFormat === "clash") {
    const parsedConfig = yaml.load(content);
    if (
      !parsedConfig ||
      typeof parsedConfig !== "object" ||
      Array.isArray(parsedConfig)
    ) {
      throw new Error("Unable to parse clash config for extension script");
    }

    const processedConfig = runExtensionScript(script, parsedConfig, profileName);
    return yaml.dump(processedConfig, {
      lineWidth: -1,
      noRefs: true,
    });
  }

  if (
    normalizedFormat === "v2ray" ||
    normalizedFormat === "v2ray.json" ||
    normalizedFormat === "singbox"
  ) {
    const parsedConfig = JSON.parse(content);
    if (
      !parsedConfig ||
      typeof parsedConfig !== "object" ||
      Array.isArray(parsedConfig)
    ) {
      throw new Error("Unable to parse JSON config for extension script");
    }

    const processedConfig = runExtensionScript(script, parsedConfig, profileName);
    return JSON.stringify(processedConfig, null, 2);
  }

  return content;
}

module.exports = {
  DEFAULT_EXTENSION_SCRIPT,
  SCRIPT_FILE,
  normalizeScript,
  getExtensionScript,
  saveExtensionScript,
  runExtensionScript,
  applyExtensionScriptToContent,
};
