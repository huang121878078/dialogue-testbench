const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

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

test('frontend bootstrap loads versioned scripts and reports resource errors', () => {
  assert.match(htmlSource, /const version = '20261116-10'/);
  assert.match(htmlSource, /function loadScript\(fileName\)/);
  assert.match(htmlSource, /loadScript\('suite-utils\.js'\)/);
  assert.match(htmlSource, /loadScript\('app\.js'\)/);
  assert.match(htmlSource, /bootstrap\.resource_failed/);
  assert.match(htmlSource, /bootstrap\.runtime_error/);
  assert.match(htmlSource, /脚本资源加载失败/);
});

test('chat UI does not submit a native form or navigate away', () => {
  assert.match(htmlSource, /<div id="chatForm" class="composer">/);
  assert.doesNotMatch(htmlSource, /<form id="chatForm"/);
  assert.match(htmlSource, /id="sendBtn" type="button"/);
  assert.match(appSource, /\$\('sendBtn'\)\.addEventListener\('click', submitCurrentMessage\)/);
});

test('chat and batch requests verify the local Node API before calling the model', () => {
  assert.match(appSource, /async function checkBackendConnection\(\)/);
  assert.match(appSource, /fetch\('\/api\/health'/);
  assert.match(appSource, /请在项目目录运行 npm start/);
  assert.match(appSource, /const backend = await checkBackendConnection\(\)/);
});

test('provider requests do not silently follow 3xx redirects', () => {
  assert.equal((serverSource.match(/redirect: 'manual'/g) || []).length, 2);
  assert.match(serverSource, /重定向地址：/);
  assert.match(serverSource, /模型接口返回了 HTTP/);
  assert.match(serverSource, /upstream\.headers\.get\('location'\)/);
});

test('browser logs global errors, chat lifecycle and batch test lifecycle', () => {
  assert.match(appSource, /browser\.window_error/);
  assert.match(appSource, /browser\.unhandled_rejection/);
  assert.match(appSource, /chat\.send_failed/);
  assert.match(appSource, /chat\.stream\.first_chunk/);
  assert.match(appSource, /suite\.case\.started/);
  assert.match(appSource, /suite\.case\.finished/);
  assert.match(appSource, /suite\.run\.failed/);
});

test('browser diagnostics do not print the API key value', () => {
  assert.match(appSource, /hasApiKey: Boolean\(\$\('apiKey'\)\.value\.trim\(\)\)/);
  assert.doesNotMatch(appSource, /apiKey:\s*\$\('apiKey'\)\.value/);
});

test('server logs API request ids and provider request lifecycle without raw credentials', () => {
  assert.match(serverSource, /X-Request-Id/);
  assert.match(serverSource, /http\.request\.start/);
  assert.match(serverSource, /http\.request\.finish/);
  assert.match(serverSource, /provider\.analysis\.start/);
  assert.match(serverSource, /provider\.completion\.start/);
  assert.match(serverSource, /provider\.completion\.stream_finished/);
  assert.match(serverSource, /safeEndpointForLog\(baseUrl\)/);
  assert.doesNotMatch(serverSource, /apiKey:\s*apiKey/);
});

test('browser console logger sanitizes sensitive fields and bearer tokens', () => {
  assert.match(appSource, /function sanitizeConsoleValue\(/);
  assert.match(appSource, /\(api\.?key\|authorization\|password\|secret\|access\.?token\)/);
  assert.match(appSource, /Bearer \[REDACTED\]/);
  assert.match(appSource, /...sanitizeConsoleValue\(details\)/);
});

test('server logs process-level and JSON middleware errors', () => {
  assert.match(serverSource, /process\.on\('unhandledRejection'/);
  assert.match(serverSource, /process\.on\('uncaughtExceptionMonitor'/);
  assert.match(serverSource, /http\.middleware\.error/);
});

test('header distinguishes an unstarted frontend from backend disconnection', () => {
  assert.match(htmlSource, /id="status" class="status">前端脚本未运行</);
  assert.match(appSource, /前端脚本已加载，正在初始化/);
  assert.match(htmlSource, /app\.js\?v=20261116-9[^>]*onerror=/);
  assert.match(htmlSource, /suite-utils\.js\?v=20261116-9[^>]*onerror=/);
});
