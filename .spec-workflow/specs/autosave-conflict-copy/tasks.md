# Tasks Document

- [x] 1. 复现并修复同页正文和元数据保存交叠
  - Files: src/client/store/notes.ts、src/client/store/notes.test.ts
  - _Requirements: 1, 2, 3_
  - 先失败测试，正文回放加入笔记写序列，在执行点取得版本，保留冲突保护。
- [x] 2. [P] 实现跨标签页 durable 版本回执与回归
  - Files: src/client/lib/db.ts、src/client/lib/db.test.ts
  - _Requirements: 1, 2_
  - 原子记录连续版本回执并推进同队列后继，enqueue/update 不倒退；覆盖广播延迟和独立客户端隔离。
- [x] 3. 集成检查及真实浏览器验证
  - Files: tests、docs/deployments/20261018-autosave-conflict-copy.md
  - _Requirements: 1, 2, 3_
  - 单页新建编辑、延迟保存、双页回放、项目门禁和隔离 API E2E。
- [-] 4. 备份并发布 Cloudflare
  - Files: docs/deployments/20261018-autosave-conflict-copy.md、conclusion.md、docs/BACKLOG.md
  - _Requirements: 2, 3_
  - 备份生产数据，发布并核实版本/资源/权限，提交及远端备份；先记录 implementation log 再完成任务。
