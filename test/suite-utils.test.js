const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeImportedSuite, evaluateCaseResult, summarizeSuiteResults } = require('../public/suite-utils');

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
  assert.throws(() => normalizeImportedSuite([{
    userMessage: '你好',
    timeContext: { timestamp: '2026-11-16T17:30:00.000Z', timeZone: 'Not/A-Timezone' }
  }]), /不是有效的 IANA 时区/);
});


test('evaluates expected intent, emotion and strategy while leaving response checks for human review', () => {
  const testCase = {
    expectedIntent: 'comfort_seeking',
    expectedEmotion: 'neutral',
    expectedStrategies: ['comfort_gently', 'avoid_unsolicited_advice'],
    checks: ['不要输出建议清单', '语气自然']
  };
  const result = evaluateCaseResult(testCase, {
    error: false,
    analysis: {
      userIntent: { type: 'comfort_seeking' },
      userEmotion: { type: 'neutral' },
      responseStrategy: ['comfort_gently', 'avoid_unsolicited_advice', 'be_concise']
    }
  });

  assert.deepEqual(result.automatedChecks.map(item => item.status), ['pass', 'pass', 'pass']);
  assert.deepEqual(result.manualChecks, [
    { criterion: '不要输出建议清单', status: 'pending' },
    { criterion: '语气自然', status: 'pending' }
  ]);
  assert.deepEqual(result.summary, { passed: 3, failed: 0, pending: 2, notApplicable: 0 });
});

test('reports missing analysis fields and aggregates suite evaluation accurately', () => {
  const evaluation = evaluateCaseResult({
    expectedIntent: 'casual_chat',
    expectedStrategies: ['natural_chat']
  }, { error: false, analysis: null });
  assert.deepEqual(evaluation.automatedChecks.map(item => item.status), ['fail', 'fail']);

  const summary = summarizeSuiteResults([
    { error: false, evaluation },
    { error: true, evaluation: evaluateCaseResult({ expectedEmotion: 'happy', checks: ['具体回应'] }, { error: true }) }
  ]);
  assert.equal(summary.caseCount, 2);
  assert.equal(summary.requestFailures, 1);
  assert.deepEqual(summary.analysisChecks, { passed: 0, failed: 3, total: 3 });
  assert.equal(summary.manualChecksPending, 1);
});
