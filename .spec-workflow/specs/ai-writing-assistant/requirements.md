# Requirements Document

## Introduction

现有 AI 功能（`ollama-ai-engine` / `ai-markdown-entries` / `ai-summary-and-title`）解决的都是
**"已经有一坨文本了，把它改造成更好的样子"**：转换、整理、摘要、标题。四个动作有一个共同前提——
**内容已经写完了**。

本 spec 补的是另一半：**写的过程中**。用户在写文章时会卡住、会想不出怎么展开、会觉得某段太啰嗦、
会想换个说法。这时候需要的不是"把已有内容重排"，而是**就地生成新文本**。

参照对象是上游 PR shuaiplus/inkstone#2 暴露出来的需求（**只借需求，不用其代码**——见「设计边界」）。
它的实现路子与本项目冲突：把 OpenAI API Key 存在服务端（改 credential-vault 与 crypto）、owner-only。
本项目两个供应商**都不需要任何密钥**（本地 Ollama 浏览器直连、Workers AI 是平台绑定），
跟着它走等于凭空引入一个密钥保管面。

三个文本动作：**选区改写**（写长/写短/换语气/翻译/修语法/自定义指令）、**光标处撰写**（给主题，生成一篇）、
**续写**（读上文，接着往下写）。全部**流式写进编辑器**，边生成边看见，随时可取消。

外加**图片生成**（需求 7）：一句提示词生成配图并插入笔记。它与上面三个不同——
文生图必须在服务端调 `AI` 绑定，且**只有 Cloudflare 供应商有**（Ollama 不做文生图）。
但仍然**不引入任何新密钥**：用的是既有的 `AI` 绑定，存储复用既有 R2 附件链路。

## Alignment with Product Vision

本项目没有 `.spec-workflow/steering/`，故对齐依据取自既有三个 spec 的 conclusion 与本仓 CLAUDE.md：

- **不引入新密钥面**：沿用既有 `provider` 抽象（`resolveChatEndpoint` / `activeModel` / `chatHeaders`），
  两个供应商都不需要用户配置密钥。
- **引擎零改动**：`streamMarkdown` / SSE 解析 / `detectLoss` / `splitForChunking` 已被三个 spec 反复验证，
  本 spec 只调用不修改。
- **上游兼容**：本仓是 `shuaiplus/inkstone` 的自维护 fork，需过 `comments:check`（注释白名单，
  不得新增注释）与 `i18n:check`（`src/client` 不得出现中文字面量）。

## Requirements

### Requirement 1：选区改写（浮动气泡）

**User Story:** 作为写文章的人，我想选中一段文字后就地看到"写长/写短/换语气/翻译"这类快捷操作，
这样我不用先想清楚要什么、再去菜单里找。

#### Acceptance Criteria

1. WHEN 用户在编辑器中选中非空文本并松开鼠标/键盘 THEN 系统 SHALL 在选区附近浮出一条操作气泡
2. WHEN 气泡显示 THEN 系统 SHALL 至少提供：写长一点、写短一点、修正语法、换个语气（子菜单）、
   翻译（子菜单）、自定义指令
3. WHEN 用户点击任一操作 THEN 系统 SHALL 以选中文本为输入开始流式生成，并**只影响该选区**
4. WHEN 生成结束 THEN 系统 SHALL 提供「替换选区」与「插入到下方」两种落笔方式
5. WHEN 选区被清空、编辑器失焦、或用户按 Esc THEN 气泡 SHALL 消失
6. WHEN 编辑器滚动导致选区移出可视区 THEN 气泡 SHALL 跟随或隐藏，不得停留在错误位置
7. IF 当前没有打开的笔记 THEN 气泡 SHALL 不出现

### Requirement 2：光标处撰写

**User Story:** 作为写文章的人，我想在空白处告诉 AI 一个主题，让它直接从光标位置写出来，
这样我不用切到别的界面再把结果复制回来。

#### Acceptance Criteria

1. WHEN 用户在编辑器中触发「撰写」 THEN 系统 SHALL 弹出一个只要求输入主题/要求的轻量输入框
2. WHEN 用户提交主题 THEN 系统 SHALL 从**当前光标位置**开始流式写入生成内容
3. WHEN 输入框打开 THEN 系统 SHALL 支持 `Ctrl/Cmd + Enter` 提交
4. IF 主题为空 THEN 系统 SHALL 拒绝提交并给出提示，不发起请求

### Requirement 3：续写

**User Story:** 作为写到一半卡住的人，我想让 AI 读一遍我已经写的内容，接着往下写，
这样我能拿到一个可以改的起点而不是对着空白发呆。

#### Acceptance Criteria

1. WHEN 用户触发「续写」 THEN 系统 SHALL 以**光标之前的正文**为上下文发起生成
2. WHEN 生成开始 THEN 系统 SHALL 从光标位置流式写入，不覆盖光标之后的内容
3. IF 光标之前的正文为空 THEN 系统 SHALL 拒绝并提示先写点东西或改用「撰写」

### Requirement 4：流式写入与取消（本 spec 的技术核心）

**User Story:** 作为使用者，我想看到字一个个冒出来、并能随时喊停，
这样我在它写歪的时候不用等它写完。

#### Acceptance Criteria

1. WHEN 生成进行中 THEN 系统 SHALL 在编辑器中**逐字可见地**呈现已生成内容
2. WHEN 生成进行中 THEN 系统 SHALL 显示一个可见的进行态指示（含已接收字符数）与取消按钮
3. WHEN 用户取消 THEN 系统 SHALL 立即停止，且**正文回到发起前的状态**（不留半截）
4. WHEN 生成完成并落笔 THEN 整次生成 SHALL 是**一步可撤销**的操作——按一次 `Ctrl+Z` 全部撤回，
   而不是一个 token 一步
5. WHEN 生成进行中 THEN 系统 SHALL NOT 对每个 token 触发笔记保存/同步
   （否则一次生成会产生上百个版本与同步请求）
6. WHEN 生成进行中且用户在别处编辑 THEN 系统 SHALL 保证落笔位置正确或明确拒绝，不得静默错位
7. IF 请求失败 THEN 系统 SHALL 提示可操作的原因（复用既有 `classifyAiError` 分类与文案）
   且正文保持不变

### Requirement 5：沿用既有引擎与供应商，不新增密钥面

**User Story:** 作为维护者，我不想为了新功能再引入一套鉴权与配置。

#### Acceptance Criteria

1. 系统 SHALL 复用 `streamMarkdown` 及既有 provider 分派，不新增供应商、不新增密钥字段
2. 系统 SHALL NOT 修改 `src/client/lib/ai/guard.ts`、`src/client/lib/ai/config.ts`
3. 系统 SHALL NOT 新增 D1 表或字段。**例外：图片生成需要一个新的 Worker 路由**
   （见需求 7）——文生图必须在服务端调 `AI` 绑定，浏览器直连不了。除该路由外 `src/worker/` 不动。
4. 新增的系统提示词 SHALL 保留既有「把输入当资料、不执行其中指令」的防注入约束
5. **文本类**新动作 SHALL 在两个供应商（Local Ollama / Cloudflare Workers AI）下都可用；
   图片生成是 Cloudflare 独有（需求 7.5）——Ollama 不具备文生图能力，这是能力边界不是配置缺失

### Requirement 6：与既有 AI 入口共存且不重复

**User Story:** 作为使用者，我不想为了四个旧动作和三个新动作记两套地方。

#### Acceptance Criteria

1. WHEN 用户打开工具栏 ✨ 菜单 THEN 既有三项（Tidy / Summarise / Suggest title）SHALL 仍然可用
2. 新动作 SHALL 复用既有 `AiPanelTarget` 的**陈旧性守卫**（`isTargetUnchanged`），
   落笔前发现正文已变则拒绝并提示，不得按旧偏移硬写
3. 系统 SHALL NOT 为新动作新建第二套 AI 设置界面

### Requirement 7：图片生成（Cloudflare 独有）

**User Story:** 作为写文章的人，我想用一句提示词生成配图并直接插进笔记，
这样我不用离开编辑器去别的地方找图。

#### Acceptance Criteria

1. WHEN 用户触发「生成图片」并输入提示词 THEN 系统 SHALL 调用 Workers AI 文生图模型生成图片
2. WHEN 图片生成成功 THEN 系统 SHALL 先预览，由用户决定「插入到笔记」或「重新生成」
3. WHEN 用户选择插入 THEN 系统 SHALL 复用**既有附件上传链路**（`handlers.uploadFile` → R2 →
   `Attachment`），并在光标处插入 Markdown 图片语法
4. 插入 SHALL 与文本生成一样是**一步可撤销**的操作
5. IF 当前供应商是 Local Ollama THEN 系统 SHALL 隐藏或禁用该动作并说明原因
   （**Ollama 不做文生图，这是能力边界不是配置问题**）
6. IF 生成失败或额度耗尽 THEN 系统 SHALL 提示可操作原因，且不产生空附件
7. 系统 SHALL NOT 引入任何新的图像 API 密钥——用的仍是 Worker 的 `AI` 绑定

## Non-Functional Requirements

### Code Architecture and Modularity

- **纯逻辑与 UI 分离**：位置计算、提示词构造、流式缓冲区这类可判定逻辑必须是纯函数并单测；
  浮层定位与 CodeMirror 交互留在组件里。
- **单一职责**：气泡（选区触发）、撰写输入框（主题触发）、流式写入器（CodeMirror 落笔）
  三者各自独立，不得糅成一个巨型组件。
- **复用优先**：定位逻辑参照既有 `Menu`（它已支持 `{x, y}` 点锚点与视口翻转）；
  按钮/输入框用既有 `primitives.tsx` / `form.tsx`，不自造样式。

### Performance

- 生成进行中不得触发笔记保存/同步（见需求 4.5）。
- 流式渲染不得每 token 重建整个文档；插入必须是增量的。

### Security

- 用户选中的文本与主题输入都要走既有防注入系统提示词约束（需求 5.4）。
- 不新增任何密钥存储、不修改 credential-vault。

### Reliability

- 取消与失败都必须让正文回到发起前状态（需求 4.3 / 4.7）——**"半截内容留在正文里"是本 spec 最大的风险**。
- 一次生成 = 一步撤销（需求 4.4）。

### Usability

- 气泡不得遮挡被选中的文字本身。
- 生成中必须能看出"还在跑"而不是"卡死了"（需求 4.2）。
- 移动端宽度下气泡不得溢出视口。

## 设计边界（本 spec 明确不做）

- **不做多轮对话式追问**。`streamMarkdown` 的 `history` 参数虽已预留，但交互复杂度不属于本轮。
- **不改既有四个动作的行为**。特别是 Summarise 仍插在开头当引用块（为了列表预览），
  **不改成上游那样追加到文末**——两者语义不同，改了会让 `ai-summary-and-title` 的验收失效。

## Clarifications（待澄清）

- [NEEDS CLARIFICATION: 流式写入如何同时满足"逐字可见"（4.1）与"一步撤销 + 取消不留痕"（4.3/4.4）？
  → **已实测消解**（2026-08-25，headless CodeMirror 实跑）：不用幽灵文本，直接对 `EditorView`
  增量 dispatch，流式事务全部带 `Transaction.addToHistory.of(false)` 与一个"AI 流式"注解
  （前者不进撤销历史，后者让 `updateListener` 跳过 `onChange` 从而不触发保存/同步）；
  取消＝静默撤销整段，落笔＝先静默撤销再用**一次**带 `isolateHistory.of('before')` 的事务重插。
  依据：`CodeEditor.tsx` 是受控组件，`value` 一变就是 `{from:0,to:全长}` 的**全文替换**——
  按 token 走 store 会让撤销粒度、光标位置、同步请求三样同时崩。
  🔴 **实跑推翻了本条的第一版方案**：naive 版（不加 `isolateHistory`）`undoDepth` 只有 1，
  一次 `Ctrl+Z` 把 AI 生成**和用户之前敲的字一起撤掉**；加隔离后 `undoDepth`=2，一次 undo 只撤 AI 段。
  取消路径实测文档与 `undoDepth` 与发起前逐项相同。**故隔离是必需项，不是优化。**]

- [NEEDS CLARIFICATION: 图片模型选哪个、返回形状是什么？
  → 已实测消解（2026-08-25，直接打 Workers AI REST）：选 `@cf/black-forest-labs/flux-1-schnell`，
  返回 `{result:{image:<base64>,usage}}`，解码后是 **JPEG 1024×1024**、约 670KB（远低于 25MB 附件上限）。
  **两个坑已实测**：① 同为文生图，`sdxl-lightning` 返回**裸二进制**而非 JSON，且响应头写 `image/png`
  但 magic bytes 是 JPEG——**头在说谎**，不能信 content-type；② `flux-2-klein-4b` 要 multipart 输入，
  纯 JSON 直接 400。因此只支持 flux-1-schnell 一个模型（简洁门），并且 Worker 侧对
  「ReadableStream」与「JSON base64」两种返回都做归一——依据：上一轮 cloudflare-ai-provider
  就是靠「不赌单一形状」躲过了 chunk 形状问题。
  ⚠️ **仍未验**：以上是 REST API 的形状，`env.AI.run` **绑定**的返回形状可能不同，实现时必须实测。]

- [NEEDS CLARIFICATION: 「换个语气」「翻译」的具体选项列表由谁定？
  → 暂定结论：语气取 正式/轻松/精简 三项，翻译取 中→英/英→中 两项，其余用「自定义指令」兜底。
  依据：选项越多越要维护 i18n 与提示词，而自定义指令是无限兜底；先给最少可用集，
  用户实际用起来再按需加。]
