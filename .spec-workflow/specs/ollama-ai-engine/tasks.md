# Tasks Document

- [x] 1. 放开 CSP 的 connect-src 到本机 loopback
  - File: src/worker/app.ts（修改既有，约 1 行）
  - 在 CSP 字符串里把 `connect-src 'self'` 改为 `connect-src 'self' http://127.0.0.1:11434 http://localhost:11434`
  - 两个端点写死，不从配置或用户输入取值
  - Purpose: 让浏览器允许页面直连本机 Ollama。没有这一步整个功能不可能工作，且无服务端代理退路
  - _Leverage: src/worker/app.ts 既有的 CSP 中间件_
  - _Requirements: 1.1, 1.2, 1.4_
  - _Prompt: Implement the task for spec ollama-ai-engine, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Cloudflare Workers 安全工程师 | Task: 修改 src/worker/app.ts 的 CSP 响应头，让 connect-src 除 'self' 外额外允许 http://127.0.0.1:11434 与 http://localhost:11434，满足需求 1.1/1.2/1.4 | Restrictions: 只改这一条指令，其他 CSP 指令与其他安全响应头一律不动；端点必须硬编码，绝不接受配置或用户输入拼接；不加任何注释（npm run comments:check 是白名单制） | Success: npm run typecheck 通过；npm run comments:check 通过；本地 npm run dev 起站后响应头里 connect-src 含两个 loopback 端点_

- [x] 2. AI 配置模块与单测
  - File: src/client/lib/ai/config.ts（新建）、src/client/lib/ai/config.test.ts（新建）
  - 定义 AiConfig 类型、DEFAULT_AI_CONFIG、getAiConfig/setAiConfig，localStorage 键 inkstone_ai_config_v1
  - 默认：baseUrl `http://127.0.0.1:11434/v1`、model `convertly-gemma4`、maxTokens 8192、chunkChars 6000、extraInstruction ''、strictConvert true
  - 读取时逐字段深合并回默认值；脏 JSON 回默认值不抛
  - Purpose: 给引擎和面板一个可靠的配置来源，且不落服务端
  - _Leverage: 无（纯模块）_
  - _Requirements: 4.5, 4.6, 5.1_
  - _Prompt: Implement the task for spec ollama-ai-engine, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript 开发者 | Task: 新建 src/client/lib/ai/config.ts 实现 AiConfig 类型与 localStorage 持久化（键 inkstone_ai_config_v1，深合并默认值），默认模型必须是 convertly-gemma4 而非 gemma4:e4b（前者焊入了 num_ctx 16384），满足需求 4.5/4.6/5.1；同时写 config.test.ts | Restrictions: 不得写入任何 /api/ 路由或数据库；不加注释；严格 TS 无 any；localStorage 不可用时不得抛异常 | Success: npm run test:unit 中该文件全部用例通过（空存储/部分字段/脏 JSON/回读一致）；npm run typecheck 通过_

- [x] 3. 防丢失模块 guard.ts 与单测（本 spec 的核心风险项）
  - File: src/client/lib/ai/guard.ts（新建）、src/client/lib/ai/guard.test.ts（新建）
  - detectLoss 双判据：finish_reason === 'length' → truncated；首轮且输入 ≥ 200 字符且输出 < 输入 × 0.5 → short
  - splitForChunking 三级降级：段落（`\n{2,}`）→ 行 → 硬切，贪心打包，limit ≤ 0 关闭，过滤纯空白片
  - 逻辑逐条对照 /home/eason/workflow/cygmris/cikatail/Convertly/public/ai.jsx 的同名函数移植，不重新设计
  - Purpose: Ollama 会从输入前端静默丢内容且 finish_reason 仍报 stop——笔记应用里这等于用户悄无声息丢掉半篇笔记
  - _Leverage: Convertly public/ai.jsx 的 detectLoss / splitForChunking_
  - _Requirements: 3.1, 3.2, 3.4, 3.5_
  - _Prompt: Implement the task for spec ollama-ai-engine, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师，擅长纯函数与边界条件 | Task: 新建 src/client/lib/ai/guard.ts，把 Convertly public/ai.jsx 的 detectLoss 与 splitForChunking 逐条移植为 TS 纯函数（常量 SHORT_OUTPUT_RATIO=0.5、SHORT_OUTPUT_MIN_INPUT=200），满足需求 3.1/3.2/3.4/3.5；同时写 guard.test.ts | Restrictions: 不得重新设计判据或分片策略——这些编码的是只能靠实测发现的 Ollama 行为；纯函数不得有 IO 或全局状态；不加注释 | Success: 单测覆盖 truncated/short/输入过短/非首轮/正常 五种 detectLoss 情形与 limit=0、恰好等于 limit、段落切、单段超长按行切、单行超长硬切 五种分片情形，全部通过_

- [x] 4. 对 guard 与 config 单测做变异测试
  - File: src/client/lib/ai/guard.ts、config.ts（临时改坏后还原，最终无改动）
  - 逐条断言：故意改坏对应实现（如把 0.5 改成 0、把 finish_reason 判定去掉、把段落分隔正则改成不匹配），确认对应用例转红，再还原
  - 把做过哪些变异、各自转红情况写进 log-implementation 的 verification
  - Purpose: 新写的断言可能根本没有能力失败；不做这一步「测试绿」不构成证据
  - _Leverage: 任务 2、3 的测试文件_
  - _Requirements: 3.6_
  - _Prompt: Implement the task for spec ollama-ai-engine, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 测试工程师 | Task: 对任务 2、3 写的每条关键断言做变异测试，逐个改坏实现确认测试转红后还原，满足需求 3.6 | Restrictions: 变异必须逐个做并逐个还原，不得批量改；最终工作树必须与变异前逐字节一致（git diff 为空）；不得为了让测试转红而修改测试 | Success: 每条关键断言都有一次确认转红的记录；git diff 显示实现文件无残留改动；npm run test:unit 全绿_

- [x] 5. Ollama 传输模块 ollama.ts 与 SSE 单测
  - File: src/client/lib/ai/ollama.ts（新建）、src/client/lib/ai/ollama.test.ts（新建）
  - streamMarkdown：POST /v1/chat/completions，stream: true，按 chunkChars 分片（仅首轮），逐 token 回调，结束时算 detectLoss 并把 usage/finishReason/loss 一并返回
  - SSE 解析：跨 chunk 半行、`[DONE]`、`:` 注释行、非 JSON 行、无尾换行末行
  - listModels：GET /v1/models
  - classifyAiError：aborted / offline / cors / unsupported-browser / http / unknown
  - 系统提示词从 Convertly 的 AI_DEFAULT_SYSTEM_PROMPT、AI_GUARD_INSTRUCTION、AI_TIDY_SYSTEM_PROMPT、aiChunkNotice 移植
  - Purpose: 与本机 Ollama 对话的唯一通道
  - _Leverage: src/client/lib/ai/config.ts, guard.ts；Convertly public/ai.jsx 的 _parseSSE / _streamOpenAICompat_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3, 4.4_
  - _Prompt: Implement the task for spec ollama-ai-engine, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师，擅长 fetch streaming 与 SSE | Task: 新建 src/client/lib/ai/ollama.ts 实现 streamMarkdown / listModels / classifyAiError 与系统提示词常量，SSE 解析逻辑照搬 Convertly 的 _parseSSE，满足需求 2.1–2.4、3.3、4.4；同时写 ollama.test.ts 重点覆盖跨 chunk 半行 | Restrictions: 只支持 Ollama 一个 provider，不得引入 provider 接口层或策略分派；不得实现 Anthropic/OpenAI/代理回退；classifyAiError 对 offline 与 cors 不得假装能精确二选一（浏览器里两者同形），文案要同时列出两种可能；不加注释 | Success: SSE 跨 chunk 用例通过；npm run typecheck 通过；AbortSignal 能立即中止_

- [x] 6. AI 设置面板与文案
  - File: src/client/features/settings/AiSettings.tsx（新建）、src/client/features/settings/SettingsPanel.tsx（修改）、src/shared/locales/en-US.ts 与 zh-CN.ts（修改）
  - 面板：服务地址、模型（下拉 + 手填）、最大输出 token、分片长度、附加提示词、strictConvert 开关、「测试连接」按钮
  - 测试连接成功后把 /v1/models 结果填进模型下拉；失败按 classifyAiError 给对应文案
  - 面板内明示仅支持 Chrome/Firefox
  - SettingsPanel：Section 联合类型加 'ai'、SECTIONS 数组加一项、lazy 导入（照抄 McpSettings 写法）
  - Purpose: 让用户配得好、连不上时知道是哪一环
  - _Leverage: src/client/features/settings/McpSettings.tsx（骨架）、components/form 的 Input/SettingRow/Switch、components/primitives 的 Button/Badge、store/ui 的 toast、lib/i18n 的 t_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_
  - _Prompt: Implement the task for spec ollama-ai-engine, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 新建 AiSettings.tsx 并在 SettingsPanel.tsx 注册为 lazy 分区，加中英文案，满足需求 4.1–4.4、4.7 | Restrictions: 必须复用 components/form 与 primitives 的既有控件，不得自造样式体系；对 SettingsPanel.tsx 的改动限制在 Section 类型、SECTIONS 数组、lazy 导入三处；所有面向用户的字符串必须走 t() 且中英双语齐全；不加注释 | Success: npm run i18n:check 通过；npm run typecheck 通过；npm run comments:check 通过；本地起站后设置里出现 AI 分区且控件渲染正常_

- [x] 7. 全量门禁与部署前检查
  - File: 无新增（跑命令）
  - 依次跑 npm run typecheck、npm run test:unit、npm run i18n:check、npm run comments:check、npm run deploy:check
  - 把每条命令的实际输出记进 log-implementation 的 verification
  - Purpose: 上游这些门是真会红的，且 comments:check 与 i18n:check 特别容易被新代码触发
  - _Leverage: package.json 既有 scripts_
  - _Requirements: 全部_
  - _Prompt: Implement the task for spec ollama-ai-engine, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 发布工程师 | Task: 跑齐 typecheck / test:unit / i18n:check / comments:check / deploy:check 五道门并记录实际输出 | Restrictions: 不得为了让门变绿而放宽门本身（不得改 check 脚本的白名单去容纳新注释——应当删注释）；任何一条红了必须修代码而不是跳过 | Success: 五条命令全部退出码 0，输出已记入实现日志_

- [ ] 8. 线上验收：CSP + CORS + 传输三层同时通
  - File: 无（部署 + 人工验证）
  - 前置：本机 Ollama 的 OLLAMA_ORIGINS 追加 https://psn-note.byjs.dev
    （~/.config/systemd/user/ollama.service.d/override.conf → systemctl --user daemon-reload && restart）
  - 验证 A：curl -i -X OPTIONS http://127.0.0.1:11434/v1/chat/completions -H "Origin: https://psn-note.byjs.dev" -H "Access-Control-Request-Method: POST" → 204 + Access-Control-Allow-Origin 匹配
  - 验证 B：CLOUDFLARE_EMAIL=$CF_EMAIL CLOUDFLARE_API_KEY=$CF_KEY npm run deploy
  - 验证 C：Chrome 打开 https://psn-note.byjs.dev（先清 Service Worker，PWA 会缓存旧 bundle）→ 设置 → AI → 点「测试连接」→ 模型下拉出现本机模型
  - Purpose: 这三层只有在真实 HTTPS 站点上才同时成立，本地开发环境验不了
  - _Leverage: 无_
  - _Requirements: 1.2, 1.3, 4.3_
  - _Prompt: Implement the task for spec ollama-ai-engine, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 运维工程师 | Task: 配好 OLLAMA_ORIGINS、部署 Worker、在 Chrome 上验证测试连接能拉到模型列表，满足需求 1.2/1.3/4.3 | Restrictions: 部署必须用 Global API Key（CF_DNS_TOKEN 权限不够）；验证前必须清 Service Worker，否则跑的是旧 bundle 会得出错误结论；OLLAMA_ORIGINS 是追加不是替换，不要覆盖掉 Convertly 的域名 | Success: 三条验证都拿到预期结果并把实际输出记入实现日志；未通过则保持 [~] 并写明 Blocked 原因_
