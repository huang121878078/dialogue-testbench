const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'dialogue-testbench' }));

app.post('/api/chat', async (req, res) => {
  const { baseUrl, apiKey, model, messages, temperature = 0.7, stream = true } = req.body || {};
  if (!baseUrl || !apiKey || !model || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请填写 API Base URL、API Key、模型名称，并提供 messages。' });
  }
  let endpoint;
  try {
    const normalized = baseUrl.replace(/\/+$/, '');
    endpoint = normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
    new URL(endpoint);
  } catch {
    return res.status(400).json({ error: 'API Base URL 格式不正确。' });
  }
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: Number(temperature), stream })
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(upstream.status).json({ error: `模型服务返回 ${upstream.status}`, detail: detail.slice(0, 6000) });
    }
    if (!stream) {
      const data = await upstream.json();
      return res.json({ content: data.choices?.[0]?.message?.content ?? '', usage: data.usage ?? null });
    }
    res.status(200);
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(502).json({ error: '连接模型服务失败', detail: error.message });
    else res.end();
  }
});

app.listen(PORT, () => console.log(`Dialogue Testbench running at http://localhost:${PORT}`));
