const express = require('express');
const { Buffer } = require('buffer');


const app = express();
const port = process.env.PORT || 3000;

let myToken = 'auto00321';
let BotToken = '';
let ChatID = '';
let TG = 0;
let FileName = '雨纷纷';
let SUBUpdateTime = 6;
let total = 99; // TB
let timestamp = 4102329600000;

let MainData = `
https://52pokemon.xz61.cn/api/v1/client/subscribe?token=06b668bf909e0d6b0e89adb7ed09724f
https://52pokemon.xz61.cn/api/v1/client/subscribe?token=580581cd35a48ac7ac9a0e68b0e25195
https://bestsub.bestrui.ggff.net/share/bestsub/cdcefaa4-1f0d-462e-ba76-627b344989f2/speed.yaml
`;

let subConverter = "subc.00321.xyz"; 
let subConfig = "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini"; 
let subProtocol = 'https';

app.get('/:path', async (req, res) => {
  try {
    const token = req.query.token || '';
    const pathToken = req.params.path;

    // 使用环境变量覆盖默认值
    myToken = process.env.TOKEN || myToken;
    BotToken = process.env.TGTOKEN || BotToken;
    ChatID = process.env.TGID || ChatID;
    TG = process.env.TG ? Number(process.env.TG) : TG;
    subConverter = process.env.SUBAPI || subConverter;
    subConfig = process.env.SUBCONFIG || subConfig;
    FileName = process.env.SUBNAME || FileName;

    if(token !== myToken && pathToken !== myToken){
      res.status(403).type('text/plain; charset=utf-8').set('Profile-Update-Interval', SUBUpdateTime.toString());
      return res.send('oh no!');
    }

    if (subConverter.startsWith("http://")) {
      subConverter = subConverter.split("//")[1];
      subProtocol = 'http';
    } else {
      subConverter = subConverter.split("//")[1] || subConverter;
    }

    const userAgentHeader = (req.headers['user-agent'] || '').toLowerCase();

    let 订阅格式 = 'ss';
    if (userAgentHeader.includes('null') || userAgentHeader.includes('subconverter') || userAgentHeader.includes('nekobox') || userAgentHeader.includes('cf-workers-sub')) {
      订阅格式 = 'ss';
    } else if (userAgentHeader.includes('clash') || ('clash' in req.query && !userAgentHeader.includes('subconverter'))) {
      订阅格式 = 'clash';
    } else if (userAgentHeader.includes('sing-box') || userAgentHeader.includes('singbox') || (('sb' in req.query || 'singbox' in req.query) && !userAgentHeader.includes('subconverter'))) {
      订阅格式 = 'singbox';
    } else if (userAgentHeader.includes('surge') || ('surge' in req.query && !userAgentHeader.includes('subconverter'))) {
      订阅格式 = 'surge';
    } else if (userAgentHeader.includes('quantumult%20x') || ('quanx' in req.query && !userAgentHeader.includes('subconverter'))) {
      订阅格式 = 'quanx';
    } else if (userAgentHeader.includes('loon') || ('loon' in req.query && !userAgentHeader.includes('subconverter'))) {
      订阅格式 = 'loon';
    }

    console.log('订阅格式: ', 订阅格式);

    let 订阅转换URL = await ADD(MainData);
    let 订阅转换URLs = 订阅转换URL.join("|");
    let 编码后的订阅URLs = encodeURIComponent(订阅转换URLs);

    let subContent = '';
    if (订阅格式 === 'ss') {
      // 协议数组
      const 协议列表 = ['ss', 'ssr', 'v2ray', 'trojan'];
      let 合并内容 = await fetchInBatches(协议列表, 编码后的订阅URLs);
      // 最终 Base64 编码
      subContent = base64Encode(合并内容.trim());
    } else {
      let subConverterUrl = `${subProtocol}://${subConverter}/sub?target=${订阅格式}&url=${编码后的订阅URLs}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
      const response = await fetch(subConverterUrl, {
        headers: {
          'User-Agent': 'Node-fetch',
          'Accept': '*/*',
        },
        redirect: 'manual',
      });
      subContent = await response.text();
    }

    res.set({
      'content-type': 'text/plain; charset=utf-8',
      'Profile-Update-Interval': SUBUpdateTime.toString(),
    });

    res.send(subContent);

  } catch (error) {
    console.error('错误:', error);
    res.status(500).send('服务器内部错误');
  }
});


async function fetchInBatches(协议列表, 编码后的订阅URLs) {
  // 构造所有请求的 Promise 数组
  const fetchPromises = 协议列表.map(async 协议 => {
    let url = `${subProtocol}://${subConverter}/sub?target=${协议}&url=${编码后的订阅URLs}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Node-fetch', 'Accept': '*/*' },
      });
      let text = await resp.text();
      return base64Decode(text.trim());
    } catch (err) {
      console.error('请求异常', err);
      return ''; // 出错返回空字符串，避免 Promise.all 拒绝
    }
  });

  // 等待所有请求完成
  const results = await Promise.all(fetchPromises);

  // 合并所有结果，之间用换行隔开
  return results.join('\n') + '\n';
}

async function ADD(envAdd) {
  let addText = envAdd.replace(/[\t"'|\r\n]+/g, '\n').replace(/\n+/g, '\n');
  if (addText.charAt(0) === '\n') addText = addText.slice(1);
  if (addText.charAt(addText.length - 1) === '\n') addText = addText.slice(0, addText.length - 1);
  const add = addText.split('\n');
  console.log('节点列表:', add);
  return add;
}

function base64Encode(str) {
  return Buffer.from(str, 'utf-8').toString('base64');
}

function base64Decode(base64) {
  return Buffer.from(base64, 'base64').toString('utf-8');
}

app.listen(port, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${port}`);
});