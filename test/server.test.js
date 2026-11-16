const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEndpoint,
  safeEndpointForLog,
  sanitizeLogValue,
  parseModelJson,
  normalizeAnalysis,
  buildTimeContext,
  injectCompanionContext
} = require('../server');

test('normalizes OpenAI-compatible endpoints without duplicating chat path', () => {
  assert.equal(normalizeEndpoint('https://example.com/v1'), 'https://example.com/v1/chat/completions');
  assert.equal(normalizeEndpoint('https://example.com/v1/chat/completions/'), 'https://example.com/v1/chat/completions');
});

test('normalizes the configured DashScope Base URL to its Chat Completions endpoint', () => {
  assert.equal(
    normalizeEndpoint('https://dashscope.aliyuncs.com/compatible-mode/v1'),
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  );
});

test('safe endpoint logs omit URL credentials and query parameters', () => {
  assert.equal(
    safeEndpointForLog('https://user:secret@example.com/v1?api_key=do-not-log'),
    'https://example.com/v1'
  );
});

test('log sanitization redacts API keys, bearer tokens and credential query parameters', () => {
  const sanitized = sanitizeLogValue({
    apiKey: 'sk-test-secret',
    authorization: 'Bearer token-secret',
    endpoint: 'https://example.com/v1?api_key=query-secret',
    detail: 'request failed with Bearer response-secret'
  });
  assert.equal(sanitized.apiKey, '[REDACTED]');
  assert.equal(sanitized.authorization, '[REDACTED]');
  assert.equal(sanitized.endpoint, 'https://example.com/v1?api_key=[REDACTED]');
  assert.equal(sanitized.detail, 'request failed with Bearer [REDACTED]');
});

test('parses plain and fenced JSON model output', () => {
  assert.deepEqual(parseModelJson('{"ok":true}'), { ok: true });
  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
});

test('normalizes analysis into controlled intent, emotion and strategy enums', () => {
  const result = normalizeAnalysis({
    userIntent: { type: 'not-a-real-intent', confidence: 0.99, evidence: 'x'.repeat(200) },
    userEmotion: { type: 'sad', intensity: 9, confidence: 0.8 },
    responseStrategy: ['listen_first', 'invented_strategy', 'listen_first', 'be_concise']
  });
  assert.equal(result.userIntent.type, 'unclear');
  assert.equal(result.userIntent.evidence.length, 160);
  assert.equal(result.userEmotion.type, 'sad');
  assert.equal(result.userEmotion.intensity, 3);
  assert.deepEqual(result.responseStrategy, ['listen_first', 'be_concise']);
});

test('recognizes the dedicated identity intent and new companion strategies', () => {
  const result = normalizeAnalysis({
    userIntent: { type: 'identity_query', confidence: 0.95, evidence: '用户询问是否为 AI' },
    userEmotion: { type: 'neutral', intensity: 0, confidence: 0.9 },
    responseStrategy: ['maintain_independent_judgment', 'stay_grounded', 'be_concise']
  });
  assert.equal(result.userIntent.type, 'identity_query');
  assert.deepEqual(result.responseStrategy, [
    'maintain_independent_judgment', 'stay_grounded', 'be_concise'
  ]);
});

test('time context uses the supplied IANA timezone and stable local fields', () => {
  const result = buildTimeContext({
    timestamp: '2026-11-16T10:00:00.000Z',
    timeZone: 'Asia/Singapore'
  });
  assert.equal(result.localTime, '18:00');
  assert.equal(result.dayPeriod, '傍晚/晚间');
  assert.equal(result.timeZone, 'Asia/Singapore');
});

test('late-night time context crosses the date boundary correctly', () => {
  const result = buildTimeContext({
    timestamp: '2026-11-16T17:30:00.000Z',
    timeZone: 'Asia/Singapore'
  });
  assert.equal(result.date, '2026-11-17');
  assert.equal(result.localTime, '01:30');
  assert.equal(result.dayPeriod, '深夜/凌晨');
});

test('invalid timezone safely falls back to UTC', () => {
  const result = buildTimeContext({
    timestamp: '2026-11-16T10:00:00.000Z',
    timeZone: 'Not/A-Timezone'
  });
  assert.equal(result.timeZone, 'UTC');
  assert.equal(result.localTime, '10:00');
});

test('companion context is injected as auxiliary system context', () => {
  const messages = [{ role: 'system', content: 'persona' }, { role: 'user', content: 'hello' }];
  const output = injectCompanionContext(messages, null, {
    date: '2026-11-16', weekday: '星期一', localTime: '18:00',
    timeZone: 'Asia/Singapore', dayPeriod: '傍晚/晚间', timestamp: '2026-11-16T10:00:00.000Z'
  });
  assert.equal(output[0].content, 'persona');
  assert.equal(output[1].role, 'system');
  assert.match(output[1].content, /当前时间与生活节奏/);
  assert.equal(output[2].content, 'hello');
});
