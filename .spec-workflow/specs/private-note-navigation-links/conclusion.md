# Conclusion: private-note-navigation-links

## 目标达成

完成当前 BACKLOG 的全部未交付项：统一三处复制入口、地址栏同步、前进后退、刷新、双栏恢复，并发布到 Cloudflare。

## 交付结论

- `getNoteCopyItems` 为文件夹树、笔记列表、正文工具栏共用；桌面单栏新增更多按钮，手机/双栏保持一致。
- `startNoteNavigation` 维护 `/n/<activeNoteId>` 与用户隔离的 history.state 工作区快照。普通新标签链接只打开该篇，历史条目可恢复双栏。
- 取消旧异步选择不清除草稿。真实 404 调整摘要清理顺序，避免追加坏历史；回收站沿用现有可打开行为，恢复 trash 视图。
- 代码提交 `16d401b`；已推 fork/origin/gitlab-old。CF version `d94f2ddf-0372-42bf-9825-cbde2feaf44a`，100% 流量。部署日期 2026-10-18。

## 验收证据

- 实测 47 test files / 412 unit tests；包含新增 15 项菜单和 16 项导航回归。
- 实测隔离 API E2E 175 passed / 0 failed；typecheck、i18n 1277 keys、comments、build、deploy dry-run 均通过。
- 实测 Chrome 本地登录账号：复制 ID 和笔记链接经真实剪贴板粘贴比对；桌面/手机菜单、前进后退、刷新、双栏焦点与关闭、无效链接空状态通过。
- 实测手机 390×844 菜单在视口内，截图人工核对。桌面双栏更多菜单位置与对应笔记一致。
- 实测两个生产域名的入口、AppShell、Workspace、复制操作共享 chunk、中文语言 chunk 与构建字节完全一致；匿名私有 API 401。
- 实测 SQL 导出恢复 integrity_check=ok；部署前后表计数、笔记元数据指纹和绑定一致。无新增分享。

## 预估 vs 实测

| 项 | 预估 | 实测 | 差因 |
| --- | --- | --- | --- |
| 新增运行依赖 | 0 | 0 | 沿用 History API、Zustand、Menu |
| Worker/数据库结构变化 | 0 | 0 | 仅前端与客户端 store |
| 导航适配模块 | 约150行 | 95行 | 复用现有加载与状态机制 |
| 交付任务 | 4 | 4 | 全部完成 |

## 已知边界

生产 Chrome 未登录，因此生产登录态菜单未实测；交互验证来自隔离本地账号，生产完成部署与资源/权限/数据一致性核对。未调用真实 AI 生成，保留既有相关单测与编辑器注册链。备份、生产资源信息及完整证据位置保存在私有 `docs/deployments/20261018-private-note-navigation.md`，未提交备份或私有笔记数据。

## 处理调整

复审纠正了真实 404 回退的历史顺序问题，并补了 editContent 形成真实待写队列后的导航保护测试。生成的实现日志行数统计已按实际 Git diff 与新文件行数核算，未沿用初填估数。
