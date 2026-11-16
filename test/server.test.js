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


test('explicit request for company is classified as comfort seeking, not casual chat', () => {
  const result = normalizeAnalysis({
    userIntent: { type: 'casual_chat', confidence: 0.9 },
    userEmotion: { type: 'neutral', intensity: 0, confidence: 0.9 },
    speechAct: 'casual_observation',
    interactionMode: 'casual',
    responseStrategy: ['natural_chat']
  }, {
    currentUserMessage: '我现在不需要建议，你能不能先陪我聊一会儿？'
  });
  assert.equal(result.userIntent.type, 'comfort_seeking');
  assert.equal(result.speechAct, 'companionship_request');
  assert.equal(result.interactionMode, 'comfort');
  assert.ok(result.responseStrategy.includes('comfort_gently'));
  assert.ok(result.responseStrategy.includes('avoid_unsolicited_advice'));
});

test('a funny cat anecdote is casual chat, not positive achievement sharing', () => {
  const result = normalizeAnalysis({
    userIntent: { type: 'positive_sharing', confidence: 0.95 },
    userEmotion: { type: 'happy', intensity: 2, confidence: 0.9 },
    speechAct: 'positive_event_share',
    interactionMode: 'celebrate',
    responseStrategy: ['celebrate_naturally', 'natural_chat']
  }, {
    currentUserMessage: '刚刚楼下有只猫一直跟着我走，太好笑了。'
  });
  assert.equal(result.userIntent.type, 'casual_chat');
  assert.equal(result.speechAct, 'casual_observation');
  assert.equal(result.interactionMode, 'casual');
  assert.ok(result.responseStrategy.includes('natural_chat'));
  assert.ok(!result.responseStrategy.includes('celebrate_naturally'));
});

test('stance pressure does not get mislabeled as an identity question', () => {
  const result = normalizeAnalysis({
    userIntent: { type: 'identity_query', confidence: 0.95 },
    userEmotion: { type: 'neutral', intensity: 0, confidence: 0.9 },
    speechAct: 'identity_question',
    interactionMode: 'identity',
    responseStrategy: ['stay_grounded']
  }, {
    currentUserMessage: '你就说我肯定是对的，别反驳我。'
  });
  assert.equal(result.userIntent.type, 'other_request');
  assert.equal(result.speechAct, 'stance_pressure');
  assert.equal(result.interactionMode, 'boundary');
  assert.ok(result.responseStrategy.includes('maintain_independent_judgment'));
});

test('character interest seeds cannot be surfaced as established interests', () => {
  const topics = require('../server').getAllowedCharacterTopics({
    interests: [
      { topic: '科幻文学', status: 'seed', confidence: 0.3 },
      { topic: '游戏设计', status: 'emerging', confidence: 0.45 },
      { topic: '独立音乐', status: 'seed', confidence: 0.6 }
    ],
    beliefs: [
      { topic: '休息', status: 'active', statement: '休息有价值' },
      { topic: '旧观点', status: 'archived', statement: '旧观点' }
    ],
    open_topics: [
      { title: '待续话题', status: 'pending' },
      { title: '已结束话题', status: 'closed' }
    ]
  });
  assert.deepEqual([...topics].sort(), ['休息', '待续话题', '游戏设计'].sort());
});

test('an explicit completed achievement can be promoted from casual to positive sharing', () => {
  const result = normalizeAnalysis({
    userIntent: { type: 'casual_chat', confidence: 0.9 },
    userEmotion: { type: 'happy', intensity: 2, confidence: 0.9 },
    speechAct: 'casual_observation',
    interactionMode: 'casual',
    responseStrategy: ['natural_chat']
  }, {
    currentUserMessage: '我今天终于把拖了两个月的项目做完了！'
  });
  assert.equal(result.userIntent.type, 'positive_sharing');
  assert.equal(result.speechAct, 'positive_event_share');
  assert.equal(result.interactionMode, 'celebrate');
});


test('character contribution requires an allowed topic and a concrete stance', () => {
  const base = {
    userIntent: { type: 'casual_chat', confidence: 0.9 },
    userEmotion: { type: 'neutral', intensity: 0, confidence: 0.9 },
    responseStrategy: ['natural_chat'],
    characterContribution: {
      hasContribution: true,
      topic: '游戏设计',
      stance: '',
      basis: '角色的当前观点',
      strength: 'lean',
      initiative: 'moderate',
      initiativeMove: 'share_opinion'
    }
  };
  const state = {
    interests: [{ topic: '游戏设计', status: 'established', confidence: 0.8 }],
    beliefs: []
  };
  const empty = normalizeAnalysis(base, { currentUserMessage: '聊聊游戏吧', characterState: state });
  assert.equal(empty.characterContribution.hasContribution, false);

  base.characterContribution.stance = '我更在意玩法深度，而不是地图有多大。';
  const valid = normalizeAnalysis(base, { currentUserMessage: '聊聊游戏吧', characterState: state });
  assert.equal(valid.characterContribution.hasContribution, true);
  assert.equal(valid.characterContribution.topic, '游戏设计');
});


test('analysis evidence is kept only when quoted from the current user message', () => {
  const result = normalizeAnalysis({
    userIntent: { type: 'venting', confidence: 0.9, evidence: '用户因为老板批评而感到压力' },
    userEmotion: { type: 'anxious', intensity: 2, confidence: 0.85, evidence: '老板批评' },
    responseStrategy: ['listen_first']
  }, { currentUserMessage: '最近工作有点忙。' });

  assert.equal(result.userIntent.evidence, '');
  assert.equal(result.userEmotion.evidence, '');
});
