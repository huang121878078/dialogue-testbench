const test = require('node:test');
const assert = require('node:assert/strict');
const scenarios = require('./companion-scenarios.json');

const VALID_INTENTS = new Set([
  'venting', 'comfort_seeking', 'advice_seeking', 'positive_sharing',
  'daily_life_support', 'casual_chat', 'withdrawal', 'identity_query', 'other_request', 'unclear'
]);
const VALID_EMOTIONS = new Set([
  'sad', 'happy', 'angry', 'anxious', 'tired', 'confused',
  'neutral', 'mixed', 'unclear'
]);

test('companion regression scenarios have unique ids and usable assertions', () => {
  const ids = scenarios.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'scenario ids must be unique');
  assert.ok(scenarios.length >= 10, 'keep a useful baseline scenario set');

  for (const scenario of scenarios) {
    assert.ok(scenario.id && scenario.category && scenario.userMessage, 'scenario metadata is required');
    assert.ok(Array.isArray(scenario.checks) && scenario.checks.length > 0, scenario.id);
    if (scenario.expectedIntent) assert.ok(VALID_INTENTS.has(scenario.expectedIntent), scenario.id);
    if (scenario.expectedEmotion) assert.ok(VALID_EMOTIONS.has(scenario.expectedEmotion), scenario.id);
    if (scenario.expectedStrategies) assert.ok(scenario.expectedStrategies.every(value => typeof value === 'string'), scenario.id);
    if (scenario.timeContext) {
      assert.ok(!Number.isNaN(Date.parse(scenario.timeContext.timestamp)), scenario.id + ' timeContext.timestamp');
      assert.ok(typeof scenario.timeContext.timeZone === 'string' && scenario.timeContext.timeZone, scenario.id + ' timeContext.timeZone');
    }
  }
});

test('baseline covers the companion product risk areas', () => {
  const categories = new Set(scenarios.map(item => item.category));
  for (const category of [
    'intent-and-boundaries', 'time-awareness', 'calibration',
    'persona-stability', 'persona-boundary'
  ]) assert.ok(categories.has(category), 'missing category: ' + category);
});
