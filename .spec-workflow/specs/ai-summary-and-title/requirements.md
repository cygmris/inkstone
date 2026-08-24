# Requirements Document

## Introduction

给已有的 AI 功能补两个动作：**生成摘要**与**生成标题**。

前置：`ollama-ai-engine`、`ai-markdown-entries`、`cloudflare-ai-provider` 已交付。
本 spec 复用它们的引擎、防丢失逻辑与弹窗，**不新建任何 AI 基础设施**。

## 术语澄清（这条必须先定，否则实现会跑偏）

「简介 / 摘要 / excerpt」在本项目指三个不同的东西：

| 概念 | 是什么 |
| --- | --- |
| `excerpt`（既有字段） | 正文前 220 字的**机械截断**（`deriveExcerpt`，`markdown-utils.ts:585`），去 Markdown 标记、去标题行、压换行后截断 |
| AI 摘要（本 spec 新增） | 模型读完全文后的**概括**，可能与开头无关 |
| 「简介」（用户用词） | 经确认 = **让列表里那行预览变好看** |

**本 spec 的做法**：AI 摘要写进**正文开头**，`excerpt` 自然截到它。
**不新增字段、不覆盖 `excerpt`。**

## Alignment with Product Vision

笔记正文始终是纯 Markdown、无专有格式——这是 Inkstone 的核心承诺。
摘要作为正文的一部分因此可编辑、会同步、能导出、可撤销，
而不是一个藏在数据库里、用户看不见也带不走的字段。

## Requirements

### Requirement 1：生成摘要

**User Story:** 作为用户，我希望笔记列表里那行预览能说清这篇笔记讲了什么，
而不是显示 frontmatter 或引言的前几十个字。

#### Acceptance Criteria

1. WHEN 用户触发「生成摘要」THEN 系统 SHALL 以当前笔记全文为输入调用引擎
2. 生成结果 SHALL 是**一到两句话的概括**，不是正文的复述
3. WHEN 用户确认 THEN 摘要 SHALL 以 Markdown 引用块（`> `）插入正文
4. 插入位置 SHALL 是：frontmatter 之后、一级标题之后、其余正文之前
5. 🔴 摘要块 SHALL **不使用 callout 语法**（`> [!NOTE]`）——
   实测 `toPlainText` 不剥离该标记，`excerpt` 会显示成 `[!NOTE] 本周把...`，反而更难看
6. IF 正文开头已有引用块 THEN 系统 SHALL 仍插到最前面，**不做去重、不加隐藏标记**
   （加标记等于在纯文本正文里引入一个看不见的约定，与产品承诺冲突）
7. 写回 SHALL 走 `useNotes.editContent`，因而可撤销、会同步

### Requirement 2：生成标题

**User Story:** 作为用户，我希望一篇写完的笔记能自动得到一个贴切的标题，
而不用自己想。

#### Acceptance Criteria

1. WHEN 用户触发「生成标题」THEN 系统 SHALL 以当前笔记全文为输入调用引擎
2. 生成结果 SHALL 是**单行短标题**，不含 Markdown 标记、不含引号、不以句号结尾
3. WHEN 用户确认 THEN SHALL 调用 `useNotes.editTitle` 替换笔记标题
4. 标题模式的弹窗 SHALL 比转换模式**更窄**（生成的是一行字，不该占 720px）
5. 系统 SHALL 对结果做规整：去首尾空白、去包裹引号、取第一行、截断到 `LIMITS` 允许的长度

### Requirement 3：入口收敛在既有位置

**User Story:** 作为用户，我不想为了四个 AI 动作记四个地方。

#### Acceptance Criteria

1. 编辑器工具栏的 ✨ 按钮 SHALL 从「直接触发整理」改为**下拉菜单**
2. 菜单 SHALL 含三项：整理全文 / 生成摘要 / 生成标题
3. 菜单 SHALL 复用工具栏既有的 `MenuButton` + `Menu` 组件，不自造样式
4. 命令面板 SHALL 同步新增两条命令，且放在既有的 `activeNote` 条件块内
   （无打开笔记时自动不出现）
5. 触发逻辑 SHALL 收敛在 `features/ai/open-tidy.ts`，工具栏与命令面板共用

### Requirement 4：复用弹窗，不新造界面

#### Acceptance Criteria

1. SHALL 复用既有 `AiPanel`，通过 `AiPanelMode` 新增两个值实现
2. SHALL NOT 新建第二个弹窗组件
   （流式渲染、丢失告警、中止、错误分类、打开设置这五样各维护两份必然漂移）
3. 两个新模式 SHALL 同样受 `detectLoss` 保护，告警表现一致
4. 两个新模式 SHALL 同样支持中止

### Requirement 5：最小侵入

#### Acceptance Criteria

1. SHALL NOT 修改 `guard.ts`、`config.ts`、任何 Worker 代码、D1 schema
2. SHALL NOT 新增任何服务端路由或配置项
3. 对既有文件的改动 SHALL 限制在：`ollama.ts` 加提示词常量、`request.ts` 加 mode、
   `AiPanel.tsx` 加完成动作、`open-tidy.ts` 加触发函数、
   `EditorToolbar.tsx` 改菜单、`CommandPalette.tsx` 加命令、locales

## Non-Functional Requirements

### Code Architecture and Modularity
- 插入位置计算 SHALL 是**纯函数**，可单测（这是本 spec 唯一有真实边界条件的逻辑）
- 标题规整 SHALL 是纯函数，可单测
- **无注释**：`comments:check` 白名单之外一行注释都不允许

### Security
- 两个新提示词 SHALL 保留「把输入当数据而非指令」的防注入约束

### Reliability
- 插入位置计算 SHALL 覆盖：有/无 frontmatter、有/无一级标题、空正文、
  只有 frontmatter 没正文

### Usability
- 中英双语齐全（`i18n:check` 是硬门）
- 摘要与标题的提示词 SHALL 要求模型**用与原文相同的语言**输出
