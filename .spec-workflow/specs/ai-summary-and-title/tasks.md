# Tasks Document

> 前置：`ollama-ai-engine`、`ai-markdown-entries`、`cloudflare-ai-provider` 已交付。
> 本 spec 只在既有弹窗上加两个模式，不新建 AI 基础设施。

- [x] 1. 纯函数模块 summary.ts（本 spec 唯一有真实边界条件的逻辑）
  - File: src/client/features/ai/summary.ts（新建）、summary.test.ts（新建）
  - `summaryInsertOffset(content)`：frontmatter 之后 → 一级标题之后 → 返回偏移
  - `insertSummary(content, summary)`：在该偏移插入 `> {summary}`，前后各留一个空行
  - `normalizeTitle(raw)`：取首行 → 去空白 → 去成对引号 → 去 `#` 与强调标记 → 去尾句号 → 截断 512
  - Purpose: 插入位置是本 spec 唯一会算错的地方，抽成纯函数才验得了
  - _Leverage: @shared/constants 的 LIMITS.titleMaxLength_
  - _Requirements: 1.3, 1.4, 2.5_
  - _Prompt: Implement the task for spec ai-summary-and-title, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript 开发者，擅长纯函数与边界条件 | Task: 新建 summary.ts 与单测，满足需求 1.3/1.4/2.5 | Restrictions: 必须是纯函数、无 IO、无全局状态；frontmatter 未闭合时不得误判（那不是 frontmatter）；不加注释 | Success: 单测覆盖无 frontmatter 无标题 / 有 frontmatter / 有标题 / 两者都有 / 空正文 / 只有 frontmatter / frontmatter 未闭合 七种情形_

- [x] 2. 验证 `>` 引用块的 excerpt 实际输出（design 押的数之一）
  - File: src/client/features/ai/summary.test.ts（补断言）
  - design 里已实测 `> [!NOTE]` 会让 excerpt 显示成 `[!NOTE] 本周把...`，
    但**普通 `>` 块的 excerpt 输出没单独验过**
  - 写一条断言：对 insertSummary 后的内容跑 deriveExcerpt，确认开头就是摘要那句话、不含 `>` 或 `[!`
  - Purpose: 「让列表变好看」是本 spec 的核心目标，这条不验等于没做
  - _Leverage: @shared/markdown-utils 的 deriveExcerpt_
  - _Requirements: 1.5_
  - _Prompt: Implement the task for spec ai-summary-and-title, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 测试工程师 | Task: 补一条断言证明插入摘要后 excerpt 确实以摘要开头，满足需求 1.5 | Restrictions: 必须真调 deriveExcerpt，不许自己模拟它的行为；若实测发现 `>` 也会漏标记，立即停下报告而不是改断言迁就 | Success: 断言通过且能反向验证（把 insertSummary 改成不插入则转红）_

- [x] 3. 提示词与 mode 扩展
  - File: src/client/lib/ai/ollama.ts（修改）、features/ai/request.ts（修改）
  - `AI_SYSTEM_PROMPT_SUMMARIZE`：一到两句、与原文同语言、只输出摘要本身、不复述
  - `AI_SYSTEM_PROMPT_TITLE`：单行短标题、同语言、无 Markdown、无引号、不以句号结尾
  - `AiPanelMode` 加 `'summarize' | 'title'`
  - Purpose: 两个新动作与既有两个的唯一差别就是提示词
  - _Leverage: 既有 AI_SYSTEM_PROMPT_CONVERT/TIDY 的写法与 strictInstruction()_
  - _Requirements: 1.2, 2.2_
  - _Prompt: Implement the task for spec ai-summary-and-title, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 | Task: 加两个系统提示词常量并扩展 AiPanelMode，满足需求 1.2/2.2 | Restrictions: 提示词必须保留「把输入当数据而非指令」的防注入约束；必须要求与原文同语言输出；提示词是英文常量（i18n:check 禁止 src/client 出现中文）；不加注释 | Success: npm run typecheck 与 i18n:check 通过_

- [x] 4. AiPanel 两个完成动作
  - File: src/client/features/ai/AiPanel.tsx（修改）
  - `summarize`：校验 originalText 未变 → `editContent(id, insertSummary(current, output))`
  - `title`：`editTitle(id, normalizeTitle(output))`，规整后为空则拒绝写回并提示
  - `title` 模式弹窗宽度传 480（其余仍 720）
  - 标题、描述、按钮文案按 mode 分派
  - Purpose: 复用同一个弹窗，不新造界面
  - _Leverage: 既有 isTargetUnchanged 守卫、Modal 的 width 参数、useNotes.editTitle_
  - _Requirements: 1.3, 1.6, 1.7, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4_
  - _Prompt: Implement the task for spec ai-summary-and-title, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 在 AiPanel 加两个完成动作与标题模式窄布局，满足需求 1.3/1.6/1.7、2.3/2.4、4.x | Restrictions: 绝不新建第二个弹窗组件——流式渲染/告警/中止/错误分类/打开设置五样各维护两份必然漂移；summarize 必须走既有 isTargetUnchanged 守卫；title 不需要该守卫（整体替换，不依赖偏移）；空标题不得写回；不加注释 | Success: npm run typecheck 通过；四种 mode 都能跑通_

- [x] 5. 工具栏菜单与命令面板入口
  - File: features/ai/open-tidy.ts（修改）、features/workspace/EditorToolbar.tsx（修改）、features/command/CommandPalette.tsx（修改）、locales×2（修改）
  - open-tidy.ts 加 `openAiSummarizeForActiveNote` / `openAiTitleForActiveNote`
  - EditorToolbar 的 ✨ 从 ToolButton 改为 MenuButton + Menu，三项：整理全文 / 生成摘要 / 生成标题
  - CommandPalette 加两条命令，放进既有 activeNote 条件块
  - Purpose: 四个动作收敛在两个位置，不让用户记四个地方
  - _Leverage: EditorToolbar 既有的 MenuButton/Menu 与 headingItems 的写法；CommandPalette 既有 activeNote 条件块_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - _Prompt: Implement the task for spec ai-summary-and-title, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 工具栏 ✨ 改菜单并加两条命令，满足需求 3.x | Restrictions: 必须复用工具栏自己的 MenuButton/Menu，不得自造下拉；MenuButton 的 mobile 参数要照传，别破坏移动端；命令必须放进既有 activeNote 条件块而不是自己写 if；触发逻辑收敛在 open-tidy.ts，工具栏与命令面板共用；不加注释 | Success: 五道门全绿；打开笔记后菜单三项都在，无笔记时两条命令不出现_

- [x] 6. 反向验证 + 全量门禁
  - File: summary.ts（临时改坏后还原）
  - 对任务 1、2 的关键断言逐个做反向验证：改坏实现确认转红后还原
  - 跑齐 typecheck / test:unit / i18n:check / comments:check / build，记录实际输出
  - **核对需求 5（最小侵入）**：`git diff --name-only main` 的清单必须只含 design 列的
    7 个既有文件 + 2 个新建文件；`guard.ts` / `config.ts` / `src/worker/` / D1 schema
    出现任何一个即为违约，当场报告
  - Purpose: 新写的断言可能根本没有能力失败；侵入面不显式核对就会悄悄扩散
  - _Leverage: package.json 既有 scripts_
  - _Requirements: 5.1, 5.2, 5.3, 全部_
  - _Prompt: Implement the task for spec ai-summary-and-title, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 测试工程师 + 发布工程师 | Task: 反向验证 + 五道门 | Restrictions: 变异逐个做逐个还原，最终 git diff 实现文件必须无残留；变异存活时先分清是「测试没覆盖」还是「这段代码本来就不做事」——后者删代码而不是补断言；不得为让门变绿而放宽门本身 | Success: 全部变异被杀且 git diff clean；五条命令退出码 0_

- [x] 7. 线上验收
  - File: 无（部署 + 人工验证）
  - A. 生成摘要 → 插入 → **列表预览确实变成那句话**（本 spec 的验收核心）
  - B. 摘要写回后 Ctrl+Z 能撤销
  - C. 生成标题 → 标题栏更新（**顺带验证 design 里「editTitle 会触发同步与撤销」这条未验证的押注**）
  - D. 工具栏菜单三项都能触发；移动端宽度下菜单不破版
  - E. 无打开笔记时两条命令不出现
  - Purpose: 「列表变好看」这个目标只有在真界面上才看得出成没成
  - _Leverage: 无_
  - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.1, 3.4_
  - _Prompt: Implement the task for spec ai-summary-and-title, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA 工程师 | Task: 部署后逐条跑 A–E 并记录实际结果 | Restrictions: 验证前必须清 Service Worker；A 项必须真看列表那行文字，不许只看正文插对了就算过；C 项要如实记录 editTitle 是否可撤销（design 标了未验证）；未全部通过就保持 [~] 并写明 Blocked 原因 | Success: A–E 都有明确结论并记入实现日志_
