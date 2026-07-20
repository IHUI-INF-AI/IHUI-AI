/**
 * Footer 共享数据 — SiteFooter + BrandMarquee 共用
 *
 * 2026-07-20 抽取:消除两个组件重复定义 MODELS / PROMOTIONS 等数组,
 * 单一来源,新增/删除 logo 只改一处。
 *
 * 资源路径:`public/footer/*`,Next.js public 直出,无需 import。
 * 资源名称约定:模型/平台用 `*.png`,支付/数据库用 `*.png|svg`,具体看素材。
 *
 * 数据契约:
 * - `Icon` 含 `nameKey`(i18n key,无 `footer.` 前缀)+ `src`(+ 可选 `href`)
 * - `Qr` 含 `src` + `altKey`(i18n key,值为 'officialApp' | 'contactUs')
 */
export type Icon = { readonly nameKey: string; readonly src: string; readonly href?: string }
export type Qr = { readonly src: string; readonly altKey: 'officialApp' | 'contactUs' }

// 统一图片加载策略(footer 强制 eager,首屏外也要立即显示)
export const IMG_EAGER = { loading: 'eager', decoding: 'sync' } as const

// 生态:支持的接入平台
export const SUPPORTED: readonly Icon[] = [
  { nameKey: 'platforms.n8n', src: '/footer/awsp/n8n.png' },
  { nameKey: 'platforms.coze', src: '/footer/awsp/coze.png' },
]

// 模型(8 大主流)
export const MODELS: readonly Icon[] = [
  { nameKey: 'modelItems.gpt', src: '/footer/model/2.png' },
  { nameKey: 'modelItems.claude', src: '/footer/model/3x.png' },
  { nameKey: 'modelItems.gemini', src: '/footer/model/4.png' },
  { nameKey: 'modelItems.deepseek', src: '/footer/model/5.png' },
  { nameKey: 'modelItems.qwen', src: '/footer/model/6.png' },
  { nameKey: 'modelItems.doubao', src: '/footer/model/7.png' },
  { nameKey: 'modelItems.llama', src: '/footer/model/8x.png' },
  { nameKey: 'modelItems.mistral', src: '/footer/model/9.png' },
]

// 支付平台
export const PAYMENTS: readonly Icon[] = [
  { nameKey: 'payments.wechat', src: '/footer/zf/weixin.svg' },
  { nameKey: 'payments.alipay', src: '/footer/zf/zfb.svg' },
  { nameKey: 'payments.douyin', src: '/footer/zf/dy.svg' },
  { nameKey: 'payments.unionpay', src: '/footer/zf/yl.svg' },
  { nameKey: 'payments.visa', src: '/footer/zf/visa.svg' },
]

// 云数据库
export const DATABASES: readonly Icon[] = [
  { nameKey: 'databases.mysql', src: '/footer/shujuku/1.png' },
  { nameKey: 'databases.postgresql', src: '/footer/shujuku/2.png' },
  { nameKey: 'databases.mongodb', src: '/footer/shujuku/3.png' },
  { nameKey: 'databases.redis', src: '/footer/shujuku/4.png' },
  { nameKey: 'databases.sqlite', src: '/footer/shujuku/5.png' },
]

// 官方推广平台(16 槽位,跳号 13/18 素材不存在)
export const PROMOTIONS: readonly Icon[] = [
  { nameKey: 'promos.promo1', src: '/footer/tuiguangpingtai/1.png' },
  { nameKey: 'promos.promo2', src: '/footer/tuiguangpingtai/2.png' },
  { nameKey: 'promos.promo3', src: '/footer/tuiguangpingtai/3.png' },
  { nameKey: 'promos.promo4', src: '/footer/tuiguangpingtai/4.png' },
  { nameKey: 'promos.promo5', src: '/footer/tuiguangpingtai/5.png' },
  { nameKey: 'promos.promo6', src: '/footer/tuiguangpingtai/6.png' },
  { nameKey: 'promos.promo7', src: '/footer/tuiguangpingtai/7.png' },
  { nameKey: 'promos.promo8', src: '/footer/tuiguangpingtai/8.png' },
  { nameKey: 'promos.x', src: '/footer/tuiguangpingtai/9.png', href: 'https://x.com/ok502319984' },
  {
    nameKey: 'promos.facebook',
    src: '/footer/tuiguangpingtai/10.png',
    href: 'https://www.facebook.com/share/17kQMPNhQb/',
  },
  { nameKey: 'promos.promo11', src: '/footer/tuiguangpingtai/11.png' },
  { nameKey: 'promos.promo12', src: '/footer/tuiguangpingtai/12.png' },
  { nameKey: 'promos.promo14', src: '/footer/tuiguangpingtai/14.png' },
  { nameKey: 'promos.promo15', src: '/footer/tuiguangpingtai/15.png' },
  {
    nameKey: 'promos.github',
    src: '/footer/tuiguangpingtai/16.png',
    href: 'https://github.com/AIZHS2025',
  },
  { nameKey: 'promos.promo17', src: '/footer/tuiguangpingtai/17.png' },
]

// 底部二维码(仅官方应用;原 footer-icon-3.png 是 2534×2534 全空白色块,
// 2026-07-20 用户反馈"联系我们"二维码亮色模式不可见 → 改用联系卡片代替)
export const QRS: readonly Qr[] = [
  { src: '/footer/erweima/footer-icon-2.png', altKey: 'officialApp' },
]

// 跑马灯专用:模型 + 推广平台拼接(24 张无缝循环)
export const MARQUEE_BRANDS: readonly Icon[] = [...MODELS, ...PROMOTIONS]
