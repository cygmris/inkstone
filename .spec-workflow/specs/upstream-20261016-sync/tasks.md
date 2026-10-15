# Tasks Document

- [ ] 1. 合并官方 f59087f 并保留定制
  - Files: src/client/features/command/CommandPalette.tsx, src/client/features/settings/{SettingsPanel.tsx,sections.ts}, src/client/features/workspace/{EditorToolbar.tsx,Workspace.tsx}
  - _Leverage: 既有 AI 模块与 upstream-v080-sync 实现日志_
  - _Requirements: 1_
  - _Prompt: Role: 集成维护者 | Task: 开工标 [-]；逐块解决 5 处冲突并核查自动合并入口，保留双亲拓扑 | Restrictions: 不覆盖定制、不 stash、不改用户数据 | Success: 上游为祖先，定制接入口完整；先 log_implementation 再标 [x]_

- [ ] 2. 完成发布门禁与隔离 E2E
  - Files: 相关现有测试；必要的合并回归测试
  - _Leverage: package.json、scripts/e2e.mjs、INKSTONE_EPHEMERAL_DEV_
  - _Requirements: 2.1, 2.2_
  - _Prompt: Role: 验证维护者 | Task: 开工标 [-]；跑静态检查、单测、构建、dry-run、本地 E2E 与 UI 核验 | Restrictions: 生产不运行写入式 E2E；失败必须归因处理 | Success: 所有发布门禁通过，记录实际结果；先 log_implementation 再标 [x]_

- [ ] 3. 备份生产并部署、核验 Cloudflare
  - Files: docs/operations/、docs/deployments/；生产 Worker inkstone
  - _Leverage: wrangler.toml、Cloudflare CHRIS profile、D1 Time Travel_
  - _Requirements: 2.3, 3.1, 3.2_
  - _Prompt: Role: 部署维护者 | Task: 开工标 [-]；核实账号，保存恢复点及基线，部署后核对 version、schema、数据和域名 | Restrictions: 不输出凭据或笔记内容；不改已有公开分享 | Success: 部署及可达验证成功，未验范围明确；先 log_implementation 再标 [x]_

- [ ] 4. 更新待办、交付文档与远端备份
  - Files: docs/BACKLOG.md、本 spec/conclusion.md、Git remotes
  - _Leverage: repo-remotes-policy、已存在的 origin/fork_
  - _Requirements: 1.4, 3.3_
  - _Prompt: Role: 集成维护者 | Task: 开工标 [-]；更新导航待办事实、记录回滚信息、提交并推送远端 | Restrictions: 不提交私有数据；不强推或覆盖他人提交 | Success: 远端 HEAD 与交付一致，工作树干净；先 log_implementation 再标 [x]_
