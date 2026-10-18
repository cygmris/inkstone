# Tasks Document

- [x] 1. [P] 统一所有笔记复制入口
  - File: features/notes/note-copy-items.tsx、NoteList.tsx、ExplorerNote.tsx、Workspace.tsx、locales、tests/note-copy-items.test.ts
  - _Leverage: 原 NoteList copyText、Menu、toast_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Prompt: Implement the task for spec private-note-navigation-links, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 | Task: 开工标 [-]，统一复制操作，补桌面正文更多入口 | Restrictions: 不动导航和后端，不覆盖他人修改 | Success: 菜单可达、剪贴板值及失败反馈正确；先 log_implementation 再标 [x]_

- [x] 2. [P] 实现私有笔记 URL 与历史恢复
  - File: features/shell/note-navigation.ts、AppShell.tsx、store/notes.ts、tests/note-navigation.test.ts
  - _Leverage: useUi 工作区状态、openNote 序号与导航竞争检测_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - _Prompt: Implement the task for spec private-note-navigation-links, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 状态管理工程师 | Task: 开工标 [-]，建立 History 适配与回归 | Restrictions: 不修改持久化数据模型或草稿流程 | Success: 初始化、双栏、popstate、错误路径、竞争与刷新均通过；先 log_implementation 再标 [x]_

- [x] 3. 完成检查与浏览器交互验证
  - File: tests、docs/deployments/20261018-private-note-navigation.md
  - _Leverage: 项目必需检查、codex-browser、隔离本地实例_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1_
  - _Prompt: Implement the task for spec private-note-navigation-links, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 验证工程师 | Task: 开工标 [-]，跑静态门禁和真实桌面/手机交互 | Restrictions: 不修改生产笔记 | Success: 剪贴板与 URL 实测正确，记录产物；先 log_implementation 再标 [x]_

- [x] 4. 部署 Cloudflare 并完成交付记录
  - File: docs/deployments/20261018-private-note-navigation.md、docs/BACKLOG.md、conclusion.md
  - _Leverage: 既有 Cloudflare 凭据包装和快照脚本、repo-remotes-policy_
  - _Requirements: 3.2, 3.3_
  - _Prompt: Implement the task for spec private-note-navigation-links, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 发布维护者 | Task: 开工标 [-]，备份、发布、核实线上资源和权限，提交及远端备份 | Restrictions: 不改绑定，不输出私密信息 | Success: 生产新版本生效，backlog 标 shipped，记录验证边界；先 log_implementation 再标 [x]_
