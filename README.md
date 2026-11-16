# Dialogue Testbench

一个轻量级的 AI 对话测试台，用于验证 System Prompt、角色设定、动态上下文注入和多轮对话效果。

## 功能

- OpenAI Chat Completions 兼容接口，支持自定义 Base URL、API Key 和模型名
- SSE 流式输出与多轮对话
- 可编辑 System Prompt、角色设定、用户意图、用户情绪、响应策略和附加上下文
- 每轮展示实际发送给模型的 `messages` JSON，便于检查注入内容和顺序
- 浏览器本地保存配置；API Key 仅在浏览器到本地 Node 服务的请求中传递，由服务端代理模型请求
- 导出对话测试记录为 JSON

## 环境要求

- Node.js 18 或更高版本
- 可访问的 OpenAI-compatible Chat Completions API

## 启动

```bash
npm install
npm start
```

打开 <http://localhost:3000>，填写 API Base URL、API Key 和模型名称即可开始测试。Base URL 可以填写 `https://api.openai.com/v1`，服务端会自动补上 `/chat/completions`。

开发模式：

```bash
npm run dev
```

## 安全说明

这是本地测试工具。不要将 API Key 提交到 Git 仓库；配置保存在当前浏览器的 localStorage 中。若将服务部署到公网，应增加身份认证、速率限制、HTTPS 和服务端密钥管理。

## API

- `GET /api/health`：健康检查
- `POST /api/chat`：代理 Chat Completions 请求，支持 SSE 流式响应
