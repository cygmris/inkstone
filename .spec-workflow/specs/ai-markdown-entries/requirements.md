# Requirements Document

## Introduction

在 `ollama-ai-engine` 交付的本地 Ollama 引擎之上，接出两个用户可见的功能入口：

1. **AI 转 Markdown** —— 贴入或拖入原始内容（聊天记录、CLI 输出、自由文本、纯文本文件），
   本地模型整理成结构化 Markdown，直接落成一篇新笔记
2. **AI 整理当前笔记** —— 对正在编辑的笔记整篇或选中段落做同样的整理，替换或插入

两个入口共用同一个引擎，差别只在系统提示词与结果落到哪里。

前置依赖：`ollama-ai-engine` 全部任务完成（引擎、配置、设置面板、CSP 放行）。
本 spec 不碰传输协议与防丢失逻辑，只负责调用它们并把结果呈现给用户。

## Alignment with Product Vision

Inkstone 是 Markdown 笔记本，「把乱七八糟的东西变成一篇干净笔记」正是它的主场景。
本 spec 让这件事在本地模型上完成，不外传内容。

## Requirements

### Requirement 1：AI 转 Markdown 弹窗

**User Story:** 作为用户，我想把一段聊天记录贴进来，让本地模型整理成 Markdown 并存成新笔记。

#### Acceptance Criteria

1. WHEN 用户从命令面板触发「AI 转 Markdown」THEN 系统 SHALL 打开一个弹窗
2. 弹窗 SHALL 提供文本输入区，并支持拖入 `text/*` 类型文件（.txt/.md/.csv 等）读入其内容
3. WHEN 用户提交 THEN 系统 SHALL 调用引擎并**流式**显示生成中的 Markdown
4. WHEN 生成完成 THEN 用户 SHALL 可以一键创建为新笔记
5. WHEN 生成过程中用户点击停止 THEN 系统 SHALL 中止请求且不留下半截笔记
6. IF 拖入的文件不是文本类型 THEN 系统 SHALL 明确拒绝并说明只支持纯文本，不做静默忽略

### Requirement 2：内容丢失告警必须可见

**User Story:** 作为用户，如果模型吞掉了我输入的一部分，我要当场看见，而不是事后发现笔记少了一半。

#### Acceptance Criteria

1. WHEN 引擎返回的结果带 `loss` THEN 弹窗 SHALL 显示醒目告警横幅
2. 告警 SHALL 说明发生了什么（输出被截断 / 输出显著短于输入）以及可以怎么办
   （调小分片长度、换用上下文窗口更大的模型）
3. WHEN 输入被自动分片 THEN 界面 SHALL 显示当前进度（第 N 片 / 共 M 片）
4. 有告警时 SHALL 仍允许用户创建笔记 —— 判断权归用户，系统不替他决定丢弃结果

### Requirement 3：AI 整理当前笔记

**User Story:** 作为用户，我想对正在写的笔记直接做一次格式整理，而不用复制到别处再贴回来。

#### Acceptance Criteria

1. WHEN 用户从命令面板触发「AI 整理当前笔记」THEN 系统 SHALL 以当前笔记为输入调用引擎
2. IF 编辑器中有选中文本 THEN 系统 SHALL 只整理选中部分，否则整理整篇
3. WHEN 生成完成 THEN 用户 SHALL 可以选择替换原文或取消
4. WHEN 用户确认替换 THEN 改动 SHALL 走既有的笔记编辑路径，从而能被撤销与同步
5. IF 当前没有打开的笔记 THEN 该命令 SHALL 不出现在命令面板中
6. 整理路径 SHALL 与转换路径共用同一套丢失检测与告警

### Requirement 4：未配置时的引导

**User Story:** 作为第一次用的用户，我不想点了功能之后看到一个语焉不详的报错。

#### Acceptance Criteria

1. IF 连接本机 Ollama 失败 THEN 界面 SHALL 给出可操作的说明并提供直达 AI 设置分区的入口
2. 错误分类文案 SHALL 复用 `ollama-ai-engine` 的 `classifyAiError`，不另起一套

### Requirement 5：最小侵入

#### Acceptance Criteria

1. 新增代码 SHALL 全部落在新文件里
2. 对既有文件的改动 SHALL 限制在：命令面板加两条命令、必要的弹窗挂载点、i18n 文案键
3. 编辑器工具栏（`EditorToolbar.tsx`）SHALL 不被修改

## Non-Functional Requirements

### Code Architecture and Modularity
- 弹窗、整理动作、文件读取各自独立；协议细节一律留在 `lib/ai/` 不外溢
- **无注释**：`npm run comments:check` 白名单之外一行注释都不允许

### Performance
- 弹窗走 lazy import，不进主 bundle
- 流式渲染不得因为每个 token 触发整篇重排导致卡顿

### Security
- 输入内容 SHALL 只在浏览器与本机 Ollama 之间传输
- 系统提示词 SHALL 保留「把用户输入当数据而非指令」的防注入约束
  （移植自 Convertly 的 `AI_GUARD_INSTRUCTION`）

### Reliability
- 中止、失败、丢失三种非正常路径都必须有明确的界面反馈

### Usability
- 中英双语齐全（`npm run i18n:check` 是硬门）
- 仅支持 Chrome/Firefox 这条限制在失败文案里要提到
