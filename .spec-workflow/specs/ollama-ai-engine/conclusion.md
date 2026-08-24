# Conclusion: ollama-ai-engine

## 目标达成

需求 1–5 全部达成，其中需求 1 的验收链条被拆成了两半（见「已知边界」）：
CSP、CORS、传输三层各自都已实测通过，但**三层在真实 HTTPS 站点上同时跑通**这一步
卡在浏览器权限而非代码，需要用户手动授权一次。

需求 3（内容丢失检测）是本 spec 的核心风险项，全部达成并做了变异测试。
需求 4.4「连接失败要能说出是哪一环」在线上暴露了一个缺口——请求挂起时既说不出哪一环、
也说不出失败了——已由任务 9 补齐（12 秒超时 + 专门文案）。

## 交付结论

浏览器直连本机 Ollama 的引擎与设置面板。**笔记正文不经过 Cloudflare，不发给任何第三方模型。**

| 交付 | 位置 |
| --- | --- |
| CSP 放行两个写死的 loopback 端点 | `src/worker/app.ts:24,42` |
| 配置持久化（localStorage `inkstone_ai_config_v1`） | `src/client/lib/ai/config.ts` |
| 防丢失：`detectLoss` 双判据 + `splitForChunking` 三级降级 | `src/client/lib/ai/guard.ts` |
| SSE 流式 `streamMarkdown` / `listModels` / `classifyAiError` | `src/client/lib/ai/ollama.ts` |
| 「Local AI」设置分区（lazy） | `src/client/features/settings/AiSettings.tsx` |
| 中英文案 27 组 | `src/shared/locales/{en-US,zh-CN}.ts` |

边界：**只支持 Ollama 一个 provider**。没有 OpenAI/Anthropic，没有服务端代理回退
（Worker 在 Cloudflare 边缘，物理上够不到用户的 loopback，这条路不存在），没有多轮追问精修。

## 验收证据

- 五道门全部**实测**退出码 0：`typecheck` / `test:unit`（**实测** 10 files / 112 tests）/
  `i18n:check`（**实测** 1117 keys）/ `comments:check`（**实测** 77 条白名单注释，新代码零注释）/ `deploy:check`
- CSP：`wrangler dev --local` 上 `curl -sI` **实测**取到
  `connect-src 'self' http://127.0.0.1:11434 http://localhost:11434`；
  线上 `https://psn-note.byjs.dev/` 同样**实测**取到该值
- CORS：`curl -i -X OPTIONS ... -H "Origin: https://psn-note.byjs.dev"` **实测** 204 +
  `Access-Control-Allow-Origin: https://psn-note.byjs.dev`；同时**实测**确认 Convertly 的两个域名未被冲掉（仍 204）
- 传输：本地 `http://127.0.0.1:8788` 页面点「测试连接」**实测**拉到 5 个模型
  （bge-m3:latest / convertly-gemma4:latest / gemma4:12b-it-qat / gemma4:e4b / qwen2.5:7b-instruct）
- 变异测试**实测** 32/32 全部转红（guard+config 14、ollama 18），
  每轮结束 `git diff --stat` 均为 clean
- 超时路径：线上**实测** 12005 ms 后给出可操作文案，不再无限转圈

## 预估 vs 实测

| 项 | 预估 | 实测 | 差因 |
| --- | --- | --- | --- |
| 新增文件 | 4 源 + 3 测试 = 7 | 4 源 + 3 测试 = 7 | 一致 |
| 改动既有文件 | 4 | 5（多了 `ollama.ts` 自身被 i18n 门逼着改） | 见下「中文常量」一条 |
| 新增代码量 | 500–650 行（含测试） | 约 900 行（含测试） | 低估。主要在 `ollama.test.ts`——SSE 跨 chunk、流式、分片、中止各要一套 mock，测试比实现长 |
| 任务数 | 7 | 9 | 线上发现挂起缺陷，加了任务 9；任务 8 拆不动只能挂起 |
| 押：CSP 放行后 Chrome 不再拦 | 未直接实测，依据 Convertly 生产可用 | **押错了一半**：CSP 确实不拦了，但 Chrome 138+ 另有一道 Local Network Access 权限 | 见「已知边界」 |
| 押：Chrome PNA 不会额外拦截 | 未实测，依据 Convertly 当前可用 | **押错**：Convertly 现在同样被拦（同一浏览器实测复现），说明它是**后来才被 Chrome 拦上的**，不是我们的回归 | 依据本身过期了——「它现在能用」这条证据当时没有重新验证 |
| 押：设置面板能照抄 McpSettings | 已读代码未实跑 | 成立 | — |

## 未达标项（及为何不下调标准）

无未达标项，但有一条**没有下调的标准值得记**：任务 9 本可以不做——
「用户自己会发现 Ollama 没起」听起来也说得过去。但需求 4.4 白纸黑字要求
「连接失败要能说出是哪一环」，而无限转圈**连失败都说不出**。
没有把 4.4 解释成「尽力而为」，而是加了超时补齐它。

## 门控与搁置项的实证依据

- **不做服务端代理回退**：不是取舍，是物理不可能。Worker 跑在 Cloudflare 边缘，
  到不了用户的 `127.0.0.1`。这决定了 CSP 放行不是优化项而是唯一路径。
- **不做多 provider / 不引入 provider 接口层**：需求明确只要本地 Ollama，
  一个实现引接口层属于反抽象。
- **默认模型选 `convertly-gemma4` 而非全局 `OLLAMA_CONTEXT_LENGTH`**：
  本机 `:11434` 被 mcp-memory-service 共用（bge-m3 + qwen2.5:7b-instruct），
  全局改窗口会撑大它们的 KV cache。Modelfile 焊入只影响这一个 tag。
- **超时只加在连接测试，不加给 `streamMarkdown`**：生成本来就可能很慢，
  加超时会误杀正常长任务。
- **删掉两行冗余代码而不是给它们补断言**（`:` 注释行判断、去尾 `\r`）：
  变异测试显示改坏它们测试不红，查明是 `data:` 前缀检查与 `.trim()` 已经覆盖了它们的作用。
  给一段不产生任何影响的代码补断言，等于把测试写成实现的镜子。

## 已知边界

- **Chrome 138+ 的 Local Network Access 权限未授予时，公网 HTTPS 页面访问 `127.0.0.1`
  的请求会挂起而不是报错**（既不 resolve 也不 reject，控制台无任何输出）。
  需要用户在浏览器里点一次「允许」，自动化点不了浏览器 UI 的权限气泡。
  **这条同样影响用户既有的 Convertly**（同一浏览器实测复现），不是本项目引入的问题。
  2026-08-24 复测：该权限已由用户授予，`navigator.permissions.query({name:'local-network-access'})`
  返回 **`granted`**，页面直连 `127.0.0.1:11434` 实测 200 / 17ms / 5 个模型，任务 8 已据此关闭。
  **判据留在这里不是历史包袱**：换浏览器、换 profile、清站点数据都会让它退回 `prompt`，
  届时症状仍是「什么都不发生」，先查这一条。
- 仅支持 Chrome / Firefox。Safari 不允许 HTTPS 页面调 `http://localhost`，已在界面明示。
- `src/worker` 依赖 `cloudflare:` 协议模块，本仓 vitest 没配 workers pool，
  **Worker 侧无法写集成测试**。CSP 这类改动只能靠 `wrangler dev` + `curl` 实测验证。
- 本机实际模型 tag 是 `convertly-gemma4:latest`，默认值填的是省略 tag 的 `convertly-gemma4`。
  Ollama 按 `:latest` 解析，实测通过；若将来遇到严格匹配的场景需要补全后缀。
