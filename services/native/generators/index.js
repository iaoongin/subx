/**
 * 配置生成器导出模块
 */
const MixedURIGenerator = require('./mixed-uri');
const SSGenerator = require('./ss');
const ClashGenerator = require('./clash');
const V2RayGenerator = require('./v2ray');

module.exports = {
    SSGenerator,
    MixedURIGenerator,
    ClashGenerator,
    V2RayGenerator,
    // 格式映射
    uri: MixedURIGenerator,
    ss: SSGenerator,
    'mixed-uri': MixedURIGenerator,
    'base64-uri': MixedURIGenerator,
    shadowrocket: MixedURIGenerator,
    clash: ClashGenerator,
    v2ray: V2RayGenerator
};
