// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端图源池唯一真相源 —— 只收录「境内可达」已实证的图片 URL。
 *
 * 为什么存在:首页轮播/课程封面等数据侧内容图源曾指向 picsum.photos 等境外域名,
 * 国内移动网络不可达 → 图片加载失败(渲染侧的 onError 摘除已由 0b00d5cdd5 入库,
 * 本文件解决数据侧)。AGENTS §3 规定跨端 URL 常量住 `packages/shared/src/constants/`,
 * 端内与 seed 一律 import 本常量,禁止第二份登记表。
 *
 * 入池判据(2026-09-29 真实探测,逐条四要件齐备,缺一不入池):
 *   ① 直连(不带任何代理;经代理可达不算 —— 代理腿与移动网络无关)HTTP 200;
 *   ② Content-Type 为 image/*;
 *   ③ 跟随重定向后的最终 host 仍属该境内域名(302 到境外一律不合格);
 *   ④ 域名归属为境内主体。
 * 实测合格(池内 2 条):
 *   - statics.moonshot.cn …/01-open-world.png → 200 image/png 1,487,764 B,
 *     火山引擎 TOS,直连 IPv6 2408:8735::(中国联通段)
 *   - cdn.deepseek.com …/deepseek-chat-open-graph-image.jpeg → 200 image/jpeg 621,850 B,
 *     直连 IP 122.141.224.97(境内)
 * 实测不合格(勿再加回):statics.moonshot.cn …/02-strategy.png(404 NoSuchKey)、
 *   static.www.tencent.com …png(200 但返回 bot 挑战 JS 页,text/html)、
 *   mp-*.cdn.bspapp.com(uniCloud CDN 空间已停用,DNS NXDOMAIN)、file.aizhs.top(404)、
 *   aizhs.top/images/logo.png(200 image/png 但经 Cloudflare 境外边缘节点 2606:4700:: 交付)。
 * 如实登记:目标池 ≥10 条未达成 —— 候选面(仓内出现过的一切境内 URL)穷尽后仅 2 条通过。
 * 扩池唯一姿势:先按上面四要件实测留证,再把 URL 追加进本数组;禁止拿境外域名凑数。
 *
 * 消费方(同一份常量,禁止各自抄写):
 *   packages/database/seed/lessons.ts / update-picsum-urls.ts / migrate-overseas-images.ts,
 *   apps/miniapp-taro/src/pages/index/index.tsx / src/pkg-ai/aigc/list.tsx,
 *   packages/database/scripts/check-image-source-domains.mjs(经本文件读境外域名清单)
 */

/** 境内可达图源池(轮转分配用;顺序稳定,追加只允许在尾部) */
export const DOMESTIC_IMAGE_POOL: readonly string[] = [
  'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
  'https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg',
]

/** 按序号轮转取池内 URL(池增长后既有调用自动多样化,无需回改) */
export function domesticImageAt(index: number): string {
  const len = DOMESTIC_IMAGE_POOL.length
  if (len === 0) throw new Error('DOMESTIC_IMAGE_POOL 为空:禁止回退境外图源,先按四要件实测入池')
  const url = DOMESTIC_IMAGE_POOL[((index % len) + len) % len]
  if (typeof url !== 'string') throw new Error('DOMESTIC_IMAGE_POOL 取值异常(索引/类型不闭合)')
  return url
}

/**
 * 境外「图片专用」域名 —— 该域名上出现的任何 URL 都是图片,判境外无需看路径后缀。
 * 判据/迁移脚本共用这一份清单,禁止在别处再抄第二份。
 */
export const OVERSEAS_IMAGE_ONLY_DOMAINS: readonly string[] = [
  'picsum.photos', // 随机占位图(本轮病灶)
  'images.ctfassets.net', // Contentful CDN(OpenAI 物料)
  'cdn.sanity.io', // Sanity CDN(Anthropic 物料)
  'api.dicebear.com', // DiceBear 头像生成
  'upload.wikimedia.org', // Wikimedia 媒体
]

/** 通用站点域名:仅当 URL 带图片后缀才按境外图片计(避免把文章链接误判) */
export const OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT: readonly string[] = [
  'x.ai', // 站点本体 + /images/news/*.og.png 两类形态并存,只判后者
]

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)(\?[^\s"'`)]*)?$/i

function hostMatches(url: string, domain: string): boolean {
  const m = /^https?:\/\/([^/]+)/i.exec(url)
  const raw = m?.[1]
  if (!raw) return false
  const host = raw.split(':')[0]!.toLowerCase()
  return host === domain || host.endsWith(`.${domain}`)
}

/** 该 URL 是否命中境外图片域名(形态判据,不访问网络) */
export function isOverseasImageUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false
  if (OVERSEAS_IMAGE_ONLY_DOMAINS.some((d) => hostMatches(url, d))) return true
  return OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT.some(
    (d) => hostMatches(url, d) && IMAGE_EXT_RE.test(url),
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
