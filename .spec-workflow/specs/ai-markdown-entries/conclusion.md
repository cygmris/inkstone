# Conclusion: ai-markdown-entries

## 目标达成

需求 1–5 全部达成，全部在真浏览器 + 真本机模型上跑通（本地 `wrangler dev`）。
线上同样六项待用户授予 Chrome 本地网络权限后重跑，见「已知边界」。

需求 3.4 的「改动能被撤销」在设计时标注为**未验证的押注**，现已实测成立。

## 交付结论

两个用户可见入口，共用 `ollama-ai-engine` 的引擎。

| 交付 | 位置 |
| --- | --- |
| convert / tidy 双模式弹窗 | `src/client/features/ai/AiPanel.tsx` |
| 拖入纯文本文件（非文本与超 2 MB 明确拒绝） | `src/client/features/ai/read-text-file.ts` |
| 命令面板 → 弹窗的一次性请求交接 | `src/client/features/ai/request.ts` |
| 当前 EditorView holder 与选区读取 | `src/client/features/ai/active-editor.ts` |
| 接入点三处 + 编辑器注册一处 | `store/ui.ts`、`features/shell/AppShell.tsx`、`features/command/CommandPalette.tsx`、`features/workspace/Workspace.tsx` |
| 中英文案 24 组 | `src/shared/locales/{en-US,zh-CN}.ts` |

**`EditorToolbar.tsx` 一个字未动**（需求 5.3）。

## 验收证据

真浏览器（claude-browser attach :9223 的独立 Chrome）+ 本地 `wrangler dev --local :8788`
+ 真本机 Ollama，六项**实测**：

| 项 | 实测结果 |
| --- | --- |
| A convert | 贴入 6 行聊天记录 → 流式输出 Markdown → 创建笔记，编辑器内容与输出逐字一致 |
| B 分片 | chunkChars 设 300、输入 400 字符 → 进度**实测**依次显示 `Part 1 of 2`、`Part 2 of 2`；12 节编号**一节不缺**，输出长度 400 与输入相同 |
| C 撤销 | tidy 替换后按 Ctrl+Z → 正文**实测**逐字还原为替换前 |
| D 选区 tidy | 附加指令强制模型给每行加 `>>` 前缀 → 只有被选中的第 2 行变成 `>> **chris**: …`，其余 5 行逐字未动 |
| E 无笔记时 | 清掉 `inkstone.ui` 的 activeNoteId 重载 → 命令面板搜 "AI" **实测**只剩 "AI to Markdown"，tidy 那条与 archive/share/delete 一同消失 |
| F 错误路径 | `systemctl --user stop ollama` 后触发 → **实测**弹窗给出「两种可能都列出来」的说明 + 可用的「Open AI settings」按钮 |

- 五道门**实测**全部退出码 0（`test:unit` 10 files / 112 tests）
- 变异测试**实测** 13/13 全部转红，`git diff --stat` clean

## 预估 vs 实测

| 项 | 预估 | 实测 | 差因 |
| --- | --- | --- | --- |
| 新增文件 | 4 源 + 3 测试 = 7 | 4 源 + 3 测试 = 7 | 一致 |
| 改动既有文件 | 6 | 6 | 一致 |
| 新增代码量 | 450–600 行（含测试） | 约 550 行 | 落在区间内 |
| 任务数 | 6 | 7（design 写 6，tasks 落成 7） | 规划时把「全量门禁」单列成了一项 |
| 押：panel 机制能容纳带模式的弹窗而不改渲染点形状 | 已读代码未实跑 | 成立——模式走模块级 request，`AppShell` 那行是标准写法 | — |
| 押：`editContent` 的改动能被 CodeMirror 撤销 | **未验证**，design 里写明「若不成立改为保留原文供手动回退」 | **成立**，Ctrl+Z 实测还原 | 备案未启用 |
| 押：逐 token setState 不卡顿 | 未量 | 未观察到卡顿，但**也没有量化**——输出规模只到几百字符 | 大输出下仍未验 |
| `Workspace.tsx` 改动 | 1 行 | 5 行（import + `useCallback` 包一层） | 低估：`onReady` 要同时喂 state 与 holder，塞不进一行 |

## 未达标项（及为何不下调标准）

无。B 项（分片不丢内容）本可以只看「没报警告」就算过，
但那正是 `ollama-ai-engine` 里记录过的陷阱——**输入被截而输出恰好放得下时，
API 完全察觉不到**。所以改成逐节点名核对 12 个编号，而不是信告警的沉默。

## 门控与搁置项的实证依据

- **一个组件带 mode，不做两个组件**：convert 与 tidy 的差别只有系统提示词、
  初始输入、完成动作三处，其余（流式渲染、分片进度、丢失告警、错误分类、中止）完全相同。
  拆两个组件等于把这五样各维护两份，必然各自漂移。
- **有 loss 告警时不禁用创建/替换按钮**：判断权归用户。系统能检测到「可能丢了」，
  但检测不到「这个结果对用户还有没有用」。
- **写回走 `useNotes.editContent` 而非直接 dispatch 到 CodeMirror**：
  这是可撤销与会同步的前提，已由 C 项实测确认。
- **`EditorView` 不进 zustand**：它是可变的命令式对象，放进状态库只会制造无谓重渲染。

## 已知边界

- 线上六项待用户在 Chrome 里授予 `psn-note.byjs.dev` 的本地网络权限后重跑
  （Chrome 138+ 的 Local Network Access，详见 `ollama-ai-engine/conclusion.md`）。
  代码路径与本地完全一致，本地六项全过。
- 不含 OCR / PDF：需要额外前端依赖，属于另一个量级。
- 不含多轮追问精修：`streamMarkdown` 的 `history` 参数已预留，但没有做交互。
- 流式渲染在**很大输出**下的性能未量化（实测规模仅几百字符）。
  若将来出现卡顿，节流 `onToken` 是现成的解法。
- 拖入文件上限 2 MB，超过直接拒绝——**不截断**，因为静默截断正是本功能要防的失败模式。
