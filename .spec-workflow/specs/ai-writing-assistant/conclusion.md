# Conclusion: ai-writing-assistant

## 目标达成

需求 1–7 全部达成并在生产站点实测通过。三个文本动作（选区改写 / 撰写 / 续写）
流式写进编辑器，外加 Workers AI 文生图。

**但本轮最该被记住的不是"做完了"，而是：三个真 bug 全部由线上验收发现，
单元测试一个都没抓到——而且其中两个是被单测"保护"过的。**

## 交付结论

| 交付 | 位置 |
| --- | --- |
| 流式落笔的事务模型（心脏） | `features/ai/stream-writer.ts` |
| 动作定义与提示词（纯函数） | `features/ai/writing-prompts.ts` |
| 编排 | `features/ai/use-writing-action.ts` |
| 选区气泡（只选动作） | `features/ai/SelectionBubble.tsx` |
| 进行态 + 落笔（常驻） | `features/ai/WritingStatusBar.tsx` |
| 撰写/自定义指令输入 | `features/ai/PromptDialog.tsx` |
| 图片对话框与请求 | `features/ai/ImageDialog.tsx`、`image-request.ts` |
| 图片路由 | `worker/routes/ai.ts` 的 `POST /api/ai/image` |

**不引入任何新密钥**：文本沿用既有两个供应商，图片用 Worker 的 `AI` 绑定
（`@cf/black-forest-labs/flux-1-schnell`），存储复用既有 R2 附件链路，零新存储代码。
**引擎零改动**：`streamMarkdown` / SSE / `detectLoss` / `splitForChunking` /
`guard.ts` / `lib/ai/config.ts` 一行未动。

## 验收证据

- 五道门实测 exit 0（`test:unit` **18 files / 225 tests**）
- 反向验证 **14 条**（11 条主轮 + 图片头 1 条 + 落笔恒不为空 1 条 + 气泡宽度上限 1 条），全部转红
- 线上 A–K 全部通过，关键实测数字：
  - **一次 `Ctrl+Z` 只撤 AI 段**，用户自己敲的字仍在（design 阶段实测发现的缺陷，线上确认未发生）
  - **流式逐字可见**：120ms 采样测到 17 个不同长度，84→…→1857
  - **取消零痕迹**：写到 214 字符点停 → 正文逐字回到 84（`identical: true`）
  - **图片**：2.8s 出图，落库实测 `200 / image/jpeg / 790358 字节 / magic ff d8 ff e0`
  - **移动端**：390 视口下气泡 `left:8 right:382`，不溢出、页面不横向滚
  - **两个供应商**：Cloudflare 与本地 Ollama（21.4s / 1004 字符）都实跑过

## 预估 vs 实测

| 项 | 预估 | 实测 | 差因 |
| --- | --- | --- | --- |
| 新增文件 | 10（7 源 + 3 测试） | **12**（8 源 + 4 测试） | 多了 `writing-intent.ts`（触发收敛）与 `failure-message.ts`（抽共用）、`writing-status.test.ts` |
| 改动既有文件 | 6 + locales | **8 + locales** | 多了 `paste.ts`（导出 `escapeMarkdownLabel`）与 `AiPanel.tsx`（改用共用错误文案） |
| 新增代码量 | 1000–1300 行 | **约 1460 行** | 超出约 12%，主要是三轮 bug 修复各自补的断言 |
| 任务数 | 12 | 12 | 一致 |
| 押：流式期间不产生撤销步 | 已实跑 | 成立 | — |
| 押：取消零痕迹 | 已实跑 | 成立，线上复验 | — |
| 押：落笔 = 一步撤销 | 实跑推翻 naive 版 | 成立（`isolateHistory` 必需） | design 阶段就抓到了 |
| 押：`flux-1-schnell` 可用且免费 | 已实跑 REST | 成立 | — |
| 押：`env.AI.run` 形状 == REST 形状 | **未验，故四种都归一** | **仍未直接观测**，但链路通、落库是合法 JPEG | 归一策略让"不知道"也能安全 |
| 押：`Menu` 点锚点够用 | 未实跑 | 成立 | — |
| 押：`coordsAtPos` 坐标可用 | 未验 | 成立 | — |
| 押：**落笔按钮放气泡上就够了** | 想当然 | ❌ **线上推翻** | 见下 Bug 1 |
| 押：**气泡宽度约 360** | 硬编码 | ❌ **线上推翻，真实 691** | 见下 Bug 3 |

## 三个 bug，以及它们为什么单测抓不到

### Bug 1 — 撰写与续写生成完之后无法落笔（最严重）

续写生成 84 字符，**没有任何落笔 UI**。根因：落笔按钮当时只在选区气泡上，
而气泡在选区为空时不渲染 —— 撰写/续写根本没有选区。
生成的文本按设计是"静默写入"（不进历史、不触发保存），于是它
**看得见、保不住、刷新即失，而且看起来像已经写进笔记了**。

**为什么单测抓不到**：`stream-writer` 的 11 条断言全绿，因为事务模型本身完全正确。
错的是**没有任何 UI 去调用 `commit`**。单测验的是"调用了会怎样"，
而 bug 是"根本不会被调用"。

修法：落笔移到常驻状态条，`reviewModes(state)` **恒不为空**，并把这条写成断言。

### Bug 2 — 图片请求被 403 挡下

`requestImage` 用裸 `fetch`，绕过 `lib/api.ts` 统一加 `X-Inkstone-Client` 的路径。
**本仓 `/api/ai/chat` 早前踩过同一个坑**——说明"新写一条请求"时最容易漏的，
就是这类由公共 `request()` 代劳的横切头。

### Bug 3 — 气泡在手机宽度下溢出屏幕（最有教育意义）

390px 视口下气泡宽 **691px**，右边到 713。夹取数学没错，
错在喂给它的是硬编码的 `ESTIMATED_WIDTH = 360`。

🔴 **而 `bubblePosition` 的 6 条单测全绿——因为单测用的也是我那个假设值 360。**
测试与实现共用同一个错误假设时，断言写多少条都没用：它验的是数学，而错的是输入。

⇒ **这三个 bug 的共同点**：都不在"逻辑算错"这一层，而在
**"接线没接上"「假设与现实不符」「谁去调用它」**。这类问题单测结构上就看不见，
只能靠在真环境里把功能从头点一遍。

## 过程中的两次工具性教训

1. **变异测试必须有可还原的基线。** 头两条变异跑完想 `git checkout` 还原，
   报 `did not match any file(s) known to git`——文件是本轮新建、**还没提交过**。
   若不是命令报错，改坏的实现会静默留在树里。后来先提交建立还原点再继续。
2. **反过来也会咬人**：文件**有未提交改动**时 `git checkout` 会"成功"地
   还原到旧版，把刚写的修复冲掉（实际发生了一次，4/4 转红才察觉）。
   ⇒ 变异还原只有两种安全姿势：**手工反向替换**，或**先提交再变异**。

## 已知边界（有意不做 / 仍未验）

- **不做多轮追问**：`streamMarkdown` 的 `history` 已预留，交互复杂度不属于本轮
- **图片只支持一个模型**：`flux-2-klein-*` 要 multipart 是另一套契约；
  `leonardo/*` 有真实标价（每 512×512 tile $0.007）属付费，排除
- **图片只有 Cloudflare 有**：Ollama 不具备文生图能力，这是能力边界不是配置缺失
- **续写会被模型辜负**：实测 qwen3-30b 有时把原文整段重复，
  尽管提示词明写 `Do not repeat` / `do not start over`。提示词已尽力，模型没遵守
- **仍未验**：气泡与 `search({top:true})` 浮层是否打架；
  分片（>6000 字符）下的 `Part n of m`；
  Worker 侧 `normalizeImageResult` 具体走哪个分支（只间接证明链路通）
