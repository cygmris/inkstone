# Tasks Document

> 前置：`ollama-ai-engine` 全部任务完成（引擎、防丢失、配置、设置面板、CSP 放行）。

- [x] 1. 文本文件读取与单测
  - File: src/client/features/ai/read-text-file.ts（新建）、read-text-file.test.ts（新建）
  - `readTextFile(file)` 返回 `{ ok: true, text, name }` 或 `{ ok: false, reason }`
  - 判类型：`file.type.startsWith('text/')` 或后缀在 `.md/.markdown/.txt/.csv/.log/.json/.yaml/.yml` 内
  - 上限 2 MB，超过返回 `too-large`，不静默截断
  - Purpose: 支持拖入纯文本文件，且非文本必须明确拒绝而不是静默忽略
  - _Leverage: 无_
  - _Requirements: 1.2, 1.6_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript 前端开发者 | Task: 新建 read-text-file.ts 实现文件读取与类型判定，满足需求 1.2/1.6，并写单测 | Restrictions: 不得只看 file.type——很多系统对 .md 给空 MIME，必须同时看后缀；超限必须拒绝不得截断；不加注释（comments:check 白名单制） | Success: 单测覆盖「.md 空 MIME 放行」「image/png 拒绝」「超 2 MB 拒绝」并全部通过_

- [x] 2. 面板请求通道与活动编辑器 holder
  - File: src/client/features/ai/request.ts（新建）、active-editor.ts（新建）、
    对应两个 .test.ts（新建）、src/client/features/workspace/Workspace.tsx（修改 1 行）
  - `request.ts`：`setAiPanelRequest` / `takeAiPanelRequest`，take 后清空（一次性语义）
  - `active-editor.ts`：`setActiveEditorView` / `getEditorSelection`，无 view 或空选区返回 null
  - `Workspace.tsx`：`onReady={setView}` 改为同时调用 `setActiveEditorView`
  - Purpose: 命令面板够不到 Workspace 局部 state 里的 EditorView，而需求 3.2 要求按选区整理
  - _Leverage: src/client/features/workspace/Workspace.tsx 既有的 onReady/setView_
  - _Requirements: 3.2_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 新建 request.ts 与 active-editor.ts 并在 Workspace.tsx 的 onReady 里注册 EditorView，满足需求 3.2，写对应单测 | Restrictions: EditorView 不得放进 zustand（可变命令式对象，会引起无谓重渲染）；对 Workspace.tsx 的改动严格限制在 onReady 这一处，不得顺手重构该组件；不加注释 | Success: 单测通过（take 两次第二次为 null；无 view 时选区为 null）；npm run typecheck 通过_

- [x] 3. AiPanel 弹窗组件
  - File: src/client/features/ai/AiPanel.tsx（新建）
  - 两种模式共用：`convert`（空输入，完成后 createNote）与 `tidy`（预填，完成后 editContent）
  - 输入区支持拖入文本文件；提交后流式渲染输出；显示分片进度（第 N/M 片）
  - loss 非空时顶部显示告警横幅（说明 truncated 还是 short + 两条可操作建议），**仍允许创建/替换**
  - 失败时按 `classifyAiError` 给文案，并提供「打开 AI 设置」按钮
  - 停止按钮走 AbortController，停止后不落笔记
  - tidy 写回前校验 target.noteId 仍是当前笔记且存在
  - Purpose: 用户可见的全部交互都在这一个组件里
  - _Leverage: lib/ai/ollama.ts 的 streamMarkdown/classifyAiError/提示词常量、lib/ai/guard.ts 的 LossReport、lib/ai/config.ts、components/overlay 的 useEscape/useDialogFocus/useLockScroll、components/primitives 的 Button/IconButton、store/notes 的 createNote/editContent/contents、store/ui 的 toast/openPanel_
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.3, 3.4, 4.1, 4.2_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师，擅长流式 UI | Task: 新建 AiPanel.tsx，实现 convert/tidy 双模式弹窗，满足需求 1.1/1.3/1.4/1.5、2.1–2.4、3.3/3.4、4.1/4.2 | Restrictions: 不得做成两个组件——两套几乎一样的流式与告警逻辑会各自漂移；有 loss 告警时不得禁用创建按钮（判断权归用户）；错误分类必须复用 classifyAiError 不得另起一套；模式与初始输入从 request.ts 取不从 props 传（AppShell 渲染点是统一写法）；写回必须走 useNotes.editContent 而非直接改 CodeMirror，以保证可撤销与同步；不加注释 | Success: npm run typecheck 通过；本地起站后 convert 与 tidy 两条路都能跑通_

- [x] 4. 挂载弹窗与命令面板入口
  - File: src/client/store/ui.ts（修改）、src/client/features/shell/AppShell.tsx（修改）、
    src/client/features/command/CommandPalette.tsx（修改）
  - `ui.ts`：`PanelName` 联合类型加 `'ai'`
  - `AppShell.tsx`：lazy 导入 AiPanel + `{panel === 'ai' && <AiPanel onClose={closePanel}/>}` 一行
  - `CommandPalette.tsx`：加 `cmd-ai-convert`；`cmd-ai-tidy` 放进既有的 `activeNote` 条件块
    （因此无笔记时自动不出现，满足需求 3.5），run 里先 setAiPanelRequest 再 openPanel('ai')
  - Purpose: 把面板接进既有的 panel 与命令机制
  - _Leverage: AppShell.tsx 既有五个 panel 的写法、CommandPalette.tsx 既有 activeNote 条件展开写法_
  - _Requirements: 1.1, 3.1, 3.2, 3.5, 5.2, 5.3_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 在 ui.ts/AppShell.tsx/CommandPalette.tsx 三处接入 AiPanel 与两条命令，满足需求 1.1、3.1/3.2/3.5、5.2/5.3 | Restrictions: 严禁修改 EditorToolbar.tsx（需求 5.3）；三个文件各自的改动都要压到最小，不顺手重构；tidy 命令必须放进 activeNote 条件块而不是自己写 if；不加注释 | Success: npm run typecheck 通过；命令面板出现两条命令；无打开笔记时 tidy 那条不出现_

- [x] 5. 中英文案与变异测试
  - File: src/shared/locales/en-US.ts、zh-CN.ts（修改）；任务 1、2 的测试文件
  - 补齐本 spec 全部面向用户字符串的中英文案
  - 对任务 1、2 的每条关键断言做变异测试：逐个改坏实现确认转红后还原
  - Purpose: i18n:check 是硬门；新写的断言可能根本没有能力失败
  - _Leverage: src/shared/locales 既有键的组织方式_
  - _Requirements: 全部（Usability）_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 + 测试工程师 | Task: 补齐中英文案并对本 spec 的单测做变异测试 | Restrictions: 变异逐个做逐个还原，最终 git diff 中实现文件必须无残留；不得为让测试转红而改测试；文案不得只加英文 | Success: npm run i18n:check 通过；每条关键断言都有确认转红的记录；npm run test:unit 全绿_

- [x] 6. 全量门禁
  - File: 无（跑命令）
  - typecheck / test:unit / i18n:check / comments:check / deploy:check 五门，记录实际输出
  - Purpose: comments:check 与 i18n:check 特别容易被新 UI 代码触发
  - _Leverage: package.json 既有 scripts_
  - _Requirements: 全部_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 发布工程师 | Task: 跑齐五道门并记录实际输出 | Restrictions: 不得为了让门变绿而放宽门本身（不得往 check-comments 白名单里加新注释——应当删注释） | Success: 五条命令全部退出码 0_

- [~] 7. 线上端到端验收
  - File: 无（部署 + 人工验证）
  - 部署后在 Chrome 上（先清 Service Worker）逐条验：
    A. convert 贴聊天记录 → 流式出 Markdown → 创建笔记，内容正确
    B. convert 长文超过 chunkChars → 显示分片进度 → 对照原文抽查首尾章节都在
    C. tidy 整篇 → 替换 → Ctrl+Z 能撤销（**若不能，说明设计押的数错了，按 design 的备案改为保留原文供手动回退，并记进 conclusion**）
    D. tidy 选中一段 → 只有该段被替换
    E. 无打开笔记时 tidy 命令不出现
    F. 停掉 Ollama → 报错文案给出可操作说明且「打开 AI 设置」按钮可用
  - _Blocked: A–F 六项已在本地 wrangler dev（真浏览器、真本机 Ollama）全部实测通过，含 C 项撤销成立与 B 项分片 12 节不丢。线上同样六项待用户在 Chrome 里授予 psn-note.byjs.dev 的本地网络权限后重跑——目前 Chrome 148 的 local-network-access 为 prompt，请求会挂起，与本项目代码无关（Convertly 同一浏览器实测同样受影响）。_
  - Purpose: 流式、分片、撤销、错误路径只有在真实站点上才验得了
  - _Leverage: 无_
  - _Requirements: 1.3, 1.4, 1.5, 2.3, 3.3, 3.4, 3.5, 4.1_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA 工程师 | Task: 部署后在 Chrome 上逐条跑 A–F 六项验收并记录实际结果 | Restrictions: 验证前必须清 Service Worker，否则跑的是旧 bundle 会得出错误结论；C 项若撤销不成立，必须如实记录并按备案改，不得含糊带过；未全部通过就保持 [~] 并写明 Blocked 原因 | Success: 六项都有明确结论并记入实现日志_

- [x] 8. 修复 tidy 写回的偏移量过期问题（静默改坏笔记）
  - File: src/client/features/ai/request.ts、AiPanel.tsx、features/command/CommandPalette.tsx、locales×2、request.test.ts
  - 缺陷：`target.from/to` 在命令触发时捕获，`current` 在点「替换」时才读。中间隔着几十秒生成，
    而 Inkstone 有实时同步（SYNC_HUB）+ 离线写队列，`applySync` 可能改了正文 →
    选区模式会把结果拼到错位置，整篇模式会覆盖掉并发编辑，**两者都静默**
  - 改法：`AiPanelTarget` 加 `originalText`；写回前比对
    （选区：`current.slice(from,to) === originalText`；整篇：`current === originalText`），不匹配则拒绝写回并保留结果
  - Purpose: 需求 2.1 要求丢失必须可见。这是本 spec 自己引入的一条静默丢失路径
  - _Leverage: 既有的拒绝写回路径与 toast；CommandPalette 里已有 selection.text 与整篇正文_
  - _Requirements: 2.1, 3.4_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 | Task: 给 tidy 写回加原文比对，满足需求 2.1/3.4 | Restrictions: 比对逻辑要抽成纯函数以便单测，并做变异测试确认会转红；不匹配时不得静默放弃结果——要保留在界面上供用户复制；文案中英双语；不加注释 | Success: 单测覆盖「正文未变可写回」「选区处内容变了拒绝」「整篇变了拒绝」并通过变异测试_

- [x] 9. 编辑器工具栏加可见的「AI 整理」按钮
  - File: src/client/features/ai/open-tidy.ts（新建）、features/workspace/EditorToolbar.tsx（修改）、
    features/command/CommandPalette.tsx（改为调用共享函数）、locales×2
  - 背景：原设计把两个入口全放命令面板以避免改工具栏，代价是**用户实际找不到**（用户原话「没看到按钮呀」）
  - ⚠️ **需求 5.3「EditorToolbar 不被修改」由用户主动放弃**，不是我单方面放宽
  - 触发逻辑抽成 open-tidy.ts，命令面板与工具栏共用，避免两个入口各自漂移
  - Purpose: 功能藏在命令面板里等于没有
  - _Leverage: EditorToolbar 既有的 Divider / ToolButton；features/ai/{active-editor,request}_
  - _Requirements: 3.1, 3.2_
  - _Prompt: Implement the task for spec ai-markdown-entries, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 在编辑器工具栏加 AI 整理按钮并抽出共享触发逻辑 | Restrictions: 必须复用工具栏自己的 Divider/ToolButton，不得引入新样式；两个入口必须共用同一份实现；不加注释 | Success: 打开笔记后按钮出现、点击带出整篇正文、有选中时只带选中段_
