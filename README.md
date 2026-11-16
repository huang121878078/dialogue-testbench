# Dialogue Testbench

一个轻量级的 AI 对话测试台，用于验证 System Prompt、角色设定、动态上下文分析和多轮对话效果。

## 功能

- OpenAI Chat Completions 兼容接口，支持自定义 Base URL、API Key 和模型名
- SSE 流式输出与多轮对话
- 每轮自动分析用户意图、情绪、情绪强度和响应策略，不再需要手动填写这些字段
- 两阶段调用：先分析当前轮次，再将结构化分析结果注入角色 Prompt 生成回复
- 动态分析 Prompt 可编辑，方便测试不同的分类规则和策略选择方式
- 展示分析结果，以及分析请求和最终回复请求的实际 messages
- 可编辑 System Prompt、角色设定和附加上下文
- 浏览器本地保存配置；API Key 仅在浏览器到本地 Node 服务的请求中传递，由服务端代理模型请求
- 导出对话测试记录为 JSON

## 动态分析流程

1. 前端将最近对话和当前用户消息发送到本地服务。
2. 服务端使用配置的模型执行一次低 Temperature 的结构化分析，输出 intent、emotion 和 responseStrategy。
3. 服务端校验分析结果，只接受预定义的意图、情绪和策略枚举。
4. 将分析结果作为辅助 System Message 注入，再调用模型生成最终回复。分类和策略以情绪陪伴、生活陪伴为中心，而不是以通用问答或编程任务执行为中心。
5. 如果分析失败，系统会跳过分析注入并继续普通回复；分析结果和两阶段请求可在右侧检查器中查看。

意图枚举围绕陪伴场景设计：`venting`（倾诉）、`comfort_seeking`（寻求陪伴/安慰）、`advice_seeking`（寻求生活或关系建议）、`positive_sharing`（分享喜悦）、`daily_life_support`（日常生活协助）、`casual_chat`（闲聊）、`withdrawal`（退出当前话题）、`other_request`（其他请求）、`unclear`（无法判断）。不使用通用 `task` 意图。

情绪枚举：`sad`、`happy`、`angry`、`anxious`、`tired`、`confused`、`neutral`、`mixed`、`unclear`。强度为 0 到 3，置信度为 0 到 1。

响应策略为受控标签，例如 `listen_first`、`comfort_gently`、`celebrate_naturally`、`explore_with_user`、`offer_practical_help`、`respect_withdrawal`。策略不是固定写入每一轮，而是由分析模型根据当前消息动态选择。

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
- `POST /api/chat`：执行动态分析（可关闭）并代理 Chat Completions 请求，支持 SSE 流式响应