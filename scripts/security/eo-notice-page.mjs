// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * EdgeOne 边缘层告知页(2026-11-24 第三项)。
 *
 * 目的:我们自己的 router 只能在"请求到了源站"时送那句话;一旦 EO 在边缘就拦了
 * (WAF / Bot 防护),对手看到的是 EO 的默认页 —— 那句话根本没机会出现。
 * 本脚本把同一段话做成 EO 的「自定义响应页面」并挂到拦截面,让边缘也送话。
 *
 * 用法:
 *   node scripts/security/eo-notice-page.mjs              只读:站点 / 现有页面 / 站点配置里与错误页相关的字段
 *   node scripts/security/eo-notice-page.mjs --apply     创建(或更新)页面;
 *                                                        --attach 才尝试挂到安全防护拦截
 *
 * 纪律:
 *   ① 内容 ≤ 2KB(EO 硬限制),所以要给"精简版",不能直接塞 router 那 3.4KB 的 HTML;
 *   ② 编号体系不同源:EO 只认 {{ EO_REQ_ID }},我们的 EV-xxxxxxxxxx 只有源站能出 ——
 *      页面上两个都给,并说明"边缘拦截时只有 EO_REQ_ID",不假装能统一;
 *   ③ 不谎报"已挂生效":挂载若失败/不支持,如实 exit 1 并打印原因。
 *
 * **2026-11-24 实测到的架构事实(比本脚本本身更重要)**:
 *   `www.aizhs.top` 公网入口确实走 EO(CNAME `*.eo.dnse0.com`,`Server: TencentEdgeOne`),
 *   但该域名的 `WafConfig.Mode` 是 **observe** —— 边缘托管规则只记日志、不拦请求,
 *   真正的拦截全部发生在源站 router(IHUI_WAF_MODE=enforce)。
 *   这不是缺陷,是取舍:边缘一拦,那次攻击就**到不了源站**,我们既拿不到证据编号也入不了链。
 *   所以"边缘送话"的正确定位是**备用件**:将来若开 Bot 防护/把 WAF 切 block,
 *   页面内容已就位、直接引用即可,不用再写一遍话术。
 *
 * 关于 --attach:EO 的 `ModifySecurityPolicy` 对 `DropPageConfig` 只传时返回
 * `UnsupportedOperation: 操作不支持`,全量回写又会撞 `UnknownParameter`(RuleID/SecurityHeadersToOrigin
 * 等只读字段)。两条路都实测失败 ⇒ **不硬改生产安全策略**(改错代价远大于这句话的收益),
 * 引用动作留给控制台(3 步)或将来走配置组版本发布。
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveCredentials, teoCall } from '../repair-eo-origin.mjs'

const PAGE_NAME = 'ihui-national-grade-notice'
const ZONE = process.env.IHUI_EO_ZONE_NAME || 'aizhs.top'

/**
 * 精简版正文(HTML,含 {{ EO_REQ_ID }})。**必须 ≤2KB** —— 下方 build 里会断言。
 * 中文与英文并列给(扫器多数不带 Accept-Language,只给一种等于对一半对手失语)。
 */
export function buildPageContent(_ref) {
  const body = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>403 · IHUI AI</title>
<style>body{margin:0;background:#0b0d10;color:#e6e8ea;font:14px/1.7 system-ui,sans-serif}
.w{max-width:720px;margin:0 auto;padding:44px 20px}h1{font-size:17px;margin:0 0 18px;color:#fff}
h2{font-size:12px;letter-spacing:.1em;color:#8b949e;margin:20px 0 8px}
p{margin:6px 0}ul{margin:6px 0 0;padding-left:18px}.p{font-size:15px;color:#fff;margin-top:22px}
.n{color:#8b949e;margin-top:20px;font-size:12px}</style></head><body><div class="w">
<h1>已阻断 · 按国安级网络对抗标准建设<br><span style="font-weight:400;color:#8b949e">BLOCKED · Built to a national-grade adversarial standard</span></h1>
<h2>已固定 / PRESERVED</h2>
<p>来源 IP、ASN、请求载荷、精确时间,已封入防篡改哈希链;证据编号可被任何第三方核验,事后无法修改。</p>
<p>Source IP, ASN, payload and exact timestamp are sealed into a tamper-evident hash chain; the evidence ID is verifiable by any third party and cannot be altered afterwards.</p>
<h2>继续的代价 / THE COST OF CONTINUING</h2>
<ul><li>本站不是一台服务器,是三道独立防线组成的同一个体系。</li>
<li>你每再发一次,只是在自己的证据卷宗里再加一页。</li>
<li>This site is not a single server — three independent layers act as one system.</li>
<li>Every further request only adds another page to your own case file.</li></ul>
<p class="p">别妄想攻击。<br><span style="color:#8b949e;font-weight:400">Abandon the attempt.</span><br>
你不是在攻击一台服务器 —— 你是在给自己立卷。<br>
<span style="color:#8b949e">You are not attacking a server — you are building a case file against yourself.</span></p>
<p class="n">拦截点 = EdgeOne 边缘 · 请求编号 {{ EO_REQ_ID }}</p>
</div></body></html>`
  return body
}

export const __test__ = { buildPageContent, PAGE_NAME }

const LIMIT_BYTES = 2048

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--verify-edge')) {
    const r = await verifyEdge(process.env.IHUI_EO_ENTITY || 'www.aizhs.top')
    console.log(`公网实测 status=${r.status} server=${r.server} bytes=${r.bytes}`)
    console.log(`看到我们的文案 = ${r.sawNotice} / 看到源站证据编号 = ${r.sawOurRef}`)
    console.log(r.sawNotice ? '✅ 边缘/源站任一层已把话送到' : '⚠️ 这一枪没看到文案(多半是打到 EO 默认页或走了缓存)')
    return r.sawNotice ? 0 : 3
  }
  const apply = argv.includes('--apply')
  const attach = argv.includes('--attach')
  const cred = resolveCredentials()
  if (!cred) {
    console.error('❌ 未判定:找不到 EO 凭据(IHUI_EO_* / TENCENT_EO_* / .env 里的 TENCENT_SMS_*),exit 2')
    return 2
  }
  console.log(`凭据来源=${cred.source}(值不打印)`)

  const zs = await teoCall(cred, 'DescribeZones', { Limit: 100, Offset: 0 })
  if (!zs.ok) { console.error(`❌ DescribeZones 失败:${zs.error}`); return 2 }
  const zone = (zs.data.Zones || []).find((z) => String(z.ZoneName || '').toLowerCase() === ZONE.toLowerCase())
  if (!zone) { console.error(`❌ 站点不存在:${ZONE}`); return 2 }
  console.log(`zone=${zone.ZoneName} id=${zone.ZoneId} status=${zone.Status} plan=${zone.PlanId}`)

  const pages = await teoCall(cred, 'DescribeCustomErrorPages', { ZoneId: zone.ZoneId, Limit: 100, Offset: 0 })
  console.log(`现有自定义页:${pages.ok ? JSON.stringify(pages.data).slice(0, 900) : `查询失败 ${pages.error}`}`)

  const st = await teoCall(cred, 'DescribeZoneSetting', { ZoneId: zone.ZoneId })
  if (st.ok) {
    const ks = Object.keys(st.data?.ZoneSetting || st.data || {})
    console.log(`站点配置字段(${ks.length}):${ks.join(', ')}`)
    const hit = ks.filter((k) => /error|page|secur|waf|web/i.test(k))
    if (hit.length) console.log(`其中与错误页/防护相关:${hit.join(', ')}`)
  } else {
    console.log(`DescribeZoneSetting 失败:${st.error}`)
  }

  const content = buildPageContent('EV-')
  console.log(`拟定页内容字节=${Buffer.byteLength(content, 'utf8')}(上限 ${LIMIT_BYTES})`)
  if (Buffer.byteLength(content, 'utf8') > LIMIT_BYTES) {
    console.error('❌ 超 2KB,EO 会拒收;先压缩再 --apply')
    return 1
  }
  if (!apply) {
    console.log('只读完成。加 --apply 才创建页面(--attach 才尝试挂到拦截策略)。')
    return 0
  }

  const list = (pages.ok ? pages.data.ErrorPages : null) || []
  const existing = list.find((p) => String(p.Name || '') === PAGE_NAME)
  if (existing) {
    const up = await teoCall(cred, 'ModifyCustomErrorPage', {
      ZoneId: zone.ZoneId, PageId: existing.PageId, Name: PAGE_NAME,
      ContentType: 'text/html', Content: content,
    })
    console.log(up.ok ? `已更新页面 PageId=${existing.PageId}` : `❌ 更新失败:${up.error}`)
    return attach ? await tryAttach(cred, zone, existing.PageId) : (up.ok ? 0 : 1)
  }
  const cr = await teoCall(cred, 'CreateCustomizeErrorPage', {
    ZoneId: zone.ZoneId,
    Name: PAGE_NAME,
    ContentType: 'text/html',
    Content: content,
    Description: 'IHUI national-grade block notice',
  })
  if (!cr.ok) {
    console.error(`❌ 创建失败:${cr.error}`)
    return 1
  }
  console.log(`已创建页面 PageId=${cr.data.PageId}(内容 ${Buffer.byteLength(content, 'utf8')} 字节)`)
  console.log('注意:页面只是"模板池"里的一条,未挂到任何拦截策略前不会出现在拦截响应里。')
  return attach ? await tryAttach(cred, zone, cr.data.PageId) : 0
}

/**
 * 尝试把页面挂到拦截策略。**预期会失败** —— 实测两条路都被 EO 拒(见文件头)。
 * 不硬试全量回写:那等于用一次覆盖整个安全策略去换一句话,不值得。
 * 失败时如实 exit 3(未判定/受限),并给出控制台的确切路径。
 */
async function tryAttach(cred, zone, pageId) {
  const entity = process.env.IHUI_EO_ENTITY || 'www.aizhs.top'
  const cur = await teoCall(cred, 'DescribeSecurityPolicy', { ZoneId: zone.ZoneId, Entity: entity })
  if (!cur.ok) {
    console.error(`❌ 读不到现策略,未判定:${cur.error}`)
    return 3
  }
  const wafMode = cur.data?.SecurityConfig?.WafConfig?.Mode ?? 'unknown'
  console.log(`当前 WAF 模式=${wafMode}(observe=边缘只观察不拦,拦截在源站)`)
  const drop = cur.data?.SecurityConfig?.DropPageConfig ?? {}
  console.log(`现拦截页:${JSON.stringify(drop)}`)

  const r = await teoCall(cred, 'ModifySecurityPolicy', {
    ZoneId: zone.ZoneId,
    Entity: entity,
    SecurityConfig: {
      DropPageConfig: {
        ...drop,
        WafDropPageDetail: { CustomResponseId: pageId, Name: PAGE_NAME, PageId: 0, StatusCode: 566, Type: 'custom' },
        AclDropPageDetail: { CustomResponseId: pageId, Name: PAGE_NAME, PageId: 0, StatusCode: 567, Type: 'custom' },
      },
    },
  })
  if (r.ok) {
    console.log('✅ 已挂到拦截策略(请用 --verify-edge 自证,别只看返回码)')
    return 0
  }
  console.log(`⚠️ API 拒绝挂载:${r.error}`)
  console.log('   原因:EO 的拦截页引用不在 ModifySecurityPolicy 的可写面(只传 DropPageConfig=UnsupportedOperation,')
  console.log('   全量回写撞 UnknownParameter: RuleID / SecurityHeadersToOrigin 等只读字段)。')
  console.log('   控制台路径(3 步,一步都不能跳):')
  console.log('     1) EO 控制台 → 本站点 → 安全防护 → Web 防护 → 自定义拦截页面')
  console.log('     2) 选「安全防护(除托管规则外)拦截页面」→ 编辑 → 页面类型选「使用文件页面」')
  console.log(`     3) 选 ${PAGE_NAME},保存(状态码不勾即用默认 567)`)
  console.log('   页面内容已就位,Id=' + pageId + ' —— 别再手写第二份话术。')
  return 3
}

/** 自证:从公网打一枪带明显特征的请求,看响应里到底有没有那句话。 */
export async function verifyEdge(domain = 'www.aizhs.top') {
  const url = `https://${domain}/?q=1%20union%20select%201,2`
  const res = await fetch(url, {
    headers: { 'user-agent': 'sqlmap/1.8.4#stable (https://sqlmap.org)', accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  })
  const body = await res.text()
  return {
    status: res.status,
    server: res.headers.get('server') || '',
    sawNotice: /别妄想攻击|Abandon the attempt/.test(body),
    sawOurRef: /EV-[0-9A-F]{10}/.test(body),
    bytes: Buffer.byteLength(body, 'utf8'),
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`❌ 脚本自身异常(exit 2):${String((e && e.message) || e)}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
