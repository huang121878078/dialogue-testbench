const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeImportedSuite } = require('../public/suite-utils');

test('preserves fixed time context and expected strategies from imported suites', () => {
  const suite = normalizeImportedSuite({
    version: 1,
    name: '时间与策略测试',
    cases: [{
      id: 'late-night',
      userMessage: '突然想找你说说话。',
      expectedIntent: 'casual_chat',
      expectedStrategies: ['natural_chat', 'be_concise', 'natural_chat'],
      timeContext: {
        timestamp: '2026-11-16T17:30:00.000Z',
        timeZone: 'Asia/Singapore'
      }
    }]
  });

  assert.equal(suite.name, '时间与策略测试');
  assert.deepEqual(suite.cases[0].timeContext, {
    timestamp: '2026-11-16T17:30:00.000Z',
    timeZone: 'Asia/Singapore'
  });
  assert.deepEqual(suite.cases[0].expectedStrategies, ['natural_chat', 'be_concise']);
});

test('supports array-form suites and prompt aliases', () => {
  const suite = normalizeImportedSuite([{ prompt: '你好' }]);
  assert.equal(suite.cases[0].userMessage, '你好');
  assert.equal(suite.cases[0].timeContext, null);
  assert.deepEqual(suite.cases[0].expectedStrategies, []);
});

test('rejects malformed messages and malformed fixed time contexts', () => {
  assert.throws(() => normalizeImportedSuite([{ userMessage: ' ' }]), /缺少 userMessage/);
  assert.throws(() => normalizeImportedSuite([{
    userMessage: '你好',
    timeContext: { timestamp: 'not-a-date', timeZone: 'Asia/Singapore' }
  }]), /timestamp 必须是有效时间/);
  assert.throws(() => normalizeImportedSuite([{
    userMessage: '你好',
    timeContext: { timestamp: '2026-11-16T17:30:00.000Z' }
  }]), /timeZone 不能为空/);
});
