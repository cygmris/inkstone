# Tasks Document

- [x] 1. 定位参照系改为编辑器内容区上边界
  - File: src/client/features/ai/SelectionBubble.tsx、selection-bubble.test.ts
  - `bubblePosition` 加 `bounds: { top }`；`measure()` 传 `scroller.top`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Prompt: Role: 前端工程师 | Task: 把翻转与夹取的参照系从视口顶部改为内容区上边界 | Restrictions: 不得新查 DOM——measure() 已取到 scroller；既有"上方有空间时浮上方且不遮挡选中文字"的断言必须仍然通过；不加注释 | Success: 新增断言覆盖「选区贴内容区顶部时不越过 bounds.top」，且把 bounds.top 换回 BUBBLE_MARGIN 的变异能让它转红_

- [x] 2. 抽出共享的 AI actions 菜单项
  - File: src/client/features/ai/ai-action-items.ts（新建）、EditorToolbar.tsx（改为引用）
  - _Requirements: 2.2_
  - _Prompt: Role: 前端工程师 | Task: 把工具栏的 aiItems 抽成共享函数 | Restrictions: 标签与 onSelect 原样搬，行为零变化；不得在两处各留一份；不加注释 | Success: 工具栏菜单项与抽取前逐项一致_

- [x] 3. 气泡加「更多」二级菜单
  - File: src/client/features/ai/SelectionBubble.tsx、locales×2
  - _Requirements: 2.1, 2.3, 2.4_
  - _Prompt: Role: 前端工程师 | Task: 气泡加一个 trailing 箭头的「更多」按钮，挂 Menu 展示 aiActionItems() | Restrictions: 交互必须与 Change tone/Translate 一致，复用既有 Menu；既有六个改写按钮不动；不加注释 | Success: 五道门全绿_

- [x] 4. 部署与线上验收
  - File: 无
  - A 全选后气泡不挡工具栏 / B 气泡「更多」六项齐全且能触发 / C 上方有空间时仍浮上方 / D 工具栏 ✨ 菜单无回归
  - _Requirements: 1.x, 2.x_
  - _Prompt: Role: QA | Task: 部署后跑 A–D | Restrictions: A 项要量气泡 rect 与工具栏 rect 是否相交，不能只看截图像不像；测试笔记用完移入回收站；未全过标 [~] 写明 Blocked | Success: A–D 都有明确结论并记入实现日志_
