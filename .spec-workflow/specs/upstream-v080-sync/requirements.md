# upstream-v080-sync — Requirements

## 背景
线上停在上游 v0.7.0 + 本仓 29 个自有提交（AI 写作等）。上游已发布 v0.8.0（相对分叉点 11 个提交），
其中 schema 迁移 v12 只增/重建索引，另会把 `notes_fts` 的 `note_id` 由 UNINDEXED 改为可索引（事务内整表重建，失败回落 LIKE 搜索）。
update-watch（idc `cloudflare/update-watch`）已因此推送「上游有更新」。

## 需求
1. WHEN 合并上游 tag `v0.8.0`，THE SYSTEM SHALL 保留合并拓扑（`--no-ff`），本仓自有改动不丢。
2. WHEN 合并完成，THE SYSTEM SHALL 五道门（typecheck / test:unit / i18n:check / comments:check / deploy:check）全部 exit 0；
   合并后变红的项要分清是上游自身就红还是合并引入。
3. WHEN 部署上线，THE SYSTEM SHALL 数据不丢：notes 280、live 257 不变；`schema_migrations` 最大版本到 12；
   `notes_fts` 行数 = 未删除笔记数，且建表语句不再含 `note_id UNINDEXED`。
4. WHEN 部署完成，THE SYSTEM SHALL 把 update-watch 的 `baseline:inkstone` 改为 `0.8.0`。

## 回滚
D1 Time Travel 书签 `0000244b-00000000-000050fb-677639447d8bccd697e4e5ac856f9a9a`（升级前）；
非 FTS 表导出 `/agentdata/backups/inkstone/inkstone-db-20261005-pre-v0.8.0-nofts.sql`。
（`wrangler d1 export` 不支持含 FTS5 虚拟表的库，整库导出会报错。）
