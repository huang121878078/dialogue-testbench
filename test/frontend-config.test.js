const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('frontend defaults to DashScope compatible endpoint and qwen-flash', () => {
  assert.match(appSource, /baseUrl:\s*'https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1'/);
  assert.match(appSource, /model:\s*'qwen-flash'/);
  assert.match(htmlSource, /id="baseUrl" value="https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1"/);
  assert.match(htmlSource, /id="model" value="qwen-flash"/);
});

test('configuration is persisted on field changes and before chat or suite requests', () => {
  assert.match(appSource, /addEventListener\('change',\s*\(\) => saveConfig\(true\)\)/);
  assert.match(appSource, /saveConfig\(true\);\s*busy = true;/);
  assert.match(appSource, /saveConfig\(true\);\s*runnerActive = true;/);
});

test('batch runner reports why it cannot start instead of silently returning', () => {
  assert.match(appSource, /请先导入 JSON 测试集，再点击执行/);
  assert.match(appSource, /请填写 API Key；Base URL 和模型已有默认值/);
  assert.match(appSource, /当前有一条手动消息正在生成/);
  assert.match(appSource, /测试集导入脚本未加载/);
});

test('browser cache is busted for updated frontend scripts', () => {
  assert.match(htmlSource, /suite-utils\.js\?v=20261116-3/);
  assert.match(htmlSource, /app\.js\?v=20261116-3/);
});
