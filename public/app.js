const $ = (id) => document.getElementById(id);
const fields = ['baseUrl','apiKey','model','temperature','systemPrompt','persona','useIntent','intent','useEmotion','emotion','useStrategy','strategy','useExtra','extra'];
let history = [];
let lastMessages = [];
let busy = false;

function loadConfig() {
  try { const saved = JSON.parse(localStorage.getItem('dt-config') || '{}'); for (const id of fields) if (saved[id] !== undefined) $(id).type === 'checkbox' ? $(id).checked = saved[id] : $(id).value = saved[id]; } catch {}
  $('tempValue').textContent = $('temperature').value;
}
function saveConfig() {
  const data = {}; for (const id of fields) data[id] = $(id).type === 'checkbox' ? $(id).checked : $(id).value;
  localStorage.setItem('dt-config', JSON.stringify(data)); $('status').textContent = '配置已保存';
}
function parseJsonOrText(value) { try { return JSON.parse(value); } catch { return value; } }
function buildMessages() {
  const system = [];
  if ($('systemPrompt').value.trim()) system.push($('systemPrompt').value.trim());
  if ($('persona').value.trim()) system.push(`【角色设定】\n${$('persona').value.trim()}`);
  const context = {};
  if ($('useIntent').checked && $('intent').value.trim()) context.userIntent = $('intent').value.trim();
  if ($('useEmotion').checked && $('emotion').value.trim()) context.userEmotion = parseJsonOrText($('emotion').value);
  if ($('useStrategy').checked && $('strategy').value.trim()) context.responseStrategy = parseJsonOrText($('strategy').value);
  if ($('useExtra').checked && $('extra').value.trim()) context.additionalContext = $('extra').value.trim();
  if (Object.keys(context).length) system.push(`【本轮动态上下文】\n${JSON.stringify(context, null, 2)}\n请将其作为辅助信息，优先完成用户当前明确提出的任务。`);
  const messages = [];
  if (system.length) messages.push({ role: 'system', content: system.join('\n\n') });
  return messages.concat(history);
}
function render() {
  const root = $('messages'); root.innerHTML = '';
  if (!history.length) root.innerHTML = '<div class="empty"><div class="empty-icon">✦</div><h3>开始测试你的角色</h3><p>配置模型和提示词，然后发送一条消息。</p></div>';
  for (const m of history) {
    const el = document.createElement('div'); el.className = `bubble ${m.role}`;
    const role = document.createElement('div'); role.className = 'role'; role.textContent = m.role === 'user' ? 'USER' : 'ASSISTANT';
    const body = document.createElement('div'); body.textContent = m.content;
    el.append(role, body); root.append(el);
  }
  root.scrollTop = root.scrollHeight;
  $('metrics').textContent = `${history.filter(x => x.role === 'user').length} 轮对话`;
}
function showPayload(messages) { lastMessages = messages; $('payload').textContent = JSON.stringify({ model: $('model').value, temperature: Number($('temperature').value), stream: true, messages }, null, 2); }
async function sendMessage(text) {
  if (busy || !text.trim()) return;
  if (!$('baseUrl').value.trim() || !$('apiKey').value.trim() || !$('model').value.trim()) { $('status').textContent = '请先完成模型配置'; return; }
  busy = true; $('sendBtn').disabled = true; $('status').textContent = '请求中…';
  history.push({ role: 'user', content: text.trim() });
  const messages = buildMessages(); showPayload(messages); render();
  const assistant = { role: 'assistant', content: '' }; history.push(assistant); render();
  const started = performance.now();
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: $('baseUrl').value.trim(), apiKey: $('apiKey').value.trim(), model: $('model').value.trim(), temperature: $('temperature').value, messages, stream: true }) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.detail || err.error || `HTTP ${response.status}`); }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (!data || data === '[DONE]') continue;
        try { const json = JSON.parse(data); const delta = json.choices?.[0]?.delta?.content; if (typeof delta === 'string') { assistant.content += delta; render(); } } catch {}
      }
    }
    $('status').textContent = `完成 · ${((performance.now() - started) / 1000).toFixed(1)}s`;
  } catch (error) {
    assistant.content = `请求失败：${error.message}`; assistant.error = true; $('status').textContent = '请求失败';
  } finally { busy = false; $('sendBtn').disabled = false; render(); }
}
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const value = $('userInput').value; $('userInput').value = ''; sendMessage(value); });
$('userInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('chatForm').requestSubmit(); } });
$('saveConfig').addEventListener('click', saveConfig);
$('temperature').addEventListener('input', () => $('tempValue').textContent = $('temperature').value);
$('clearChat').addEventListener('click', () => { history = []; render(); $('payload').textContent = '发送消息后，这里会显示请求 JSON。'; $('status').textContent = '对话已清空'; });
$('refreshPayload').addEventListener('click', () => showPayload(buildMessages()));
$('exportChat').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), history, lastMessages }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dialogue-test.json'; a.click(); URL.revokeObjectURL(a.href); });
loadConfig(); render();
