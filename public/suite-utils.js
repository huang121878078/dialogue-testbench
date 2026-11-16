(function exposeDialogueSuiteUtils(root) {
function normalizeImportedSuite(data) {
  const cases = Array.isArray(data) ? data : data && data.cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error('JSON 必须是测试用例数组，或包含 cases 数组的对象。');
  }

  const normalized = cases.map((item, index) => {
    const userMessage = typeof item.userMessage === 'string' ? item.userMessage : item.prompt;
    if (typeof userMessage !== 'string' || !userMessage.trim()) {
      throw new Error('第 ' + (index + 1) + ' 题缺少 userMessage 或 prompt。');
    }

    let timeContext = null;
    if (item.timeContext !== undefined && item.timeContext !== null) {
      const value = item.timeContext;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('第 ' + (index + 1) + ' 题的 timeContext 必须是对象。');
      }
      const timestamp = typeof value.timestamp === 'string' ? value.timestamp.trim() : '';
      const timeZone = typeof value.timeZone === 'string' ? value.timeZone.trim() : '';
      if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
        throw new Error('第 ' + (index + 1) + ' 题的 timeContext.timestamp 必须是有效时间。');
      }
      if (!timeZone) {
        throw new Error('第 ' + (index + 1) + ' 题的 timeContext.timeZone 不能为空。');
      }
      try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(timestamp));
      } catch {
        throw new Error('第 ' + (index + 1) + ' 题的 timeContext.timeZone 不是有效的 IANA 时区。');
      }
      timeContext = { timestamp, timeZone };
    }

    return {
      id: item.id || 'case-' + (index + 1),
      title: item.title || item.name || '测试问题 ' + (index + 1),
      category: item.category || 'general',
      userMessage: userMessage.trim(),
      expectedIntent: item.expectedIntent || null,
      expectedEmotion: item.expectedEmotion || null,
      expectedStrategies: Array.isArray(item.expectedStrategies)
        ? [...new Set(item.expectedStrategies.filter(value => typeof value === 'string'))]
        : [],
      checks: Array.isArray(item.checks) ? item.checks : [],
      timeContext
    };
  });

  return {
    name: (!Array.isArray(data) && data.name) || '导入的对话测试集',
    version: (!Array.isArray(data) && data.version) || 1,
    cases: normalized
  };
}

function evaluateCaseResult(testCase, result = {}) {
  const analysis = result.analysis && typeof result.analysis === 'object' ? result.analysis : {};
  const actualIntent = analysis.userIntent && analysis.userIntent.type || null;
  const actualEmotion = analysis.userEmotion && analysis.userEmotion.type || null;
  const actualStrategies = Array.isArray(analysis.responseStrategy) ? analysis.responseStrategy : [];
  const automatedChecks = [];

  if (testCase.expectedIntent) {
    automatedChecks.push({
      key: 'intent',
      label: '意图识别',
      status: actualIntent === testCase.expectedIntent ? 'pass' : 'fail',
      expected: testCase.expectedIntent,
      actual: actualIntent
    });
  }

  if (testCase.expectedEmotion) {
    automatedChecks.push({
      key: 'emotion',
      label: '情绪识别',
      status: actualEmotion === testCase.expectedEmotion ? 'pass' : 'fail',
      expected: testCase.expectedEmotion,
      actual: actualEmotion
    });
  }

  if (Array.isArray(testCase.expectedStrategies) && testCase.expectedStrategies.length > 0) {
    const missing = testCase.expectedStrategies.filter(tag => !actualStrategies.includes(tag));
    automatedChecks.push({
      key: 'strategies',
      label: '响应策略',
      status: missing.length === 0 ? 'pass' : 'fail',
      expected: [...testCase.expectedStrategies],
      actual: actualStrategies,
      missing
    });
  }

  if (result.error) {
    automatedChecks.push({
      key: 'request',
      label: '请求执行',
      status: 'fail',
      expected: '模型请求成功',
      actual: '请求失败'
    });
  }

  const manualChecks = (Array.isArray(testCase.checks) ? testCase.checks : []).map(criterion => ({
    criterion: String(criterion),
    status: 'pending'
  }));
  const passed = automatedChecks.filter(check => check.status === 'pass').length;
  const failed = automatedChecks.filter(check => check.status === 'fail').length;

  return {
    automatedChecks,
    manualChecks,
    summary: {
      passed,
      failed,
      pending: manualChecks.length,
      notApplicable: 3 - automatedChecks.filter(check => ['intent', 'emotion', 'strategies'].includes(check.key)).length
    }
  };
}

function summarizeSuiteResults(results) {
  const items = Array.isArray(results) ? results : [];
  const checks = items.flatMap(item => item.evaluation && Array.isArray(item.evaluation.automatedChecks)
    ? item.evaluation.automatedChecks
    : []);
  const passed = checks.filter(check => check.status === 'pass').length;
  const failed = checks.filter(check => check.status === 'fail').length;
  const pendingManual = items.reduce((total, item) =>
    total + (item.evaluation && item.evaluation.manualChecks ? item.evaluation.manualChecks.length : 0), 0);
  return {
    caseCount: items.length,
    requestFailures: items.filter(item => item.error).length,
    analysisChecks: { passed, failed, total: passed + failed },
    manualChecksPending: pendingManual
  };
}

const api = { normalizeImportedSuite, evaluateCaseResult, summarizeSuiteResults };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (root && typeof root === 'object') {
  root.DialogueSuiteUtils = api;
}
})(typeof globalThis !== 'undefined' ? globalThis : this);
