// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 动态详情的「互动动作栏」契约(2026-11-14 立)。
 *
 * 治的是哪一族病:同一个语义(点赞/评论/收藏/分享的计数与可点性)在三端各写一套 ——
 *   · 小程序 `pages/circle/detail.tsx` 渲染 **4 项**(赞/评/藏/享),其中 3 项可点;
 *   · 共享屏 `packages/app/src/features/post-detail/PostDetailScreen.tsx` 只有 **2 项**(赞/评),
 *     且 2026-11-14 改成只读 View(behavior 面没有点赞写端点,假按钮会误导用户)。
 * 两边项数不同、可点性不同、图标名不同 ⇒ 这不是"谁漏了",而是**契约没立**:
 * 每端都在猜"这屏该有几个动作、哪个能点"。
 *
 * 本文件把三件事钉成单一源:
 *   ① 动作的**枚举与顺序**(`POST_ACTION_IDS`);
 *   ② 每项的**图标名**(与小程序 `LineIcon` 注册表同名,RN 侧映射到 lucide);
 *   ③ **可点性规则**(`isPostActionInteractive`):没有回调 = 只读,不允许渲染成假按钮。
 *
 * 归属说明(2026-11-14):本文件从 `packages/app/src/features/post-detail/` 移到 `@ihui/shared`,
 * 原因是 `packages/app` 的 package.json exports 只有 `./features/*` → `*.tsx`,
 * **`.ts` 文件解析不到**;而本契约必须是纯数据 + 纯函数(三端都消费),
 * 放进 shared 才是它的正确归属(shared 的 exports 支持 `.ts`)。
 *
 * 纪律:本文件不 import 任何平台原语(react-native / @tarojs/components),
 * 视图仍各端自渲染,但"渲染什么、能不能点"只在这里判。
 */

/** 动作 id。顺序即渲染顺序(赞 → 评 → 藏 → 享)。 */
export const POST_ACTION_IDS = ['like', 'comment', 'favorite', 'share'] as const

export type PostActionId = (typeof POST_ACTION_IDS)[number]

/**
 * 动作图标名(与小程序 `LineIcon` 注册表同名)。
 * RN 侧由调用方映射到 lucide 组件,两端图标语义由此对齐。
 */
export const POST_ACTION_ICON: Record<PostActionId, string> = {
  like: 'heart',
  comment: 'message-circle',
  favorite: 'star',
  share: 'share-2',
}

/** 动作的计数(纯数据,平台注入) */
export interface PostActionStats {
  likes: number
  comments: number
  favorites: number
  shares: number
}

/** 哪些动作当前处于"已选中"态(点赞过 / 收藏过) */
export interface PostActionFlags {
  liked?: boolean
  favorited?: boolean
}

/**
 * 动作回调。**缺省 = 该动作只读**。
 * 为什么用可选而不是必填:`comment` 在没有任何端有评论页可跳时,不该被逼着传一个空函数
 * (空函数会让按钮可点却什么都不发生 —— 正是 2026-11-14 修掉的那型假按钮)。
 */
export interface PostActionHandlers {
  onLike?: () => void
  onComment?: () => void
  onFavorite?: () => void
  onShare?: () => void
}

/** 单个动作的渲染描述:视图层只消费这个,不再自己判断"能不能点 / 亮不亮" */
export interface PostActionDescriptor {
  id: PostActionId
  icon: string
  count: number
  /** 是否处于选中态(仅 like/favorite 有意义) */
  active: boolean
  /** 是否有回调。false ⇒ 必须渲染成只读 View,不得渲染成可点按钮 */
  interactive: boolean
  onPress?: () => void
}

/**
 * 是否可点:有回调才可点。
 *
 * 这条判据单独导出,是因为它是**唯一的可点性真相源** —— 视图层不得再写
 * `onClick={onShare}` 这种"有就绑、没有就渲染个死 View"的分支。
 */
export function isPostActionInteractive(
  id: PostActionId,
  handlers: PostActionHandlers | undefined,
): boolean {
  if (!handlers) return false
  switch (id) {
    case 'like':
      return typeof handlers.onLike === 'function'
    case 'comment':
      return typeof handlers.onComment === 'function'
    case 'favorite':
      return typeof handlers.onFavorite === 'function'
    case 'share':
      return typeof handlers.onShare === 'function'
    default:
      return false
  }
}

/**
 * 把「计数 + 选中态 + 回调」投影成渲染描述数组。
 *
 * @param stats    计数(缺项按 0 渲染,不造数据)
 * @param flags    选中态
 * @param handlers 回调;某动作没给回调 ⇒ 该项 interactive=false(只读)
 * @param only     只渲染这些动作(缺省 = 全部 4 项)。给它是为了兼容"这屏只展示 2 项"的端,
 *                 而不是让它们各自写一份硬编码列表。
 */
export function projectPostActions(
  stats: PostActionStats,
  flags: PostActionFlags = {},
  handlers: PostActionHandlers = {},
  only?: readonly PostActionId[],
): PostActionDescriptor[] {
  const ids = only && only.length > 0 ? only : POST_ACTION_IDS
  const countOf: Record<PostActionId, number> = {
    like: stats.likes ?? 0,
    comment: stats.comments ?? 0,
    favorite: stats.favorites ?? 0,
    share: stats.shares ?? 0,
  }
  const handlerOf: Record<PostActionId, (() => void) | undefined> = {
    like: handlers.onLike,
    comment: handlers.onComment,
    favorite: handlers.onFavorite,
    share: handlers.onShare,
  }
  const activeOf: Record<PostActionId, boolean> = {
    like: flags.liked === true,
    comment: false,
    favorite: flags.favorited === true,
    share: false,
  }
  return ids.map((id) => ({
    id,
    icon: POST_ACTION_ICON[id],
    count: countOf[id],
    active: activeOf[id],
    interactive: isPostActionInteractive(id, handlers),
    onPress: handlerOf[id],
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
