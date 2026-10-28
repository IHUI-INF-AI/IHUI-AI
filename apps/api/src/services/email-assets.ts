// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 邮件内嵌图片(CID)资产加载器 —— 2026-10-15「邮件 Logo 永远加载不出来」的根治部件。
 *
 * 背景(实测):
 * - 模板层(apps/api/src/services/email-templates.ts)原先以
 *   `<img src="${origin}/images/logo.png">` 外链发图,而 origin = CORS_ORIGIN 首项
 *   = `http://localhost:8801` ⇒ 所有收件端都取不到这张图。
 * - 就算把 origin 修成公网域名也不够:QQ 邮箱 / Gmail / Outlook 对"远程图片"一律默认
 *   拦截(要用户点"显示图片"才加载),Logo 依旧是不显示。
 * - 根治办法只有一个:**把图片随邮件正文一起送过去**(内嵌附件 + src="cid:...")。
 *   这样它与远程图片拦截策略、站点可达性、origin 配置三者全部解耦。
 *
 * 本模块只做两件事:
 * 1. 定位并读取 apps/web/public 下的**邮件专用小图**(缓存到进程内);
 * 2. 把"渲染好的 HTML"加工成"最终要发的 HTML + 要挂的附件"。
 *
 * 设计铁律:
 * - **不 import config / db / redis**:部署失败时数据库本身可能就是坏的,告警邮件这条
 *   唯一到人通道不得依赖它(与 notify-deploy-failure.ts 的既有约束同族)。
 * - **只有 HTML 里真引用了某个 cid 才挂对应附件** —— 否则那张图会在邮件底部变成一个
 *   多余的"下载附件",纯文本降级邮件尤其会中招。
 * - **资产缺失时失效方向是"退回外链"而非"留一个死 cid"**:退回后行为至少不比修复前差。
 *   路径解析不写盘符(§15):一律由本模块自身位置与 cwd 推导。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BRAND_LOGO_PATH,
  EMAIL_LOGO_ASSET,
  EMAIL_LOGO_CID,
  EMAIL_QR_ASSET,
  EMAIL_QR_CID,
  FOUNDER_QR_PATH,
  resolveWebOrigin,
} from './email-templates.js'

/** 一份内嵌图片(provider 无关的通用形态,由各发送出口按需映射成自己的附件格式) */
export interface InlineImageAttachment {
  /** Content-ID。HTML 里以 `src="cid:${cid}"` 引用,必须逐字一致 */
  cid: string
  /** 附件名(带扩展名,客户端据此判定类型) */
  filename: string
  contentType: string
  /** 原始字节;各出口自行决定 Buffer 直传还是 base64 编码 */
  content: Buffer
}

interface InlineImageSpec {
  cid: string
  /** 邮件专用小图相对 apps/web/public 的路径(形如 /images/logo-email.png) */
  asset: string
  /** 小图缺失时的外链兜底路径(原图,可被公网取到) */
  fallback: string
  filename: string
}

/**
 * 规格表:与模板层的两个 `src="cid:..."` 一一对应。
 * 新增内嵌图必须同时改这里和模板,漏一边就是死 cid。
 */
const SPECS: readonly InlineImageSpec[] = [
  {
    cid: EMAIL_LOGO_CID,
    asset: EMAIL_LOGO_ASSET,
    fallback: BRAND_LOGO_PATH,
    filename: 'logo.png',
  },
  {
    cid: EMAIL_QR_CID,
    asset: EMAIL_QR_ASSET,
    fallback: FOUNDER_QR_PATH,
    filename: 'wechat-vx.png',
  },
]

/**
 * 由本模块自身位置推导 web public 目录(§15 禁硬编码盘符)。
 * apps/api/src/services/… 与 apps/api/dist/services/… 都是上四层到仓库根 ——
 * src 与 dist 同深,这一格两态都对,故不做条件分支。
 */
function modulePublicDir(): string {
  return resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    'apps',
    'web',
    'public',
  )
}

/**
 * 候选目录(按优先级)。生产 API 的 cwd 是 apps/api(nssm 实测),
 * 而 notify-deploy-failure.ts 是被 spawn 的子进程(cwd 由父进程决定、不可假设)——
 * 两条路都要能命中,所以自身位置推导那一档必须排在最前。
 */
function candidatePublicDirs(): string[] {
  const cwd = process.cwd()
  const list = [
    modulePublicDir(),
    join(cwd, '..', 'web', 'public'), // cwd = apps/api
    join(cwd, 'apps', 'web', 'public'), // cwd = 仓库根
    join(cwd, 'public'), // cwd = apps/web
  ]
  const override = (process.env.EMAIL_ASSETS_DIR ?? '').trim()
  if (override) list.unshift(override)
  return [...new Set(list)]
}

let cache: InlineImageAttachment[] | null = null
let missingCache: string[] = []

/**
 * 读取(并缓存)全部内嵌图片。
 *
 * 命中不到的一律"缺席"处理,绝不抛错:缺图只是降级,绝不能让告警邮件或验证码邮件
 * 因为一张装饰图寄不出去(本仓禁令:装饰物不得阻断到人通道)。
 */
export function loadInlineImages(): InlineImageAttachment[] {
  if (cache) return cache
  const dirs = candidatePublicDirs()
  const found: InlineImageAttachment[] = []
  const missing: string[] = []
  for (const spec of SPECS) {
    let buf: Buffer | null = null
    for (const dir of dirs) {
      const p = join(dir, ...spec.asset.split('/').filter(Boolean))
      if (existsSync(p)) {
        buf = readFileSync(p)
        break
      }
    }
    if (buf) {
      found.push({
        cid: spec.cid,
        filename: spec.filename,
        contentType: 'image/png',
        content: buf,
      })
    } else {
      missing.push(spec.asset)
    }
  }
  cache = found
  missingCache = missing
  return found
}

/** 上一次加载时缺席的资产路径(空数组 = 全部命中) */
export function missingInlineImageAssets(): readonly string[] {
  if (!cache) loadInlineImages()
  return missingCache
}

/** 仅供单测:资产目录是进程级缓存,换了 EMAIL_ASSETS_DIR 的测试必须能重来 */
export function resetInlineImageCacheForTest(): void {
  cache = null
  missingCache = []
}

export interface PreparedEmailHtml {
  html: string
  attachments: InlineImageAttachment[]
  /** 资产缺席、已退回公网外链的 cid(空 = 两图都以内嵌形式送出) */
  downgraded: string[]
}

/**
 * 渲染好的 HTML → 可发送形态(单一出口,两个发信通道共用)。
 *
 * 三步:
 * ① 按 HTML 里实际出现的 `cid:` 过滤附件(没引用就不挂,防变成多余下载附件);
 * ② 资产缺席的那个 cid 改写回公网外链(失效方向 = 退回修复前的行为);
 * ③ 原样返回附件清单,由出口各自映射成 SMTP/Resend 的附件格式。
 */
export function finalizeEmailHtml(html: string): PreparedEmailHtml {
  const all = loadInlineImages()
  const attachments = all.filter((a) => html.includes(`cid:${a.cid}`))
  let out = html
  const downgraded: string[] = []
  for (const spec of SPECS) {
    if (!html.includes(`cid:${spec.cid}`)) continue
    if (attachments.some((a) => a.cid === spec.cid)) continue
    downgraded.push(spec.cid)
    out = out.split(`cid:${spec.cid}`).join(`${resolveWebOrigin()}${spec.fallback}`)
  }
  return { html: out, attachments, downgraded }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
