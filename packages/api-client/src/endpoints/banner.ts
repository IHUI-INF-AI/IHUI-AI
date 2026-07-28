/**
 * Banner 跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 字段对齐 miniapp-taro 原始定义,后端 GET /content/banner/list 返回。
 */

export interface Banner {
  id: string | number
  title: string
  coverUrl: string
  link?: string
  /** 运营位位置:home / discover / activity */
  position?: string
  /** 跳转类型:webview / page / none */
  linkType?: 'webview' | 'page' | 'none'
  /** 排序权重,数值越大越靠前 */
  sortOrder?: number
  /** 生效时间(ISO 字符串) */
  startTime?: string
  /** 失效时间(ISO 字符串) */
  endTime?: string
  /** 状态:0 草稿 / 1 已发布 / 2 已下线 */
  status?: number
}

export type BannerList = Banner[]
