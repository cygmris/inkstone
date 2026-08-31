# Conclusion: upstream-v070-sync

## 目标达成

需求 1–4 全部达成。本仓**首次同步上游**，从 0.6.0 合到 **v0.7.0**，
AI 功能在合并后经线上实测仍然成立。

## 交付结论

| 项 | 结果 |
| --- | --- |
| 合并 | `39a821c`，**真正的双亲 merge commit**（`b5510a0` + `4d12f28`），零冲突，68 文件 +3680/−1825 |
| 五道门 | 全部 exit 0；`test:unit` 从 225 涨到 **240**（多的 15 条是上游带来的） |
| 线上 | Version `22aa893d`，A–D 四项复验全过 |

上游带来的：Prism.js 取代编辑器语法高亮、markdown 渲染管线重写、离线缓存恢复、
大笔记本加载优化、移动端 PWA 视口、新 ErrorBoundary、MCP library 大扩充（+1282 行）。

## 预估 vs 实测

| 押的 | 预估 | 实测 | 差因 |
| --- | --- | --- | --- |
| 合并冲突数 | 我在动手前断言「`CodeEditor.tsx` 是真麻烦，删除+重写型改动大概率给不出干净结果」 | **0 冲突**，我们的注解门控三行完整保留 | ❌ **预判反了**。冲突面本可用 `merge --no-commit` 直接量出来，我却先给了判断 |
| 需改文件 | 2 + 删 1 行 | 一致 | — |
| 任务数 | 4 | 4 | — |
| AI 功能不受编辑器重构影响 | 代码层确认保留，行为未验 | **线上验证成立** | — |
| `contents[noteId]` 路径未变 | 已查 `76b486b` 未碰 store/notes | 成立 | — |

## 四个「差点判错」的地方

本 spec 的价值不在合并本身（那是一条命令），而在**四次差点把别人的问题当成自己的**：

### 1. `comments:check` 的 7 条不是我们合坏的
最初假设「合并丢了上游的白名单更新」。查证发现三方脚本**完全相同**。
于是 `git worktree` 检出**纯 upstream/main** 跑同一脚本 → **一模一样的 7 条**。
⇒ 上游是带着自己的门红着发的 v0.7.0。不做这一步就会去改自己的代码。

### 2. merge 状态被自己毁掉过一次
查白名单归属时跑的 `git stash -u` / `stash pop` —— **stash 底层是 `reset --hard`，会清掉 `MERGE_HEAD`**，
且两条都带 `2>/dev/null` 吞掉抱怨，**当场无感**。照那样提交会得到单亲普通提交，
合并拓扑丢失，下次同步会把这 13 个提交再合一遍。
判据：`git rev-parse -q --verify MERGE_HEAD`。处置：重来并**立即**落 merge commit 建立还原点。

### 3. 部署凭据的变量名早就变了
`CF_EMAIL` / `CF_KEY` 在凭据文件里**根本不存在**，现在是 `CF_CHRIS_*` / `CF_EASON_*`。
此前几次部署以为是这两个变量在起作用，其实走的是 wrangler 缓存登录态，缓存过期才暴露。
inkstone 在 `CF_CHRIS_*` 那个账号（`5dbd8f05…`）下。

### 4. 「登录态过期」是误判 —— 真因是 Chrome profile 选错
拿到登录页就判「session 过期」并把任务标 `[~]` 交还用户。**判错了**：
cookie 在 `~/.chrome-claude/Default` 里**还有 71 天有效**。
决定性一步是让浏览器自己报——`chrome://version` 的 `profile_path` 显示
**`Profile 1`（MUSA）**，而不是 `Default`（chrisyam）。
该 user-data-dir 下有 3 个 profile，启动没带 `--profile-directory`，
**Chrome 把新标签开在"最后活跃的那个 profile 窗口"**。

⇒ 共同点：**四次都是"外部环境的状态与我假定的不同"**，而每一次的表面症状都指向
"我们的代码/合并出了问题"。判据都不在代码里，在于**让被怀疑的那个东西自己报状态**。

## 顺带的收获

上一轮为「我编了两个不存在的 CSS 变量」加的守卫，**在合并当天抓到了上游的同类问题**：
`--danger-soft` 在 `ErrorBoundary.tsx` 里用着，而 tokens.css 只定义了 `--danger`
——上游错误页那个图标圆圈没有背景色。已进 `KNOWN_UPSTREAM_GAPS`，没替上游改。

## 待办（不属本 spec）

- 上游 `comments:check` 在其自己 main 上红着（7 条）+ `--danger-soft` 未定义
  → 适合打包成一个上游 issue 或一行 PR，比功能 PR 容易合
- `npm ci` 因上游 lockfile 用 npmmirror 源报 `EALLOWREMOTE`，
  解法 `npm ci --registry=https://registry.npmmirror.com`（跨会话会再踩，值得进记忆）
