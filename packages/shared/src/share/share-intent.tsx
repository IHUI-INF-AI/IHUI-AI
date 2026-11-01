// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'

/**
 * 跨端分享正文通道(2026-11-01 立)。
 *
 * 要解决的问题:小程序的「转发/朋友圈」正文必须在**页面级**注册(`useShareAppMessage`),
 * 而正文里的标题/封面是**屏**取到数据才算得出的。屏转成壳承载形制后端内不再自己注册,
 * 于是「谁注册」与「谁有数据」分家 —— 本模块就是这两层之间的那一条缝:
 *   屏侧 `usePublishShareIntent(payload)` 随数据变化发布正文;
 *   宿主侧 `useShareIntentHost()` 拿到 `read()`,在页面的分享回调里现读。
 *
 * 平台无关:只用 React 的 ref/context,不碰 Taro/DOM/RN API(§3 共享层优先、守门 126)。
 * 宿主不在树里(RN 端、web 端)⇒ context 为空 ⇒ 发布是 no-op,RN 自己的系统分享不受影响。
 * 每个宿主页面持有自己的 ref ⇒ 页面栈里两屏同一组件也不会互相覆盖正文。
 */

/** 屏发布给宿主的分享正文;字段全可选,缺的由宿主按本页路由兜底。 */
export interface ShareIntent {
  /** 转发卡标题(通常 = 内容标题) */
  title?: string
  /**
   * 朋友圈卡标题。原手写页这两张卡取的是**不同文案键**(实测 share.appTitle ⇄ share.timelineTitle、
   * share.courseTitle ⇄ share.timelineTitle),只给一枚 title 会把朋友圈卡静默换成转发卡的文案。
   * 不给时宿主回落 title。
   */
  timelineTitle?: string
  /** 分享落点;不给时宿主用本页 path?query */
  path?: string
  /** 朋友圈 query;不给时宿主用本页参数 */
  query?: string
  /** 封面图 */
  imageUrl?: string
}

/** 宿主侧拿到的两句:包装器 + 现读入口 */
export interface ShareIntentHost {
  /** 把屏包进宿主树,使屏的发布落到本宿主 */
  Wrapper: React.ComponentType<{ children?: React.ReactNode }>
  /** 分享回调里现读(渲染期快照会拿到旧数据,点了才读才是当下正文) */
  read: () => ShareIntent | null
}

type PublishFn = (next: ShareIntent | null) => void

const ShareIntentContext = React.createContext<PublishFn | null>(null)
ShareIntentContext.displayName = 'ShareIntentContext'

/** 宿主(页面)侧:建立一个只属于本页的分享正文槽 */
export function useShareIntentHost(): ShareIntentHost {
  const slot = React.useRef<ShareIntent | null>(null)
  const publish = React.useCallback<PublishFn>((next) => {
    slot.current = next ?? null
  }, [])
  const read = React.useCallback<() => ShareIntent | null>(() => slot.current, [])
  const Wrapper = React.useMemo(
    () =>
      function ShareIntentWrapper({ children }: { children?: React.ReactNode }) {
        return React.createElement(ShareIntentContext.Provider, { value: publish }, children)
      },
    [publish],
  )
  return { Wrapper, read }
}

/**
 * 屏侧:随数据把分享正文交给宿主。
 * 依赖只取四个字段的值(整对象每次渲染都是新引用 ⇒ 依赖它会把 effect 变成无限循环)。
 */
export function usePublishShareIntent(intent: ShareIntent | null): void {
  const publish = React.useContext(ShareIntentContext)
  const title = intent?.title
  const timelineTitle = intent?.timelineTitle
  const path = intent?.path
  const query = intent?.query
  const imageUrl = intent?.imageUrl
  React.useEffect(() => {
    if (!publish) return
    publish({ title, timelineTitle, path, query, imageUrl })
  }, [publish, title, timelineTitle, path, query, imageUrl])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
