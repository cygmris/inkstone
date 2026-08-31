# Design Document

## Overview

合并已完成（`39a821c`，双亲 `b5510a0` + `4d12f28`，零冲突）。本设计只讲**合并之后要做什么**。

## 合并后的真实状态（实测，非预估）

| 门 | 结果 | 归属 |
| --- | --- | --- |
| typecheck | ✅ exit 0 | — |
| build | ✅ exit 0 | — |
| i18n:check | ✅ exit 0 | — |
| test:unit | ❌ 1/240 失败 | **我们的** CSS token 守卫，抓到上游 5 个未定义 token |
| comments:check | ❌ 7 条 | **上游的**（纯 upstream 树复现同样 7 条） |

## 修法

### 1. CSS token 守卫的 5 条（`tests/css-tokens.test.ts`）

实测分类，两类修法不同：

- `--app-viewport-height/width/top/left`：**运行时注入**，`src/client/lib/viewport.ts` 用
  `root.style.setProperty` 设置 → 加进 `INJECTED_AT_RUNTIME`（与既有 `--shiki-` / `--code-` 同类）
- `--danger-soft`：`ErrorBoundary.tsx` 在用，但 tokens.css **只定义了 `--danger`**
  → **上游真 bug**（错误页那个图标圆圈没有背景色），加进 `KNOWN_UPSTREAM_GAPS`。
  既有那条「例外表不会烂掉」的断言会自动盯住它，无需另写测试。

### 2. comments:check 的 7 条

**已实测确认是上游自己 main 上就红的**，不是合并造成。两类：

- **TS 注释 4 条**（`codeLanguages.ts` ×2、`i18n.ts` ×2）+ 1 条失效白名单项（`i18n.ts` 的旧注释被上游改写）
  → 走既有 `allowed` 白名单机制补齐。这是该机制的本意，且**改的是共享脚本里的数据表**，
  下次同步的冲突面是可预期的一小块。
- **CSS 注释 1 条**（`tokens.css:136`）→ `scanCss` 对 `/*` **无条件失败，没有任何白名单机制**。
  只能删那一行。选删注释而不是改脚本逻辑：改逻辑等于和上游的门打架，每次同步都要重解。

### 3. 依赖

上游 lockfile 用 npmmirror 源（573 条），本机 registry 是 npmjs → `npm ci` 报 `EALLOWREMOTE`
「Fetching packages of type "remote" have been disabled」。
解法：`npm ci --registry=https://registry.npmmirror.com`。
**报错文字与真因相距很远**，且 `npm ci` 会先清空 `node_modules`，失败后一切门都红成"代码坏了"的样子。

## 验证策略

单测覆盖不了"合并语义是否正确"，故重心在线上：

- **A**：流式落笔逐字可见（细采样，别用比生成还慢的间隔）
- **B**：一次 `Ctrl+Z` 只撤 AI 段，用户自己敲的字仍在 —— 上游动了编辑器（删高亮 → 接 Prism），
  这条最可能被悄悄破坏
- **C**：带代码围栏的笔记 → 预览用 Prism 渲染正常、console 干净
- **D**：不清 Service Worker 自然刷新也能拿到新版（上游 `ec42b77` 声称修的就是这个）

## 本设计押的数

| 押的 | 值 |
| --- | --- |
| 合并冲突数 | **实测 0**（我原本预估 `CodeEditor.tsx` 会很麻烦——**预估错了**） |
| 需改文件 | 2（`tests/css-tokens.test.ts`、`scripts/check-comments.mjs`）+ 删 1 行 CSS 注释 |
| 任务数 | 4 |
| 押：AI 功能不受编辑器重构影响 | 代码层已确认注解门控保留，**行为未验**，靠 A/B 项 |
| 押：`contents[noteId]` 路径未变 | **已查**：`76b486b` 只动 NoteList/AppShell/pwa.config，未碰 store/notes |

## Constitution Gates

- [x] 简洁门：不趁机重构、不动上游新代码（除必须删的那行 CSS 注释）
- [x] 反抽象门：不为白名单再造一层配置
- [x] 复用门：CSS 守卫复用既有 `INJECTED_AT_RUNTIME` / `KNOWN_UPSTREAM_GAPS` 两个口子
- [x] 精准门：合并提交与 gate 修复分开提交；不碰 AI 功能代码
