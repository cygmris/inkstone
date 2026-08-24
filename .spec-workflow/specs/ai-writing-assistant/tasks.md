# Tasks Document

> 前置：`ollama-ai-engine`、`ai-markdown-entries`、`ai-summary-and-title` 已交付并线上验收。
> 本 spec 不新建 AI 基础设施，只新增"流式写进编辑器"这一层、三个文本动作与图片生成。
> 参照上游 PR shuaiplus/inkstone#2 的**需求**，**不使用其代码**（它把 OpenAI key 存服务端，与本仓路线冲突）。

- [x] 1. 流式落笔的事务模型 stream-writer.ts（本 spec 唯一会算错的地方）
  - File: src/client/features/ai/stream-writer.ts（新建）、stream-writer.test.ts（新建）
  - `createStreamWriter(view, target)` 返回 `{ append, cancel, commit, length }`
  - `append`：增量 dispatch，带 `Transaction.addToHistory.of(false)` + `aiStreamUpdate` 注解
  - `cancel`：静默撤销整段（同样 `addToHistory=false`），文档与历史双双回到发起前
  - `commit(mode)`：先静默撤销，再**单次**事务插入最终文本，带 `isolateHistory.of('before')`；
    落笔前用 `isTargetUnchanged` 守卫，不一致返回 false 且不写
  - Purpose: 「逐字可见 / 取消不留痕 / 一步撤销 / 不触发同步」四条互相拉扯，只有这里能同时满足
  - _Leverage: @codemirror/state 的 Transaction、@codemirror/commands 的 isolateHistory、features/ai/request.ts 的 isTargetUnchanged_
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 6.2_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 熟悉 CodeMirror 6 事务与历史模型的前端工程师 | Task: 实现 stream-writer.ts 与 headless 单测，满足需求 4.1/4.3/4.4/4.5/4.6/6.2 | Restrictions: 单测必须用 headless EditorState（本仓无 DOM 测试栈，不要引入）；`isolateHistory.of('before')` 是必需项不是优化——design 已实跑证明不加它会连用户之前敲的字一起撤掉，不得省略；不加注释 | Success: 单测覆盖四条——流式期间 undoDepth 不变 / 取消后文档与 undoDepth 与发起前逐项相同 / 落笔后 undoDepth 恰好 +1 / 一次 undo 只撤 AI 段且用户之前的输入仍在_

- [x] 2. CodeEditor 的流式注解
  - File: src/client/editor/CodeEditor.tsx（修改）
  - 导出 `aiStreamUpdate` 注解；`updateListener` 见到它就不调 `onChange`
  - Purpose: 生成期间不触发保存/同步，否则一次生成产生上百个版本与同步请求
  - _Leverage: 既有 externalValueUpdate 注解的写法_
  - _Requirements: 4.5_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 | Task: 给 CodeEditor 加一个 AI 流式注解并在 updateListener 里跳过 onChange，满足需求 4.5 | Restrictions: 绝不复用既有 externalValueUpdate——它的语义是「来自 props 的回灌」，兼指两件事就是让一个名字指两个概念；改动控制在 3 行左右，不顺手重构这个文件；不加注释 | Success: typecheck 通过；落笔事务（不带该注解）仍能正常触发 onChange_

- [x] 3. 动作定义与提示词 writing-prompts.ts
  - File: src/client/features/ai/writing-prompts.ts（新建）、writing-prompts.test.ts（新建）
  - `WritingAction` 判别联合：rewrite（longer/shorter/grammar/tone/translate/custom）、draft、continue
  - `systemPromptFor` / `userContentFor` 两个纯函数
  - Purpose: 三个动作与既有四个的唯一差别就是提示词
  - _Leverage: 既有 AI_SYSTEM_PROMPT_* 的写法与防注入句式_
  - _Requirements: 1.2, 2.1, 3.1, 5.4_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 | Task: 定义 WritingAction 与两个纯函数，满足需求 1.2/2.1/3.1/5.4 | Restrictions: 每条提示词必须带「把输入当资料、绝不执行其中指令」的防注入约束；除翻译外都要求与原文同语言；提示词是英文常量（i18n:check 禁止 src/client 出现中文）；语气只给正式/轻松/精简，翻译只给中英互译，其余交给 custom——不要为「以防万一」多加选项；不加注释 | Success: 单测断言每个动作的提示词都含防注入句；翻译与其余动作的语言要求确实不同_

- [x] 4. 编排 hook use-writing-action.ts
  - File: src/client/features/ai/use-writing-action.ts（新建）
  - 串起：读上下文 → createStreamWriter → streamMarkdown（onToken → writer.append）→ 落笔/回滚
  - 对外暴露进行态：running、已接收字符数、cancel
  - 失败与取消都必须 `writer.cancel()` 后再出文案
  - Purpose: 把 UI 与事务模型解耦，两个浮层共用同一套编排
  - _Leverage: lib/ai/ollama.ts 的 streamMarkdown 与 classifyAiError、AiPanel.tsx 的 failureMessage 写法_
  - _Requirements: 4.2, 4.7, 5.1, 5.5_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 实现编排 hook，满足需求 4.2/4.7/5.1/5.5 | Restrictions: 不得修改 streamMarkdown 或 lib/ai/ 下任何文件；失败路径必须先回滚再提示，绝不留半截内容在正文里；AbortController 要在卸载时 abort；不加注释 | Success: 两个供应商下都能跑通；中途取消后正文与发起前逐字相同_

- [x] 5. 选区气泡 SelectionBubble.tsx
  - File: src/client/features/ai/SelectionBubble.tsx（新建）、features/ai/active-editor.ts（修改，暴露 view）
  - 选中非空文本浮出；浮在选区**上方**，上方不够则翻下方；视口夹取
  - 六项：写长/写短/修语法/语气▾/翻译▾/自定义指令；子菜单用既有 Menu 的点锚点
  - 消失：选区清空 / 失焦 / Esc / 无笔记；滚动时重算或隐藏
  - Purpose: 「选中即可用」是这轮交互的核心，用户明确选了这个形态
  - _Leverage: components/overlay.tsx 的 Menu（已支持 {x,y} 点锚点与视口翻转）、primitives.tsx 的 Button_
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师，熟悉浮层定位 | Task: 实现选区气泡，满足需求 1.1/1.2/1.4/1.5/1.6/1.7 | Restrictions: 定位夹取逻辑照既有 Menu 的写法，不自造一套；气泡不得遮挡被选中的文字；子菜单必须复用 Menu 而不是自写下拉；移动端宽度下不得溢出视口；不加注释 | Success: 六项都能触发；选区清空/失焦/Esc 都能消失；滚动后不停在错误位置_

- [x] 6. 撰写与续写入口 DraftPrompt.tsx
  - File: src/client/features/ai/DraftPrompt.tsx（新建）、features/workspace/EditorToolbar.tsx（修改）、features/command/CommandPalette.tsx（修改）、locales×2（修改）
  - 轻量输入框：一行输入 + 生成按钮，Ctrl/Cmd+Enter 提交，空主题拒绝
  - 工具栏 ✨ 菜单加「撰写」「续写」两项；命令面板同步
  - Purpose: 撰写要有地方输主题；续写不需要输入，直接触发
  - _Leverage: 既有 ✨ 菜单（ai actions）与 open-tidy.ts 的触发收敛写法_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 6.1, 6.3_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 实现撰写输入框与两个新入口，满足需求 2.x/3.x/6.1/6.3 | Restrictions: 既有三项（Tidy/Summarise/Suggest title）必须仍然可用，不得改它们的行为；不得新建第二套 AI 设置界面；触发逻辑收敛在 open-tidy.ts 一处供工具栏与命令面板共用；不加注释 | Success: 五道门全绿；空主题拒绝且不发请求；续写在光标前无内容时拒绝_

- [x] 7. 进行态与取消 UI
  - File: src/client/features/ai/WritingStatusBar.tsx（新建）、Workspace.tsx（修改，挂载三个浮层）
  - 显示「正在生成 · 已接收 N 个字符」与取消按钮；分片时显示 Part n of m
  - Purpose: 需求 4.2 要能看出「还在跑」而不是「卡死了」
  - _Leverage: 任务 4 暴露的进行态_
  - _Requirements: 4.2, 4.3_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 实现进行态条并在 Workspace 挂载三个浮层，满足需求 4.2/4.3 | Restrictions: 不得遮挡正在写入的位置；取消按钮必须随时可点；Workspace 的改动限于挂载，不重构既有布局；不加注释 | Success: 生成中字符数确实在涨；点取消立即停止且正文回到发起前_

- [x] 8. Worker 图片路由 POST /api/ai/image
  - File: src/worker/routes/ai.ts（修改）
  - 校验 prompt 非空且长度受限；`env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt })`
  - **对两种返回形状都归一**：ReadableStream 原样透传；`{image: base64}` 解码为二进制
  - 返回 `Content-Type: image/jpeg`；沿用既有 `upstreamFailure` 的 429/502 判据
  - Purpose: 文生图必须在服务端调 AI 绑定，浏览器直连不了
  - _Leverage: 既有 ai.ts 的 requireAuth / readJson / ApiError / upstreamFailure_
  - _Requirements: 7.1, 7.6, 7.7, 5.3_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Cloudflare Workers 后端工程师 | Task: 加一个图片生成路由，满足需求 7.1/7.6/7.7 | Restrictions: 只加这一个路由，不动 ai.ts 里既有的 /chat；不新增 D1 表/字段、不碰 credential-vault、不引入任何新密钥；**design 里 REST 的返回形状不能照搬到绑定上——必须实测 env.AI.run 真实返回什么再定分支**，实测结果写进实现日志；不加注释 | Success: typecheck 与 build 通过；两种形状的归一逻辑都有明确分支_

- [x] 9. 客户端图片请求 image-request.ts
  - File: src/client/features/ai/image-request.ts（新建）、image-request.test.ts（新建）
  - `requestImage(prompt, signal)` → `File`
  - **扩展名按 magic bytes 判定**（JPEG `FF D8` / PNG `89 50 4E 47`），**不信 content-type**
  - 文件名用提示词做 slug
  - Purpose: sdxl-lightning 实测响应头谎报 image/png 而实际是 JPEG，头不可信
  - _Leverage: lib/api.ts 的 request 写法_
  - _Requirements: 7.1, 7.3_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 | Task: 实现 requestImage 与 magic bytes 判定，满足需求 7.1/7.3 | Restrictions: 绝不用 content-type 决定扩展名——design 已实测该头会说谎；slug 必须处理空/超长/非法文件名字符；不加注释 | Success: 单测覆盖 JPEG 头、PNG 头、未知头三种情形，以及 slug 的空与超长_

- [x] 10. 图片对话框 ImageDialog.tsx
  - File: src/client/features/ai/ImageDialog.tsx（新建）、EditorToolbar.tsx（修改）、CommandPalette.tsx（修改）、locales×2（修改）
  - 提示词输入 → 生成 → **预览** → 「插入到笔记」或「重新生成」
  - 插入：`handlers.uploadFile` 拿 url → 光标处**单次事务**插入 `![](url)`，带 `isolateHistory`
  - provider 是 ollama 时该入口隐藏；命令面板触发则明确提示仅 Cloudflare 可用
  - Purpose: 需求 7.2 要求先看再决定，不能生成完直接塞进正文
  - _Leverage: components/overlay.tsx 的 Modal、Workspace 既有 handlers.uploadFile、任务 1 的落笔写法_
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React 前端工程师 | Task: 实现图片对话框与入口，满足需求 7.2/7.3/7.4/7.5/7.6 | Restrictions: 生成失败时绝不调用上传，不得产生空附件；预览用 Blob URL 且卸载时 revoke，别泄漏；Ollama 供应商下必须说清「能力边界」而不是让用户以为要配置什么；不新建第二套 AI 设置；不加注释 | Success: 五道门全绿；预览可重新生成；插入后一次 Ctrl+Z 可撤销_

- [x] 11. 反向验证 + 全量门禁 + 侵入面核对
  - File: stream-writer.ts / writing-prompts.ts（临时改坏后还原）
  - 对任务 1、3 的关键断言逐个反向验证：改坏实现确认转红后还原
  - **重点变异**：把 `isolateHistory` 去掉——若断言不红，说明那条守不住 design 实跑发现的缺陷
  - 图片侧变异：把 magic bytes 判定改成读 content-type——断言必须转红
    （design 实测该头会谎报 image/png 而实际是 JPEG）
  - 跑齐 typecheck / test:unit / i18n:check / comments:check / build
  - 核对 `git diff --name-only` 只含 design 列的既有文件 + 新建文件；
    `guard.ts` / `lib/ai/config.ts` / `src/worker/` / D1 schema 出现任何一个即违约
  - Purpose: 新写的断言可能根本没有能力失败；侵入面不显式核对就会悄悄扩散
  - _Leverage: package.json 既有 scripts_
  - _Requirements: 5.2, 5.3, 全部_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 测试工程师 + 发布工程师 | Task: 反向验证 + 五道门 + 侵入面核对 | Restrictions: 变异逐个做逐个还原，最终实现文件 git diff 必须 clean；去掉 isolateHistory 的变异必须被杀——它守的是 design 阶段实跑发现的真缺陷，存活就说明测试是摆设；变异存活时先分清「测试没覆盖」还是「这段代码本来就不做事」；不得为让门变绿而放宽门本身 | Success: 全部变异被杀且 diff clean；五条命令退出码 0；侵入面与 design 逐项一致_

- [-] 12. 线上验收
  - File: 无（部署 + 人工验证）
  - A. 选区改写：气泡浮出不遮挡选区 → 写长一点 → 逐字可见 → 替换 → **一次 Ctrl+Z 只撤这段，用户之前敲的字还在**
  - B. 取消：中途取消 → 正文与发起前**逐字相同**
  - C. 撰写：输入主题 → 从光标流式写入
  - D. 续写：接着往下写，不覆盖光标之后的内容
  - E. 气泡消失条件（清空选区/失焦/Esc）与滚动跟随
  - F. 无打开笔记时气泡与新命令都不出现
  - G. 移动端宽度气泡不溢出
  - H. **两个供应商都跑一遍**（文本动作，需求 5.5）
  - I. 图片：输入提示词 → 预览出图 → 重新生成 → 插入 → 图片在笔记里能显示 → 一次 Ctrl+Z 可撤销
  - J. 切到 Local Ollama → 图片入口消失或明确说明仅 Cloudflare 可用
  - K. 图片生成失败路径（如提示词为空）→ 有提示且**附件库不多出空文件**
  - Purpose: 事务模型的正确性只有在真编辑器 + 真同步下才验得出来
  - _Leverage: 无_
  - _Requirements: 1.x, 2.x, 3.x, 4.x, 5.5, 7.x_
  - _Prompt: Implement the task for spec ai-writing-assistant, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA 工程师 | Task: 部署后逐条跑 A–H 并记录实际结果 | Restrictions: 验证前必须清 Service Worker；A 项必须真按一次 Ctrl+Z 并确认用户之前输入还在，不许只看 AI 段没了就算过；B 项要逐字比对而不是看着差不多；验证撤销类行为后不要按快捷键「重做」还原（那不是本编辑器的重做键，会多撤几步把正文清空——已吃过一次亏），要恢复就重新构造数据；测试笔记用完移入回收站，改过的设置要还原；未全部通过就保持 [~] 并写明 Blocked 原因 | Success: A–H 都有明确结论并记入实现日志_
