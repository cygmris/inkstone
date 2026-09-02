# Design Document

## 1. 定位参照系（需求 1）

`bubblePosition` 增加一个 `bounds: { top: number }` 参数——**气泡不得越过的上边界**。

```ts
const below = head.top - size.height - BUBBLE_GAP < bounds.top   // 原来比的是 BUBBLE_MARGIN
...
top: Math.max(bounds.top, Math.min(top, viewport.height - size.height - BUBBLE_MARGIN))
```

`measure()` 里 `scroller = view.scrollDOM.getBoundingClientRect()` **本来就取了**（用于判断
选区是否滚出可视区），直接把 `scroller.top` 传进去即可，不需要新查 DOM。

实测数字（2026-09-03，线上）：视口顶 0 / 内容区顶 **80** / 正文首行 88。
旧判据 `88−36−8=44 > 8` ⇒ 浮上方 ⇒ 压住工具栏；
新判据 `44 < 80` ⇒ 翻到下方 ⇒ 不再越界。

## 2. AI actions 二级菜单（需求 2）

**同源是硬要求**：工具栏与气泡各写一份菜单，加动作时必然只改一处。
故把菜单项抽成 `features/ai/ai-action-items.ts` 的 `aiActionItems(): MenuItem[]`，
`EditorToolbar` 与 `SelectionBubble` 都从这里取。

气泡上加一个 `更多`（`ai.more_actions`）按钮，`trailing` 箭头，点开挂 `Menu`——
与既有 `Change tone` / `Translate` 完全同一种交付方式。

**为什么不是把六个动作平铺进气泡**：气泡已有 6 个改写按钮，再平铺 6 个会直接撑爆宽度；
而 `bubbleMaxWidth` 只保证不溢出视口，不保证可用。二级菜单是用户点名的形态。

## 押的数

| 押的 | 值 |
| --- | --- |
| 改动文件 | 3（`SelectionBubble.tsx` / `EditorToolbar.tsx` / 新 `ai-action-items.ts`）+ locales |
| 新增代码量 | 80–120 行 |
| 押：`scrollDOM` 的 top 就是该用的上边界 | **已实测 80**，与工具栏底边一致 |
| 押：抽共享菜单不会破坏工具栏现有行为 | 未验，靠单测 + 线上 D 项 |

## Constitution Gates

- [x] 简洁门：不新造浮层组件，不加配置项
- [x] 反抽象门：`aiActionItems()` 有**两个真实使用者**才抽，不是提前抽象
- [x] 复用门：二级菜单复用既有 `Menu`；边界值复用 `measure()` 已取的 `scroller`
- [x] 精准门：不动 `stream-writer` / 引擎 / Worker
