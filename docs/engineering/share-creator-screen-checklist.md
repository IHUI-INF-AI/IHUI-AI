<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# ShareCreatorScreen 待建清单

> 结论来源：第三批 `pages/share/index`（913 行）判定。该页是"分享创作 / 信息流"页，与共享屏
> `ShareScreen`（targetTitle / remark / result / onCreate / onShare 的"分享结果页"）不是同一概念。
> 本清单是**待建任务**，不是已完成项。落盘位置刻意放在 `scripts/data/` 之外。

## 1. 判定口径（本批三条件，写在此处供头注引用）

一页算"真薄壳"必须同时满足：

1. 页内无成片渲染代码（只剩壳层 wrapper / 接线）；
2. 与共享屏无重复 UI 段（同一视觉块不得在页与共享屏各实现一份）；
3. 共享屏那部分 web 或 RN 至少一端真在用（否则是把小程序代码搬进共享包）。

缺一条件即记"包壳（未去重）"。

本轮判定：

| 页面 | ① 页内渲染 | ② 重复 UI | ③ web/RN 使用 | 判定 |
| --- | --- | --- | --- | --- |
| `pkg-user/user/password` | 46 行（wrapper 2 元素） | 0 | ChangePwdScreen RN 在用 | 真薄壳 |
| `pages/community/index` | 399 行（改前 358） | 3 段 | 新 props 仅小程序 | 包壳 |
| `pkg-ai/developer/income` | 292 行（改前 404） | 1 段 | 新 props 仅小程序 | 包壳 |
| `pkg-shop/vip/index` | 75 + 弹层 147 = 222（改前 328） | 1 段 | 20 props 仅小程序 | 包壳 |
| `pages/share/index` | 320 行（未减） | 0（无对应屏） | 未接共享屏 | 未薄壳 |
| `pages/user/index` | 779 行（未动） | — | — | 小程序独有链路 |

## 2. `ShareCreatorScreen` props 契约

```ts
export interface ShareCreatorScreenProps {
  /** 必填：翻译与主题 */
  t: (key: string, options?: Record<string, unknown>) => string
  colorScheme?: 'light' | 'dark'
  /** 导航/提示端口（壳注入） */
  onNavigate: (target: string) => void
  onToast: (message: string, options?: { kind?: 'info' | 'success' | 'error' }) => void

  /** 顶部 tab：latest / hot / following */
  tab: 'latest' | 'hot' | 'following'
  onSelectTab: (tab: 'latest' | 'hot' | 'following') => void

  /** 分类横条（赛道） */
  categories?: ReadonlyArray<{ id: string; name: string; icon?: ReactNode }>
  activeCategory?: string | null
  onSelectCategory?: (id: string | null) => void

  /** 搜索 */
  keyword?: string
  onKeywordChange?: (value: string) => void
  searchPlaceholder?: string

  /** 信息流 */
  items: ReadonlyArray<{
    id: string
    title: string
    summary?: string
    coverUri?: string
    authorName?: string
    likeCount?: number
    createdAt?: string
  }>
  loading?: boolean
  refreshing?: boolean
  error?: string
  hasMore?: boolean
  onRefresh: () => void
  onLoadMore?: () => void
  onPressItem: (id: string) => void

  /** 排行榜抽屉（数据由壳取，屏只渲染） */
  ranking?: {
    visible: boolean
    onClose: () => void
    items: ReadonlyArray<{ id: string; name: string; score: number }>
  }

  /** 兴趣赛道弹窗 */
  interestTracks?: {
    visible: boolean
    onClose: () => void
    items: ReadonlyArray<{ id: string; name: string; selected: boolean }>
    onToggle: (id: string) => void
  }

  /** 分享卡（小程序 canvas 专属，可整体替换） */
  renderShareCard?: () => ReactNode

  onBack?: () => void
  onShare?: () => void
}
```

## 3. 需从本页上移的渲染块（当前页 320 渲染行）

| 块 | 现状（页内） | 目标位置 | 预估行 |
| --- | --- | --- | --- |
| 顶部 tab（最新/热门/关注） | 页内 JSX | 共享屏 | 35–45 |
| 分类横条 / 赛道 | 页内 JSX + 本地弹层 | 共享屏（`CategoryInlineBar` 复用） | 30–40 |
| 搜索区 | 页内 `InputArea` | 共享屏 | 25–35 |
| 信息流卡片列表（含空/加载/错误态） | 页内 JSX | 共享屏 | 90–120 |
| 排行榜抽屉 | 页内覆盖层 | 共享屏 | 45–60 |
| 兴趣赛道弹窗 | 页内覆盖层 | 共享屏 | 40–55 |
| 分享卡 | 页内 canvas/图片 | 保留壳（平台专属），经 `renderShareCard` 注入 | 30–40 |
| 返回 / 分享动作 | 页内接线 | 共享屏（端口回调） | 10 |

预计 `ShareCreatorScreen` **450–500 行**；上移后本页壳预计 **120–180 行**（取数、分页、鉴权、
canvas 分享与平台 API 留在壳内）。

## 4. web 侧是否有同类屏可复用

- `apps/web/app/(main)/share/page.tsx`：`redirect('/')`，不可复用；
- `apps/web/app/(main)/publish/new/page.tsx`：发布编辑器（富文本 + AI 辅助 + 平台预览），与"创作信息流"概念不同；
- `apps/web/app/(main)/circles/post/page.tsx`：圈子发帖，非信息流；
- `apps/web/app/(main)/share/[code]/page.tsx` / `h5/share/[code]/page.tsx`：分享落地页，对应的是结果页而非创作流。

结论：**web 无同类"分享创作信息流"屏可直接复用**，`ShareCreatorScreen` 需新建；可复用的只有
`CategoryInlineBar` 与列表态组件（`packages/app/src/components`）。

## 5. 为什么本轮不落地

1. **共享层缺口**：`ShareScreen` 是"分享结果页"（targetTitle / remark / result / onCreate / onShare），
   本页是"分享创作信息流"；两者 props 面与渲染块几乎不重叠，无法靠加几个可选 prop 收敛。
2. **web 无可复用同类屏**：`apps/web/app/(main)/share/page.tsx` 是 `redirect('/')`；
   `apps/web/app/(main)/publish/new/page.tsx` 是发布编辑器；`apps/web/app/(main)/circles/post/page.tsx`
   是圈子发帖。均不具备"tab + 分类 + 搜索 + 信息流 + 排行 + 赛道"的创作流形态。
3. **本轮已回退的 3 页为什么判"搬码"而非单源**：
   - `community`：页内渲染行 358→399（不降反增）；顶栏/搜索框/分类条与共享屏各有一份；新增 10 插槽
     与 6 端口在 web/RN 零消费，只有小程序传。
   - `income`：页内仍留 292 渲染行（提现明细 + 两步弹层）；共享屏内置 Modal 与壳 `renderWithdrawModal`
     双份；`renderSubView/renderWithdrawModal/onOpenWithdrawDetail` 仅小程序使用。
   - `vip`：页内 75 行 + 另建弹层 147 行；介绍弹层与共享屏 introduce 入口双份；20 个新 prop 仅小程序使用。
   三页均违反判定口径 ①（成片渲染仍在）与 ③（新增段无 web/RN 消费），故按"包壳（未去重）"回退。

## 6. 验收

- 页内渲染行 ≤ 180；
- 与共享屏重复 UI 段 0；
- web 或 RN 至少一端接入 `ShareCreatorScreen`（否则按本清单第 1 节判"包壳"）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
