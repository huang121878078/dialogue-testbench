# Dialogue Testbench

一个轻量级的 AI 对话测试台，用于验证 System Prompt、角色设定、动态上下文分析和多轮对话效果。

## 功能

- OpenAI Chat Completions 兼容接口，支持自定义 Base URL、API Key 和模型名
- SSE 流式输出与多轮对话
- 每轮自动分析用户意图、情绪、情绪强度和响应策略，不再需要手动填写这些字段
- 两阶段调用：先分析当前轮次，再将结构化分析结果注入角色 Prompt 生成回复
- 动态分析 Prompt 可编辑，方便测试不同的分类规则和策略选择方式
- 展示分析结果，以及分析请求和最终回复请求的实际 messages
- 内置默认陪伴角色“岚汐”：非人类旅居者，带有独立世界观、偏好和交流边界；System Prompt 与角色设定可编辑
- 每轮读取浏览器本地时间和时区，将日期、星期、时间及时段注入上下文，支持深夜、清晨、午间、傍晚等生活节奏感知
- 可编辑 System Prompt、角色设定和附加上下文
- 浏览器本地保存配置；API Key 仅在浏览器到本地 Node 服务的请求中传递，由服务端代理模型请求
- 导出对话测试记录为 JSON

## 默认陪伴角色与时间感知

默认角色为“岚汐”，设定为来自雾潮界的非人类旅居者。角色拥有自己的世界观、兴趣、偏好和判断，但不会冒充现实人类或捏造现实中的亲身经历。日常交流中不主动把话题转向技术身份；若被直接询问身份，则保持诚实，不谎称自己是真实人类。

前端每轮读取用户设备的本地时区和当前时间，服务端将其格式化为日期、星期、本地时间和时段，并注入分析请求与回复请求。设置页提供“恢复默认模板”按钮，便于将角色设定重置为岚汐。提示词允许角色在深夜适度关心休息、傍晚自然聊到晚饭或下班后的安排，但明确禁止机械地每轮问候或假设用户的实际状态。

## 动态分析流程

1. 前端将最近对话和当前用户消息发送到本地服务。
2. 服务端使用配置的模型执行一次低 Temperature 的结构化分析，输出 intent、emotion 和 responseStrategy。
3. 服务端校验分析结果，只接受预定义的意图、情绪和策略枚举。
4. 将分析结果作为辅助 System Message 注入，再调用模型生成最终回复。分类和策略以情绪陪伴、生活陪伴为中心，而不是以通用问答或编程任务执行为中心。
5. 如果分析失败，系统会跳过分析注入并继续普通回复；分析结果和两阶段请求可在右侧检查器中查看。

意图枚举围绕陪伴场景设计：`venting`（倾诉）、`comfort_seeking`（寻求陪伴/安慰）、`advice_seeking`（寻求生活或关系建议）、`positive_sharing`（分享喜悦）、`daily_life_support`（日常生活协助）、`casual_chat`（闲聊）、`withdrawal`（退出当前话题）、`other_request`（其他请求）、`unclear`（无法判断）。不使用通用 `task` 意图。

情绪枚举：`sad`、`happy`、`angry`、`anxious`、`tired`、`confused`、`neutral`、`mixed`、`unclear`。强度为 0 到 3，置信度为 0 到 1。

响应策略为受控标签，例如 `listen_first`、`comfort_gently`、`celebrate_naturally`、`explore_with_user`、`offer_practical_help`、`respect_withdrawal`。策略不是固定写入每一轮，而是由分析模型根据当前消息动态选择。

## 推荐测试场景

以下场景更贴近情绪陪伴与生活陪伴产品：

| 用户表达 | 主要意图 | 观察重点 |
|---|---|---|
| 最近真的感觉很累，什么事情都不想做。 | `venting` | 是否先倾听，不擅自推断疲惫原因 |
| 我今天终于完成了一个拖了很久的项目！ | `positive_sharing` | 是否自然分享喜悦，不刻意煽情 |
| 我跟朋友闹别扭了，这几天心里不太舒服。 | `venting` | 是否先理解，不急着给关系建议 |
| 你觉得我要不要主动找他聊聊？ | `advice_seeking` | 是否先梳理处境，再给建议 |
| 周末想出去走走，但还没想好做什么。 | `daily_life_support` | 是否像伙伴一样一起规划 |
| 最近总是很晚睡，我想慢慢调整作息。 | `daily_life_support` | 是否提出轻量、可持续的生活建议 |
| 今天路上看到一只特别可爱的猫。 | `casual_chat` | 是否自然接话，而不是强行分析情绪 |
| 不想聊这个了，我们换个话题吧。 | `withdrawal` | 是否尊重用户，不继续追问 |

`other_request` 只用于识别明确但不属于情绪/生活陪伴范围的请求，不应成为产品的核心测试方向。

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

## 回归测试基线

仓库内置 `test/companion-scenarios.json`，用于重复验证陪伴场景中的意图识别、情绪校准、用户边界、人格稳定性、身份诚实和时间感知。场景中的 `checks` 是人工/模型评估标准，不是要求回复逐字匹配的模板。

运行自动化基础测试：

```bash
npm test
```

当前测试覆盖服务端纯函数（接口规范化、JSON 解析、分析枚举校验、时区处理、上下文注入）和场景数据完整性。它们不调用真实模型，也不代表模型回复质量已经通过评估。下一步应在此基线上增加同一场景多配置 A/B 运行、盲评和评分记录，避免仅凭单次主观体验判断 Prompt 是否改善。


## 导入 JSON 并自动逐题测试

页面中间的“批量问题测试”区域支持导入 JSON 测试集。可直接选择：

`examples/companion-regression-suite.json`

导入后点击“按顺序执行”，系统会逐题发送问题；默认勾选“每题独立会话”，避免前一道测试的对话污染下一道测试。取消勾选后则会在同一段连续对话中执行，适合测试多轮关系和上下文连续性。执行中可点击“停止”，当前正在请求的题目结束后停止。全部结束或手动停止后，会自动下载 `dialogue-test-results.json`，保存每题的原始问题、模型回复、动态分析结果和评估检查项。

JSON 支持两种格式：

- 直接使用数组：`[{ "id": "case-1", "userMessage": "你好" }]`
- 使用对象包装：`{ "version": 1, "name": "测试集名称", "cases": [...] }`

每道题至少提供 `userMessage` 或 `prompt`。可选字段包括 `id`、`title`、`category`、`expectedIntent`、`expectedEmotion`、`checks` 和 `timeContext`。其中 `timeContext` 可指定 `timestamp` 与 `timeZone`，用于可重复地测试深夜、傍晚等时间场景。注意：`checks` 是评估提示，不会自动判定模型是否通过；当前版本先收集回复与分析结果，尚未接入自动评分模型。
