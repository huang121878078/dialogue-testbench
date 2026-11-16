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

const DialogueSuiteUtils = { normalizeImportedSuite };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DialogueSuiteUtils;
}
if (typeof window !== 'undefined') {
  window.DialogueSuiteUtils = DialogueSuiteUtils;
}
