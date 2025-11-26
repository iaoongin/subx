const { Buffer } = require("buffer");

/**
 * Base64 编码
 * @param {string} str - 需要编码的字符串
 * @returns {string} Base64 编码后的字符串
 */
function base64Encode(str) {
    return Buffer.from(str, "utf-8").toString("base64");
}

/**
 * Base64 解码
 * @param {string} base64 - Base64 编码的字符串
 * @returns {string} 解码后的字符串
 */
function base64Decode(base64) {
    return Buffer.from(base64, "base64").toString("utf-8");
}

module.exports = {
    base64Encode,
    base64Decode,
};
