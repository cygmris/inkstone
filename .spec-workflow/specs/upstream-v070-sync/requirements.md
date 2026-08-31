# Requirements Document

## Introduction

本仓自 2026-08-17 fork 起**从未同步过上游**（`git log --merges` 为空）。至今上游领先 13 个提交
并已发布 **v0.7.0**，我们停在 0.6.0。本 spec 把上游合进来，且**不破坏已在生产运行的 AI 功能**。

合并已实测：**零冲突**，57 个文件自动合上，我们的 AI 代码与 `CodeEditor` 的流式注解门控完整保留。
所以本 spec 的重心**不是解冲突，是验证"文本合干净"之后语义是否仍然正确**——
这正是自动合并最容易骗人的地方。

## Requirements

### Requirement 1：合并保留完整拓扑

1. 合并 SHALL 产生真正的 **merge commit**（双亲），使下次同步能正确识别已合过的范围
2. 合并提交本身 SHALL NOT 夹带任何人工改动——gate 修复走独立提交，便于审计与回滚

### Requirement 2：五道门恢复全绿，且分清红的是谁的问题

1. 系统 SHALL 让 typecheck / test:unit / i18n:check / comments:check / build 全部 exit 0
2. 对每一条失败 SHALL 先判定归属（我们的 / 上游的 / 环境的）**再决定修法**，不得一律改测试迁就
3. 属于上游自身缺陷的 SHALL 记录并可选地反馈上游，不得静默吞掉

### Requirement 3：AI 功能在合并后仍然成立

1. 合并后 SHALL 重跑 AI 的关键线上验收，重点是**最可能被编辑器重构悄悄破坏**的两条：
   流式落笔逐字可见、一次 `Ctrl+Z` 只撤 AI 段而不动用户自己敲的字
2. SHALL 冒烟上游新接的 Prism.js 代码高亮（AI 输出常带代码围栏）
3. SHALL 确认 `contents[noteId]` 读取路径未被上游的加载优化改变

### Requirement 4：依赖与环境可复现

1. SHALL 记录上游 lockfile 使用 npmmirror 源导致 `npm ci` 报 `EALLOWREMOTE` 的现象与解法
   （报错文字与真因相距很远，跨会话必踩）

## Clarifications（待澄清）

- [NEEDS CLARIFICATION: comments:check 的 7 条失败该怎么修？
  → **已实测消解**：在**纯上游树**（git worktree 检出 upstream/main）跑同一个脚本，
  得到**完全相同的 7 条失败** ⇒ 这是上游自己 main 上就红的门，不是合并造成的。
  修法分两类：TS 注释走既有白名单机制补进 `allowed` 表（那是该机制的本意）；
  **CSS 注释没有任何白名单机制**（`scanCss` 见 `/*` 无条件失败），只能删掉那一行。
  两者都反馈上游。]
