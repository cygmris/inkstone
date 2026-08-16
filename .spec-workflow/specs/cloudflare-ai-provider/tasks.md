# Tasks Document

> 前置：`ollama-ai-engine` 与 `ai-markdown-entries` 已交付。本 spec 只加第二个供应商。

- [x] 1. 允许清单（前后端共用一份）
  - File: src/shared/ai-models.ts（新建）、src/shared/ai-models.test.ts（新建）
  - 7 个免费额度内的模型，id 逐字对齐官方文档；默认 `@cf/qwen/qwen3-30b-a3b-fp8`
  - `isAllowedCloudflareModel` 拒绝清单外的任意字符串
  - **不收录**需付费的 5 个（kimi-k2.6 / kimi-k2.7-code / glm-5.2 / deepseek-v4-flash-0731 / deepseek-v4-pro-0813）
  - Purpose: 服务端拿它挡非法模型，客户端拿它填下拉。放两份必然漂移成「界面能选、服务端拒绝」
  - _Leverage: 无_
  - _Requirements: 1.6, 3.5_
  - _Prompt: Implement the task for spec cloudflare-ai-provider, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript 开发者 | Task: 新建 src/shared/ai-models.ts 与单测，满足需求 1.6/3.5 | Restrictions: 必须放 src/shared/ 供前后端共用，不许前后端各存一份；不收录需付费的 5 个模型；模型 id 逐字照抄官方文档不许凭记忆拼；不加注释 | Success: 单测覆盖「默认模型在清单内」「拒绝任意字符串」「拒绝付费模型 id」并通过_

- [x] 2. Workers AI 流转换器（本 spec 的核心风险项）
  - File: src/worker/lib/workers-ai-stream.ts（新建）、workers-ai-stream.test.ts（新建）
  - `extractDelta`：**两种上游形状都吃** —— `{response}` 与 `{choices:[{delta:{content}}]}`，无法识别返回 null
  - `transformWorkersAiStream`：逐行读上游 SSE → 转成 OpenAI delta 形状 → 收尾补 `data: [DONE]`
  - 跨 chunk 半行缓冲，与客户端 `readSseStream` 同款
  - 🔴 **不得 import 任何 `cloudflare:` 协议模块**，否则本仓 vitest 加载不了（没配 workers pool）
  - Purpose: 让客户端的 SSE 解析器与 streamMarkdown 一行都不用改
  - _Leverage: src/client/lib/ai/ollama.ts 的 readSseStream 缓冲思路_
  - _Requirements: 2.2, 2.3, 2.4, 2.5_
  - _Prompt: Implement the task for spec cloudflare-ai-provider, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端/边缘运行时工程师，擅长 Web Streams | Task: 新建 workers-ai-stream.ts 实现两种上游形状兼容的转换器，满足需求 2.2–2.5，并写单测 | Restrictions: 绝不赌单一上游形状——官方文档说法不一致且可能随模型而异；无法识别的 chunk 跳过而不是抛错；不得 import cloudflare: 模块；不加注释 | Success: 单测覆盖两种形状、跨 chunk 半行、[DONE] 收尾、无法识别的 chunk 被跳过且不中断流_

- [x] 3. 对任务 1、2 的单测做变异测试
  - File: src/shared/ai-models.ts、src/worker/lib/workers-ai-stream.ts（临时改坏后还原）
  - 至少覆盖：两种形状的提取各自失效、[DONE] 不发、跨 chunk 不缓冲、无法识别的 chunk 改为抛错、允许清单校验永远通过
  - Purpose: 新写的断言可能根本没有能力失败
  - _Leverage: 任务 1、2 的测试文件_
  - _Requirements: 2.5_
  - _Prompt: Implement the task for spec cloudflare-ai-provider, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 测试工程师 | Task: 逐个改坏实现确认对应用例转红后还原 | Restrictions: 逐个做逐个还原；最终 git diff 中实现文件必须无残留；变异存活时先分清是「测试没覆盖」还是「这段代码本来就不做事」——后者应删代码而不是补断言 | Success: 全部变异被杀，git diff clean_

- [x] 4. 服务端路由 POST /api/ai/chat
  - File: src/worker/routes/ai.ts（新建）、src/worker/app.ts（修改，注册路由一行 + import）
  - `requireAuth`；校验模型在允许清单内；`env.AI` 缺失返回 503
  - `env.AI.run<ReadableStream>(model, { messages, stream: true, max_tokens })` → 接转换流 → `text/event-stream`
  - Purpose: 让浏览器只跟自己的站点说话，绕开一切浏览器权限与 CORS
  - _Leverage: src/worker/routes/tags.ts 的 requireAuth 写法；lib/errors 的 ApiError；lib/request 的 readJson_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1_
  - _Prompt: Implement the task for spec cloudflare-ai-provider, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Cloudflare Workers 后端工程师 | Task: 新建 ai.ts 路由并在 app.ts 注册，满足需求 1.1–1.6、2.1 | Restrictions: 不得新增任何密钥或环境变量（AI 绑定已存在）；模型必须走允许清单校验，绝不透传任意字符串——否则本路由会变成打任意 Workers AI 模型的开放代理；路由要薄，解析逻辑留在 workers-ai-stream.ts；不加注释 | Success: npm run typecheck 与 deploy:check 通过；未登录返回 401；非法模型返回 400_

- [x] 5. 客户端供应商切换与设置面板
  - File: src/client/lib/ai/config.ts（修改）、ollama.ts（修改，仅 URL 分派）、features/settings/AiSettings.tsx（修改）、locales×2（修改）
  - config 加 `provider`（默认 `'ollama'`）与 `cloudflareModel`
  - ollama.ts 抽 `resolveEndpoint()`，provider 分派**只出现在这一处**；云端模式下 `listModels` 直接返回允许清单，不发请求
  - 设置面板：供应商切换、云端模型下拉、**明写「笔记内容会发送到 Cloudflare」**、云端模式隐藏服务地址与连接测试
  - Purpose: 让用户在知情下选便利，而不是替他默默选
  - _Leverage: AiSettings 既有的 SettingRow / Select / Switch；shared/ai-models 的清单_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 5.1, 5.2, 6.2, 6.3_
  - _Prompt: Implement the task for spec cloudflare-ai-provider, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 加 provider 切换与云端设置项，满足需求 3.x、4.x、5.x、6.2/6.3 | Restrictions: 默认必须是 ollama，绝不把云端设成默认；隐私代价必须写在界面上不能只写文档；provider 分派只许出现在 resolveEndpoint 一处，不许 'cloudflare' 这个字符串散落各处；**guard.ts / AiPanel.tsx / request.ts / EditorToolbar.tsx / CommandPalette.tsx 一律不许改**；不加注释 | Success: 五道门全绿；切到云端后设置页不再显示服务地址与连接测试_

- [x] 6. 全量门禁
  - File: 无（跑命令）
  - typecheck / test:unit / i18n:check / comments:check / deploy:check，记录实际输出
  - _Leverage: package.json 既有 scripts_
  - _Requirements: 全部_
  - _Prompt: Implement the task for spec cloudflare-ai-provider, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 发布工程师 | Task: 跑齐五道门并记录实际输出 | Restrictions: 不得为了让门变绿而放宽门本身 | Success: 五条命令全部退出码 0_

- [x] 7. 线上验收（含实测上游 chunk 真实形状）
  - File: 无（部署 + 人工验证）
  - A. 切到云端供应商 → convert 一段短文本 → 流式出结果 → 落成笔记
  - B. 🔴 **实测记录 Workers AI 上游 chunk 的真实形状**，写进实现日志与 conclusion
    （design 里这条明确标了「不确定，两种都实现」，必须回填实测结果）
  - C. 切回本地供应商 → 行为与之前一致（回归）
  - D. 请求一个不在清单里的模型 → 400
  - E. 若撞到额度耗尽 → 记录实际错误形状并按实际补文案（**不预先编造判据**）
  - Purpose: 上游形状与额度错误形状都只能实测得知
  - _Leverage: 无_
  - _Requirements: 1.6, 2.1, 2.3, 4.1_
  - _Prompt: Implement the task for spec cloudflare-ai-provider, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA 工程师 | Task: 部署后逐条跑 A–E 并记录实际结果 | Restrictions: 验证前必须清 Service Worker；B 项必须记录真实观测到的 chunk 形状，不许写「应该是 X」；E 项没撞到就如实写「未撞到，未验证」，不许编造 | Success: A–D 有明确结论；B 项记录了实测形状_
