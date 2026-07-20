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
 * - `Icon` 含 `nameKey`(i18n key,无 `footer.` 前缀)+ `src`(+ 可选 `href` + 可选 `mono`)
 * - `Qr` 含 `src` + `altKey`(i18n key,值为 'officialApp' | 'contactUs')
 *
 * `mono` 标记(2026-07-20 加):原图是纯白 + 透明背景,在亮色模式下白底白图不可见。
 * 标记后,SiteFooter / BrandMarquee 给 `<img>` 应用 `invert dark:invert-0` filter:
 * - 亮色模式:白→黑,黑底白图,清晰可见
 * - 暗色模式:还原原图(白底),深色背景上白色图标可见
 * 已用 PIL top3 颜色采样确认:被标 mono 的图前景色仅含 (255,255,255) + alpha 0 透明。
 */
export type Icon = {
  readonly nameKey: string
  readonly src: string
  readonly href?: string
  /** 纯白前景图标(2026-07-20 加):是否应用 `invert dark:invert-0` filter 适配主题 */
  readonly mono?: boolean
}
export type Qr = {
  readonly src: string
  readonly altKey: 'officialApp' | 'contactUs'
  /** 可选:点击二维码拉起的 URL(如 `weixin://` 拉起电脑微信) */
  readonly href?: string
  /** 可选:提示文案 i18n key(无 `footer.` 前缀),不填则不显示 */
  readonly hintKey?: string
}

// 统一图片加载策略(footer 强制 eager,首屏外也要立即显示)
export const IMG_EAGER = { loading: 'eager', decoding: 'sync' } as const

// 生态:支持的接入平台
// n8n 图标纯白 + 透明 → 标 mono 让 SiteFooter/BrandMarquee 应用 invert filter
export const SUPPORTED: readonly Icon[] = [
  { nameKey: 'platforms.n8n', src: '/footer/awsp/n8n.png', mono: true },
  { nameKey: 'platforms.coze', src: '/footer/awsp/coze.png' },
]

// 模型(8 大主流) — Claude 3x.png 纯白 + 透明 → mono
export const MODELS: readonly Icon[] = [
  { nameKey: 'modelItems.gpt', src: '/footer/model/2.png' },
  { nameKey: 'modelItems.claude', src: '/footer/model/3x.png', mono: true },
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
// 5.png (AWS) 白底"aws"字 + 橙色箭头,黑底大背景 → mono
export const DATABASES: readonly Icon[] = [
  { nameKey: 'databases.mysql', src: '/footer/shujuku/1.png' },
  { nameKey: 'databases.postgresql', src: '/footer/shujuku/2.png' },
  { nameKey: 'databases.mongodb', src: '/footer/shujuku/3.png' },
  { nameKey: 'databases.redis', src: '/footer/shujuku/4.png' },
  { nameKey: 'databases.sqlite', src: '/footer/shujuku/5.png', mono: true },
]

// 官方推广平台(16 槽位,跳号 13/18 素材不存在或未引用)
// 2026-07-20 第四轮校正:PIL 像素数据为准(浏览器 canvas 验证易被
// alpha 合成误导,Read tool 把白底透明图反衬在黑底,看起来像"黑图")。
// - 1 (小红书深底白字 81% 黑底 + 13% 白字) → 不标 mono
// - 2 (抖音浅底彩边 51% 近白) → 标 mono(白前景+透明边)
// - 9 (X 黑鸟 100% 白前景) → 标 mono
// - 16 (GitHub 黑猫 100% 白前景) → 标 mono
export const PROMOTIONS: readonly Icon[] = [
  { nameKey: 'promos.promo1', src: '/footer/tuiguangpingtai/1.png' },
  { nameKey: 'promos.promo2', src: '/footer/tuiguangpingtai/2.png', mono: true },
  { nameKey: 'promos.promo3', src: '/footer/tuiguangpingtai/3.png', mono: true },
  { nameKey: 'promos.promo4', src: '/footer/tuiguangpingtai/4.png', mono: true },
  { nameKey: 'promos.promo5', src: '/footer/tuiguangpingtai/5.png', mono: true },
  { nameKey: 'promos.promo6', src: '/footer/tuiguangpingtai/6.png', mono: true },
  { nameKey: 'promos.promo7', src: '/footer/tuiguangpingtai/7.png', mono: true },
  { nameKey: 'promos.promo8', src: '/footer/tuiguangpingtai/8.png', mono: true },
  {
    nameKey: 'promos.x',
    src: '/footer/tuiguangpingtai/9.png',
    mono: true,
    href: 'https://x.com/ok502319984',
  },
  {
    nameKey: 'promos.facebook',
    src: '/footer/tuiguangpingtai/10.png',
    mono: true,
    href: 'https://www.facebook.com/share/17kQMPNhQb/',
  },
  { nameKey: 'promos.promo11', src: '/footer/tuiguangpingtai/11.png', mono: true },
  { nameKey: 'promos.promo12', src: '/footer/tuiguangpingtai/12.png', mono: true },
  { nameKey: 'promos.promo14', src: '/footer/tuiguangpingtai/14.png', mono: true },
  { nameKey: 'promos.promo15', src: '/footer/tuiguangpingtai/15.png', mono: true },
  {
    nameKey: 'promos.github',
    src: '/footer/tuiguangpingtai/16.png',
    mono: true,
    href: 'https://github.com/AIZHS2025',
  },
  { nameKey: 'promos.promo17', src: '/footer/tuiguangpingtai/17.png', mono: true },
]

// 底部二维码:
// - footer-icon-2.png:官方应用二维码(主题感知,白底深码)
// - wechat-vx.png:微信个人号二维码(2026-07-20 加,源图来自用户百度同步盘 VX.png)。
//   点击拉起 `weixin://` 协议,浏览器会询问是否打开微信,确认后启动电脑微信。
//   用户可在电脑微信中用「扫一扫」扫描屏幕上的二维码添加好友。
//   原 footer-icon-3.png 是 2534×2534 全空白色块 → 弃用。
export const QRS: readonly Qr[] = [
  { src: '/footer/erweima/footer-icon-2.png', altKey: 'officialApp' },
  { src: '/footer/erweima/wechat-vx.png', altKey: 'contactUs', href: 'weixin://' },
]

// 跑马灯专用:模型 + 推广平台拼接(24 张无缝循环)
export const MARQUEE_BRANDS: readonly Icon[] = [...MODELS, ...PROMOTIONS]

// 2026-07-20 恢复:原未改架构前的跑马灯图片(15 槽位,brand4.svg 已丢失 → 实际 14 张)
// 单一数据源:public/brands/* + home.marquee.* i18n(5 语言已 parity)。
// 与 MARQUEE_BRANDS 形成"主品牌行 + 原版品牌行"双行跑马灯。
// 注:bbx.svg → bbxLogo, ybx.png → yuanbaoxiang, brand8.png → brand8。
// nameKey 已是 `marquee.X` 形式的复合 key,但 useTranslations('home.marquee')
// 会再拼一层 → 解析成 home.marquee.marquee.X 报错。
// 解法:BrandMarquee 的 MarqueeRow 组件在取名时去掉 `marquee.` 前缀。
export const SCHOOL_BRANDS: readonly (Omit<Icon, 'nameKey'> & { nameKey: string })[] = [
  { nameKey: 'kouzi', src: '/brands/kouzi.png' },
  { nameKey: 'bbxLogo', src: '/brands/bbx.svg' },
  // brand4.svg 在架构变更中丢失,跳过
  { nameKey: 'zhipu', src: '/brands/zhipu.png' },
  { nameKey: 'brand8', src: '/brands/brand8.png' },
  { nameKey: 'ali', src: '/brands/ali.png' },
  { nameKey: 'baidu', src: '/brands/baidu.svg' },
  { nameKey: 'dbsfdx', src: '/brands/dbsfdx.png' },
  { nameKey: 'gork', src: '/brands/gork.png' },
  { nameKey: 'huawei', src: '/brands/huawei.svg' },
  { nameKey: 'jldx', src: '/brands/jldx.png' },
  { nameKey: 'openai', src: '/brands/openai.png' },
  { nameKey: 'tencent', src: '/brands/tencent.png' },
  { nameKey: 'yuanbaoxiang', src: '/brands/ybx.png' },
  { nameKey: 'yushu', src: '/brands/yushu.png' },
]
