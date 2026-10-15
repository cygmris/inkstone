# Requirements Document

## Introduction

将当前 `cc53c2c` 同步到 2026-10-16 实时 fetch 的官方 `upstream/main`（`f59087f`，18 个提交），保留本仓定制并部署现有 Cloudflare Worker。上游 package.json 仍为 0.8.0，交付以 commit 和 Worker version 标识。

## Alignment with Product Vision

沿用现有自托管笔记、私有访问和 AI 写作能力，不另做产品改版。

## Requirements

### Requirement 1：同步与定制保留

1. 合并保留双亲拓扑，官方 `f59087f` 必须是交付 commit 的祖先。
2. 保留 Ollama / Workers AI、摘要/标题、选区写作、流式中间更新抑制保存、CSS 修复及既有测试。
3. 保留 `wrangler.toml` 中既有 D1、R2、OAUTH_KV、Durable Objects、两个自定义域名和 cron。
4. 带入上游复制标题、ID、私有直达链接；核对地址栏行为并更新本地 backlog 的事实，不额外实现未授权的产品调整。

### Requirement 2：验证与数据保护

1. typecheck、test:unit、i18n:check、comments:check、build 和 Wrangler dry-run 通过；上游已有失败须用纯上游对照归因并闭环。
2. 在临时本地实例跑现有 E2E，不对生产运行写入式 E2E。
3. 部署前保存 D1 Time Travel bookmark、非 FTS 表导出与 SHA-256；记录生产数据计数，部署后核对。私人数据仅保存在权限受限的备份目录，不输出正文/凭据。

### Requirement 3：部署交付

1. 使用经 API 核实的 `CHRIS` 账号部署 `inkstone`；核对线上 Worker version、域名和主要 binding。
2. 部署后两个域名可访问、schema 到 13、已有笔记/附件数据保持；以真实浏览器验证可达界面，登录态不足时明确验收边界。
3. 提交本次变更并同步既有远端及两台内网 GitLab 备份；保存部署证据和回滚入口。

## Non-Functional Requirements

- 沿用项目依赖锁文件和既有模块，不重构无关内容。
- 不改用户笔记、公开分享状态或账号凭据；生产仅执行部署附带的幂等 schema 迁移。
- Worker 回滚与数据库恢复分开说明，不自动回退生产数据库。
