// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 境内可达图源池 —— `packages/shared/src/constants/image-source-pool.ts` 的**镜像副本**(层序禁止 database 依赖 shared)。
 *
 * 为什么这里要有一份而不是 import 那一份:架构契约表(`config/architecture-policy.yaml`)的层序是
 * `contract(10) ← platform(20,含 packages/database) ← composite(30,含 packages/shared) ← product(40)`,
 * 规则明写"rank 小的可被 rank 大的依赖,反向即违规"。所以 **database 不能 import shared** ——
 * 而反过来让 shared re-export database 会把整个 DB 层拖进小程序包(`packages/database` 的 main 是含
 * drizzle/postgres 的 barrel,且 exports 只暴露 `.`),weapp 构建必然变重甚至炸。
 *
 * 于是这里保留一份**纯镜像**,由两道尺子钉住它不能漂:
 * ① `scripts/check-image-source-domains.mjs`(提交链档)按**被审面**逐键比三张清单的字面量,漂移即红;
 * ② `node --test scripts/tests/image-source-pool-parity.test.mjs` **真执行**两份模块,
 *    在同一份语料上比 `domesticImageAt` / `isOverseasImageUrl` 的返回值 ——
 *    清单对得上而判据函数各写各的,是"数据同值、行为分叉"那一型(本仓"两处算同一件事必漂移"记过多次)。
 * 镜像不是第二份真相的前提是"有机器强制它不能漂";没有判据的镜像才是本仓反复登记的失效型。
 *
 * 入池四要件(与 shared 那份同一条,任一不满足不得入池):直连 200 + `Content-Type: image/*` +
 * 跟随重定向后**最终 host 仍在境内** + 非死链。实测代价记录在案:候选面穷尽后仅 2 条合格
 * (14 条 `*.cdn.bspapp.com` 全部 DNS NXDOMAIN、tencent 静态域回 bot 墙 `text/html`、
 * `aizhs.top` 经 Cloudflare 境外边缘)。**这两条是第三方站点的素材,随时可能被删**(同域名另一条
 * `02-strategy.png` 实测已 404)⇒ 根治出路是自托管到国内对象存储后**尾部追加**,既有调用点自动多样化。
 */

/** 境内可达图源池(轮转分配用;顺序稳定,追加只允许在尾部) */
export const DOMESTIC_IMAGE_POOL: readonly string[] = [
  'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
  'https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg',
]

/** 按序号轮转取池内 URL(池增长后既有调用自动多样化,无需回改) */
export function domesticImageAt(index: number): string {
  const len = DOMESTIC_IMAGE_POOL.length
  // 空池时回退境外源等于把缺陷放回去,所以宁可炸在这里(与 shared 那份同一条,行为由 parity 测试钉住)
  if (len === 0) throw new Error('DOMESTIC_IMAGE_POOL 为空:禁止回退境外图源,先按四要件实测入池')
  const url = DOMESTIC_IMAGE_POOL[((index % len) + len) % len]
  if (typeof url !== 'string') throw new Error('DOMESTIC_IMAGE_POOL 取值异常(索引/类型不闭合)')
  return url
}

/**
 * 境外「图片专用」域名 —— 该域名上出现的任何 URL 都是图片,判境外无需看路径后缀。
 * 与 shared 那份**逐字等值**,由 `scripts/check-image-source-domains.mjs` 按被审面逐键对账(漂移即红);
 * 子域名靠 host.endsWith 命中(如 fastly.picsum.photos),所以这里只登记裸域名。
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
