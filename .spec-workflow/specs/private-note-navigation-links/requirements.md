# Requirements Document

## Introduction

完成 docs/BACKLOG.md 中尚未交付的 private-note-navigation-links：统一复制入口，补齐 URL 与笔记导航，验证后部署 Cloudflare。用户明确要求待办全部完成。

## Alignment with Product Vision

延续 Inkstone 私有 Markdown 笔记、双栏编辑、移动端与离线能力，不改变公开分享及访问权限。

## Requirements

### Requirement 1：复制入口一致

**User Story:** 作为用户，我要在笔记出现的位置复制 ID 或笔记链接，避免不同菜单缺少同一操作。

#### Acceptance Criteria

1. WHEN 打开 NoteList、ExplorerNote 或 Workspace 更多菜单 THEN 显示复制标题、复制 ID、复制笔记链接；桌面、移动端及双栏均可访问。
2. WHEN 复制 ID THEN 剪贴板内容精确等于该菜单所属笔记的 id。
3. WHEN 复制笔记链接 THEN 使用当前 origin 的 /n/<id>，不创建 shares，不附带另一栏笔记。
4. WHEN 剪贴板成功或失败 THEN 显示对应反馈；不误报成功。

### Requirement 2：地址栏与历史

**User Story:** 作为用户，我要地址栏对应当前笔记，刷新与浏览器前进后退后仍能找到原位置。

#### Acceptance Criteria

1. WHEN 打开或切换笔记 THEN URL 路径同步为当前活跃笔记的 /n/<id>，只对实际导航增加历史记录。
2. WHEN 浏览器前进或后退 THEN 恢复对应笔记，不能因同步再次追加记录或改变历史方向。
3. WHEN 刷新或直接访问链接 THEN 登录及数据加载后恢复目标笔记；未登录时保留目标路径。
4. WHEN 双栏切换焦点、关闭右栏或刷新 THEN URL、两栏笔记和活跃栏一致；笔记链接本身仍只定位一篇笔记。
5. WHEN 返回无笔记状态或目标不存在/无权访问 THEN 显示一致的空状态或错误反馈，不悄悄打开无关笔记，不形成重试循环。
6. WHEN 快速导航或编辑未同步草稿 THEN 不被旧异步响应改回旧页面，不丢弃现有离线队列与草稿。

### Requirement 3：验证与发布

**User Story:** 作为使用生产站点的用户，我要能直接使用已完成的功能。

#### Acceptance Criteria

1. WHEN 发布前 THEN 通过导航与复制回归、项目必需检查、真实浏览器桌面和移动端验证。
2. WHEN 发布 THEN 保留 CF 绑定、域名、定时任务与 AI 定制，保留可恢复备份及上一版本信息。
3. WHEN 发布后 THEN 核实生产版本、线上资源与构建一致，匿名访问私有 API 仍受保护；报告生产登录态是否实际验证。

## Non-Functional Requirements

### Code Architecture and Modularity
- 沿用 Zustand、Menu 和现有 i18n；三处复制操作共用一份实现，不引入依赖。
### Performance
- 编辑文字、保存、加载状态变化不应写入历史；仅在导航状态变化时写入。
### Security
- URL/history 不存正文、凭据或分享令牌；保持现有身份认证。
### Reliability
- popstate 与异步载入不互相覆盖；无重复监听器；旧链接继续有效。
### Usability
- 使用现有菜单与图标、键盘/触屏交互；中文链接文案统一为“复制笔记链接”。
