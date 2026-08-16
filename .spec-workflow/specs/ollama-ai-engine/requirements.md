# Requirements Document

## Introduction

给 Inkstone（自托管 Markdown 笔记本，整站跑 Cloudflare Workers，线上 https://psn-note.byjs.dev）
加一条**浏览器直连本机 Ollama** 的通道：前端 JS 直接把请求打到用户自己电脑上的
`http://127.0.0.1:11434`，笔记内容不经过 Cloudflare、不经过任何第三方。

本 spec 只交付**引擎与设置面板**——连得上、配得好、连不上时说得清为什么。
调用它的两个功能入口（贴文本转 Markdown、对当前笔记 AI 整理）在 `ai-markdown-entries` spec 里做。

这么切是因为本 spec 可以独立验收：设置页点「测试连接」，能在线上站点拉到本机的模型列表，
就证明 CSP、CORS、传输三层全通了；后面加入口只是薄薄的调用点。

能力来源是同一台机器上的 Convertly（https://convertly.zapboxapp.com 的 AI → Markdown 工具，
仓库 `/home/eason/workflow/cygmris/cikatail/Convertly`，`public/ai.jsx`）。
Convertly 已在生产验证过整条链路，本 spec 把其中与本地 Ollama 相关的部分移植成 TypeScript。

## Alignment with Product Vision

Inkstone 的卖点是「自托管、数据在自己手里」。接本地 Ollama 与这个定位同向：
模型跑在用户自己的机器上，笔记正文一个字节都不出本机。
上游已有的 Workers AI 绑定只用于语义搜索向量，与本功能不冲突、不复用。

## Requirements

### Requirement 1：浏览器能连到本机 Ollama

**User Story:** 作为在自己电脑上用 Chrome 打开 psn-note.byjs.dev 的用户，
我希望页面里的 JS 能直接调用我本机的 Ollama，这样笔记内容不用交给任何云端模型。

#### Acceptance Criteria

1. WHEN 页面从 `https://psn-note.byjs.dev` 加载 THEN Worker 下发的
   `Content-Security-Policy` 的 `connect-src` SHALL 包含
   `http://127.0.0.1:11434` 与 `http://localhost:11434`
2. WHEN 前端向 `http://127.0.0.1:11434/v1/models` 发起请求 THEN 浏览器 SHALL 不因 CSP 阻断该请求
3. IF 本机 Ollama 的 `OLLAMA_ORIGINS` 未包含 `https://psn-note.byjs.dev`
   THEN 预检返回 403，系统 SHALL 把它识别为「CORS 未放行」而不是笼统的「网络错误」
4. `connect-src` 放开的地址 SHALL 仅限上述两个写死的 loopback 端点，
   不接受来自配置或用户输入的任意主机

### Requirement 2：流式对话调用

**User Story:** 作为用户，我希望模型的输出边生成边显示，而不是等几十秒后一次性蹦出来。

#### Acceptance Criteria

1. WHEN 引擎被调用 THEN 它 SHALL 走 OpenAI 兼容端点 `POST /v1/chat/completions` 且 `stream: true`
2. WHEN SSE 响应到达 THEN 解析器 SHALL 正确处理**跨 chunk 被切断的半行**
   （一个 `data:` 行的字节分落在两个网络 chunk 里）
3. WHEN 流结束 THEN 引擎 SHALL 把 `usage` 与 `finish_reason` 一并回传给调用方
4. WHEN 调用方中止（AbortSignal）THEN 引擎 SHALL 立即停止读取并释放连接

### Requirement 3：内容丢失检测（本 spec 的核心风险项）

**User Story:** 作为用户，我绝不接受「模型悄悄吞掉了我半篇笔记而界面一切正常」。

背景（已在 Convertly 实测确认，见 spec 说明）：Ollama 默认 `num_ctx=4096`，
**prompt 与输出共享同一个窗口**；超长时 Ollama 从**输入前端**静默丢弃内容，
且**当输出恰好放得下时 `finish_reason` 仍是 `stop`** —— 只查 `finish_reason` 根本查不出来。

#### Acceptance Criteria

1. WHEN `finish_reason === 'length'` THEN 系统 SHALL 判定为内容丢失
2. WHEN 输出长度显著短于输入长度（独立于 finish_reason 的第二条判据）
   THEN 系统 SHALL 同样判定为内容丢失
3. WHEN 判定为内容丢失 THEN 调用方 SHALL 收到可展示的告警信息，而不是静默通过
4. WHEN 输入超过配置的分片长度 THEN 系统 SHALL 自动分片：
   优先按段落切，段落仍过长按行切，单行仍过长硬切
5. 分片 SHALL 只对首轮原始输入生效；后续指令类输入不切
6. 上述判据与分片逻辑 SHALL 有单元测试，且每条断言 SHALL 通过变异测试
   （故意改坏实现确认测试转红）后才算通过

### Requirement 4：设置面板

**User Story:** 作为用户，我希望在设置里填好地址和模型、点一下就知道通没通，
连不上时告诉我具体是哪一环坏了。

#### Acceptance Criteria

1. 设置面板 SHALL 新增一个分区，与既有的 appearance/editor/backup/sync/mcp/account/data/about 并列
2. WHEN 用户打开该分区 THEN SHALL 可以配置：服务地址、模型、最大输出 token、分片长度、额外提示词
3. WHEN 用户点击「测试连接」THEN 系统 SHALL 请求 `/v1/models` 并把返回的模型填进模型下拉
4. WHEN 连接失败 THEN 系统 SHALL 区分至少三类原因并给出对应文案：
   Ollama 未运行 / `OLLAMA_ORIGINS` 未放行本站 / 浏览器不支持（Safari）
5. 配置 SHALL 持久化在 localStorage，键名 `inkstone_ai_config_v1`，
   读取时对缺失字段做深合并回默认值
6. 默认模型 SHALL 为 `convertly-gemma4`（本机已用 Modelfile 焊入 `PARAMETER num_ctx 16384` 的 tag），
   而不是裸的 `gemma4:e4b`
7. 面板 SHALL 明示本功能仅支持 Chrome/Firefox（Safari 不允许 HTTPS 页面调 `http://localhost`）

### Requirement 5：配置不外泄、不落服务端

#### Acceptance Criteria

1. AI 配置 SHALL 只存在浏览器 localStorage，不写 D1、不经过任何 `/api/` 路由
2. 笔记正文 SHALL 只在浏览器与本机 Ollama 之间传输，不经过 Worker

## Non-Functional Requirements

### Code Architecture and Modularity
- **单一职责**：传输（SSE/HTTP）、丢失防护（判据与分片）、配置持久化、UI 各占独立文件
- **最小侵入**：新增代码全部落在新文件；对既有文件的改动限制在 CSP 一行、设置面板注册、i18n 文案键
- **无注释**：`npm run comments:check` 是白名单制，白名单之外**一行注释都不允许**，
  新代码必须靠命名自解释
- **不做的**：OpenAI / Anthropic 供应商、服务端代理回退
  （Worker 在 Cloudflare 边缘，物理上够不到用户的 loopback，这条路不存在）、多轮追问精修

### Performance
- 首字节到达即开始渲染；不缓冲整个响应
- 设置面板走 lazy import，不进主 bundle（与 `McpSettings` 同款）

### Security
- CSP 只放开两个写死的 loopback 端点，不因本功能开放任意外部主机
- 不新增任何服务端路由、不新增任何后端凭据

### Reliability
- 连接失败要能说出**是哪一环**，而不是笼统报错——这是本功能最高频的用户问题
- 内容丢失必须报警，宁可误报也不能漏报

### Usability
- 浏览器限制（Chrome/Firefox）写在界面上，不能只写在文档里
- 中英双语文案齐全（`npm run i18n:check` 是硬门）
