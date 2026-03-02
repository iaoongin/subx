/**
 * 协议解析器导出模块
 */
const ShadowsocksParser = require('./shadowsocks');
const VMessParser = require('./vmess');
const TrojanParser = require('./trojan');
const VLESSParser = require('./vless');
const Hysteria2Parser = require('./hysteria2');
const YAMLParser = require('./yaml');

module.exports = {
    ShadowsocksParser,
    VMessParser,
    TrojanParser,
    VLESSParser,
    Hysteria2Parser,
    YAMLParser
};
