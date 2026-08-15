const INPUT_FORMATS = Object.freeze({
    URI: 'uri',
    BASE64: 'base64',
    CLASH_YAML: 'yaml',
    JSON: 'json'
});

const OUTPUT_FORMATS = Object.freeze({
    URI: 'uri',
    CLASH: 'clash',
    V2RAY: 'v2ray'
});

const OUTPUT_ALIASES = Object.freeze({
    uri: OUTPUT_FORMATS.URI,
    base64: OUTPUT_FORMATS.URI,
    'base64-uri': OUTPUT_FORMATS.URI,
    'mixed-uri': OUTPUT_FORMATS.URI,
    shadowrocket: OUTPUT_FORMATS.URI,
    // 兼容旧版本：旧的 ss 输出实际就是多协议 URI 订阅。
    ss: OUTPUT_FORMATS.URI,
    shadowsocks: OUTPUT_FORMATS.URI,
    clash: OUTPUT_FORMATS.CLASH,
    'clash.yaml': OUTPUT_FORMATS.CLASH,
    v2ray: OUTPUT_FORMATS.V2RAY,
    'v2ray.json': OUTPUT_FORMATS.V2RAY
});

function normalizeOutputFormat(format) {
    return OUTPUT_ALIASES[String(format || '').toLowerCase()] || '';
}

module.exports = {
    INPUT_FORMATS,
    OUTPUT_FORMATS,
    OUTPUT_ALIASES,
    normalizeOutputFormat
};
