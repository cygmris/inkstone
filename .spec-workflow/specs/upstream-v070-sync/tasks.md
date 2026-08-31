# Tasks Document

- [x] 1. 合并上游并保留拓扑
  - 已完成：`39a821c`，双亲 `b5510a0` + `4d12f28`，零冲突，57 文件自动合并
  - _Requirements: 1.1, 1.2_

- [x] 2. 修 CSS token 守卫的 5 条
  - File: tests/css-tokens.test.ts
  - `--app-viewport-` 前缀进 `INJECTED_AT_RUNTIME`；`--danger-soft` 进 `KNOWN_UPSTREAM_GAPS`
  - _Requirements: 2.1, 2.2, 2.3_
  - _Prompt: Role: 前端工程师 | Task: 按实测归属分别处理 5 个未定义 token | Restrictions: 运行时注入与真 bug 必须分开处理，不得一律塞进同一个例外表；不加注释 | Success: test:unit 全绿，且既有「例外表不会烂掉」的断言仍然盯着 --danger-soft_

- [x] 3. 修 comments:check 的 7 条
  - File: scripts/check-comments.mjs、src/client/styles/tokens.css
  - TS 注释补进 `allowed` 表；CSS 注释删掉那一行（无白名单机制）
  - _Requirements: 2.1, 2.2, 2.3_
  - _Prompt: Role: 前端工程师 | Task: 让 comments:check 恢复 exit 0 | Restrictions: 不改 scanCss 的判定逻辑——那是和上游共享的脚本，改逻辑每次同步都要重解；只补数据表与删那一行注释；不加注释 | Success: comments:check exit 0；五道门全绿_

- [x] 4. 部署与线上复验
  - File: 无
  - A 流式逐字可见（细采样）/ B 一次 Ctrl+Z 只撤 AI 段 / C Prism 代码高亮 / D 不清 SW 也能拿到新版
  - _Requirements: 3.1, 3.2, 3.3_
  - _Prompt: Role: QA | Task: 部署后跑 A–D | Restrictions: A 项采样间隔必须比生成快，否则测不到；验撤销后不要按快捷键「重做」还原（不是本编辑器的重做键，会多撤几步）；测试笔记用完移入回收站；未全过就标 [~] 写明 Blocked | Success: A–D 都有明确结论并记入实现日志_
