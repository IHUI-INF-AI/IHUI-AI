// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { CategoryItem } from '@ihui/types'
import type { TFunction } from '../../types'

/**
 * 分享创作流条目(壳侧把接口字段映射进来,共享屏不感知接口形态)。
 *
 * 字段集与 `docs/engineering/share-creator-screen-checklist.md` §2 一致;
 * 封面/点赞数本期共享屏不渲染(RN 资讯卡历史上也没有这两块),先留位给后续同源。
 */
export interface ShareCreatorItem {
  id: string
  title: string
  summary?: string
  coverUri?: string
  authorName?: string
  likeCount?: number
  createdAt?: string
}

/**
 * `ShareCreatorScreen` 契约。
 *
 * 只收「web 或 RN 真消费」的端口(裁决点 1):本期 RN 消费 items/categories/刷新/分页/
 * 返回;顶部 tab、搜索、排行榜、兴趣赛道、分享卡在小程序页内仍是独有实现,
 * 按缺段协议留在端内,不在此处加只有小程序传的 props。
 */
export interface ShareCreatorScreenProps {
  /** 必填:翻译 */
  t: TFunction
  colorScheme?: 'light' | 'dark'

  /** 信息流条目(必填) */
  items: readonly ShareCreatorItem[]
  loading?: boolean
  refreshing?: boolean
  error?: string
  onRefresh: () => void
  onLoadMore?: () => void
  onRetry?: () => void
  onPressItem: (id: string) => void

  /** 分类横条(赛道) */
  categories?: readonly CategoryItem[]
  activeCategory?: string | null
  onSelectCategory?: (id: string) => void

  /** 返回顶部(内置列表滚动回调,壳注入滚动实现) */
  showBackTop?: boolean
  onBackToTop?: () => void
  onListRef?: (ref: unknown) => void

  /** 返回(可选;根 Tab 页不传,避免与抽屉菜单键并列) */
  onBack?: () => void

  /** 滚动内容区底部预留(px,RN 悬浮 TabBar 让位) */
  contentBottomPadding?: number
}
