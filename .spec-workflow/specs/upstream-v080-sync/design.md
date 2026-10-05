# Design

沿用 upstream-v070-sync 的做法：`git merge --no-ff v0.8.0` → 跑五道门 → 合并后红的项用
`git worktree` 检出纯 `v0.8.0` 跑同一道门对照，区分上游自身红与合并引入 → 只补数据表、不改共享脚本判定逻辑
→ `npm run deploy` → 线上核对 D1 计数、迁移版本、FTS 结构与行数、首页可用、MCP 读写一次 → 改基线 → 推三处远端。
