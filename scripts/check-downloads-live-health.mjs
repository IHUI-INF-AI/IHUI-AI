// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 下载栏运行期真值健康对账(**守护巡检轮,不进提交链**)—— 站点 `/downloads.json` 那一格。
 *
 * 为什么必须有它(2026-11-03 只读审计现读的缺口):下载栏八端的降级契约是「取不到就不覆盖底稿」,
 * 于是任何一条上游腿断掉,用户在页面上看到的只是"版本号旧了一格",而**全仓没有任何一道门/哨兵在读
 * 这个出口** —— `check-app-version-latest` 射程只有 android/ios 两端的注册表行,
 * `check-mobile-download-leg` 只在 CI 与发布链里跑且只判安卓一条 URL,
 * `check-desktop-release-discovery-budget` 只取 `desktop.scan` 一维;
 * cli / extension / 微信小程序码 / mobile 四条腿**永远不会有告警**。
 * 更要紧的是 `generatedAt` 这个字段全仓零消费者 —— 站点若整体停止刷新(构建冻住、路由报错回落),
 * 没有任何人会知道。
 *
 * 判什么(每条都有"该端有没有可能合法地长这样"的判据,不靠猜):
 *   D1 整体新鲜度:最新一枚 resolvedAt 距今 > STALE_MS ⇒ 站点没在刷新(先重试一次再判,
 *      因为 ISR 是 stale-while-revalidate:第一次请求可能拿到的正是旧副本)。
 *   D2 必备端缺失:payload 里少了表内任一端 ⇒ 形状漂移(路由改名/枚举漂移)。
 *   D3 端不可用:某端 `source!=='live'`,而按表它**必须有**运行期真值 ⇒ 该腿断了。
 *      其中 `snapshot`(取不到输入)按 §0.3 与"没判"同罪,不因"它保留了旧值"而放过。
 *   D4 体积拿不到:应有安装包体积的端 `assets[0].sizeBytes<=0` ⇒ 腿能读元数据但读不到实物。
 *   D5 web 那一格**必须**是 `unavailable:web-is-pwa-no-installable-artifact`:哪天它变成 live,
 *      说明有人改了判据 ⇒ 只报名(不判红),由人看图。
 *
 * 失效方向(§0.10):取不到 payload / 两臂都无响应 / 形状解析失败 ⇒ `unjudged` + 点名原因,
 * **既不记绿也不冒红**;要判红必须有当次读到的读数。取不到时绝不回落"上一次缓存的读数"当现值。
 *
 * 抖动抑制:除 D1/D3 里"上一轮还是 live、这一轮掉下去"的翻转类外,其余红需**连续两轮**同判据
 * 才进到人通道(§5e-3:重复告警是缺陷;一次 GitHub 限流不该喊人)。身份只取「端 + 判据」,
 * 不含时刻/sha/计数。
 *
 * 用法:node scripts/check-downloads-live-health.mjs [--self-test|--json|--once]
 *      IHUI_DOWNLOADS_URL / IHUI_SITE_LEG_HOST 可覆盖取数面(默认本机源站 → 公网臂)
 * 调度器:scripts/git-guardian.mjs 的 `sweepDownloadsLiveHealth()`(守护 tick,节流 + 跨档重报)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** 站点路由窗口:ISR 600s + CDN s-maxage 600s ⇒ 正常最坏 ~20 分钟;超 25 分钟没更新就是真停了 */
export const STALE_MS = 25 * 60 * 1000
/** 两臂超时:本机臂快(同机源站),公网臂留足跨境余量 —— 与下载端取数那两层同一口径 */
export const LOCAL_TIMEOUT_MS = 5000
export const PUBLIC_TIMEOUT_MS = 15000
export const RETRY_WAIT_MS = 6000

export function localLegOrigin() {
  return 'http://127.0.0.1:80'
}
export function sourceApiOrigin() {
  return 'http://127.0.0.1:8801'
}
export function siteHost() {
  const raw = process.env.IHUI_SITE_LEG_HOST
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : 'www.aizhs.top'
}
export function publicBase() {
  const raw = process.env.IHUI_DOWNLOADS_URL
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()
  return `https://${siteHost()}`
}
/** 取数臂:本机源站 → 公网。顺序即优先级(公网臂要过 CDN 与跨境段,慢且会抖)。 */
export function arms() {
  return [
    { label: 'source', url: `${sourceApiOrigin()}/downloads.json`, headers: { host: siteHost() }, timeoutMs: LOCAL_TIMEOUT_MS },
    { label: 'public', url: `${publicBase()}/downloads.json`, headers: {}, timeoutMs: PUBLIC_TIMEOUT_MS },
  ]
}

/**
 * 八端的期望表 —— 单一真相源。`needVersion` / `needAssetBytes` 说的是"这台机器的发布链是否
 * 真的能给它一个数",不是"我猜应该有":
 *  - 微信小程序:版本只有公众平台后台知道 ⇒ 刻意留空,但**码图字节**必须有(实物在仓里);
 *  - CLI:走 `npm i -g`,没有产物文件 ⇒ 只要版本;
 *  - mobile(RN):与安卓同一个包,只借版本标注,安装包那格属 android-apk。
 */
export const END_EXPECTATIONS = [
  { platform: 'desktop', needVersion: true, needAssetBytes: true },
  { platform: 'android-apk', needVersion: true, needAssetBytes: true },
  { platform: 'mobile', needVersion: true, needAssetBytes: false },
  { platform: 'ios', needVersion: true, needAssetBytes: true },
  { platform: 'cli', needVersion: true, needAssetBytes: false },
  { platform: 'extension', needVersion: true, needAssetBytes: true },
  { platform: 'wechat-miniapp', needVersion: false, needAssetBytes: true },
]
/** 设计上就没有安装产物的一格:它必须是这个 reason;变成 live 只报名不判红。 */
export const WEB_REASON = 'web-is-pwa-no-installable-artifact'

export function newestResolvedAtMs(doc) {
  let max = 0
  for (const v of Object.values(doc?.downloads ?? {})) {
    const t = Date.parse(String(v?.resolvedAt ?? '').trim())
    if (Number.isFinite(t) && t > max) max = t
  }
  return max
}

/**
 * 纯判据:给定 payload 读数 + 当下时刻 + 上一轮读数(用于两轮确认),算出结论。
 * @returns {state:'ok'|'red'|'unjudged', findings:[{id,kind,platform,detail,immediate}], readings, at}
 */
export function judge({ doc, now, prev, retried = false }) {
  if (doc === null || doc === undefined || typeof doc !== 'object') {
    return { state: 'unjudged', findings: [], readings: [], reason: 'payload 取不到(两臂都无响应或不是 JSON)' }
  }
  const dl = doc.downloads
  if (!dl || typeof dl !== 'object') {
    return { state: 'unjudged', findings: [], readings: [], reason: '响应体里没有 downloads 这一层 ⇒ 形状不认识,不猜' }
  }
  const at = Date.parse(String(doc.generatedAt ?? '').trim())
  const newest = newestResolvedAtMs(doc)
  const ref = Number.isFinite(at) && at > 0 ? Math.max(at, newest) : newest
  const findings = []
  const readings = []
  const prevFindings = new Set((prev?.findings ?? []).map((f) => f.id))
  const prevStates = prev?.states ?? {}
  const push = (kind, platform, detail, immediate = false) => {
    const id = `${platform}:${kind}`
    // 两轮确认:上一轮没报过同一判据 ⇒ 先不喊人(除非 immediate 那一类)
    findings.push({ id, kind, platform, detail, immediate: immediate || prevFindings.has(id) || false })
  }
  for (const spec of END_EXPECTATIONS) {
    const info = dl[spec.platform]
    if (!info) {
      push('missing-end', spec.platform, 'payload 里少了这一端(路由枚举漂移?)', true)
      continue
    }
    const src = String(info.source ?? '')
    readings.push({ platform: spec.platform, source: src, version: info.version ?? null, reason: info.reason ?? null })
    if (src === 'unavailable') {
      const wasLive = prevStates[spec.platform] === 'live'
      // 必备端"没有这一格的数"本身就是缺陷(用户看到的就是一颗空按钮),不必等第二轮;
      // 只有 snapshot(取不到上游、留着底稿旧值)才走两轮确认 —— 它多半是一次网络抖动。
      push('end-unavailable', spec.platform, `source=unavailable reason=${info.reason ?? '(无)'}${wasLive ? '(上一轮还是 live ⇒ 翻转)' : ''}`, true)
      continue
    }
    if (src === 'snapshot') {
      push('end-snapshot', spec.platform, `取不到上游,这一格留着的是底稿旧值 reason=${info.reason ?? '(无)'}`)
      continue
    }
    if (src !== 'live') {
      push('end-state-unknown', spec.platform, `source=${src || '(空)'} 不在 live/snapshot/unavailable 三档内`, true)
      continue
    }
    if (spec.needVersion && !String(info.version ?? '').trim()) push('no-version', spec.platform, 'live 但版本号为空')
    if (spec.needAssetBytes) {
      const bytes = Number(info.assets?.[0]?.sizeBytes ?? 0)
      if (!Number.isFinite(bytes) || bytes <= 0) push('no-asset-bytes', spec.platform, 'live 但安装包体积读不到(0 B)')
    }
  }
  const web = dl.web
  if (web && (web.source !== 'unavailable' || web.reason !== WEB_REASON)) {
    readings.push({ platform: 'web', source: String(web.source ?? ''), version: web.version ?? null, reason: web.reason ?? null })
    push('web-design-changed', 'web', `web 那一格不再是「PWA 无安装包」(source=${web.source} reason=${web.reason ?? '-'}) ⇒ 有人改了判据,请人看图`)
  }
  if (!Number.isFinite(ref) || ref === 0) {
    push('no-timestamp', '(整体)', 'payload 里既没有 generatedAt 也没有 resolvedAt ⇒ 判不了新鲜度', true)
  } else if (now - ref > STALE_MS) {
    push('stale-payload', '(整体)', `最新读数距今 ${Math.round((now - ref) / 1000)}s > 上限 ${STALE_MS / 1000}s${retried ? '(重试一次仍是)' : ''}`, now - ref > STALE_MS * 2)
  }
  return {
    state: findings.some((f) => f.immediate) ? 'red' : 'ok',
    pending: findings.filter((f) => !f.immediate).map((f) => f.id),
    findings,
    readings,
    agesMs: { generatedAt: Number.isFinite(at) ? now - at : null, newestResolvedAt: ref ? now - ref : null },
    at: Number.isFinite(at) ? at : null,
  }
}

/** 读一次 payload:逐臂问到能答为止;两臂都无响应 ⇒ null(调用方落未判定) */
export async function readPayload({ fetchImpl = fetch, wait: _wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const tried = []
  for (const arm of arms()) {
    try {
      const res = await fetchImpl(arm.url, {
        signal: AbortSignal.timeout(arm.timeoutMs),
        headers: { accept: 'application/json', ...arm.headers },
      })
      const status = res.status
      if (status !== 200) {
        tried.push(`${arm.label}:HTTP ${status}`)
        continue
      }
      const text = await res.text()
      try {
        return { doc: JSON.parse(text), tried: [...tried, `${arm.label}:200`] }
      } catch {
        tried.push(`${arm.label}:200 但正文不是 JSON`)
      }
    } catch (e) {
      tried.push(`${arm.label}:${String(e?.name ?? e).slice(0, 24)}`)
    }
  }
  if (tried.length === 0) tried.push('(两臂都没试)')
  return { doc: null, tried }
}

/** 主判定:新鲜度先重试一次再判(ISR 的 SWR 会让第一次拿到旧副本) */
export async function runCheck({ now = Date.now(), fetchImpl = fetch, readImpl = null, wait = (ms) => new Promise((r) => setTimeout(r, ms)), prev = null } = {}) {
  const read = readImpl ?? readPayload
  const first = await read({ fetchImpl, wait })
  let { doc, tried } = first
  let retried = false
  const fresh = () => {
    const j = judge({ doc, now, prev, retried })
    return j.findings.some((f) => f.kind === 'stale-payload' || f.kind === 'no-timestamp')
  }
  if (doc && fresh()) {
    await wait(RETRY_WAIT_MS)
    const second = await read({ fetchImpl, wait })
    retried = true
    if (second.doc) {
      doc = second.doc
      tried = second.tried
    }
  }
  const verdict = judge({ doc, now, prev, retried })
  return { ...verdict, tried, now }
}

async function selfTest() {
  const out = []
  const t = (name, pass) => out.push({ name, pass: !!pass })
  const end = (o) => ({ source: 'live', version: '1.2.3', resolvedAt: '2026-11-03T09:00:00.000Z', assets: [{ sizeBytes: 1000 }], ...o })
  const goodDoc = (now) => ({
    generatedAt: new Date(now - 60_000).toISOString(),
    downloads: {
      desktop: end({}),
      'android-apk': end({}),
      mobile: end({ assets: undefined }),
      ios: end({}),
      cli: end({ assets: undefined }),
      extension: end({}),
      'wechat-miniapp': end({ version: undefined }),
      web: { source: 'unavailable', reason: WEB_REASON, resolvedAt: new Date(now - 60_000).toISOString() },
    },
  })
  const now = Date.parse('2026-11-03T09:30:00.000Z')
  // 1 全绿:八端都在位 ⇒ ok
  const a = judge({ doc: goodDoc(now), now, prev: null })
  t('1 八端齐备且新鲜 ⇒ ok', a.state === 'ok' && a.findings.length === 0)
  // 2 成对:安卓掉 unavailable ⇒ 红(必备端),摘掉这一手就判不出
  const b = judge({ doc: { ...goodDoc(now), downloads: { ...goodDoc(now).downloads, 'android-apk': { source: 'unavailable', reason: 'no-latest-row' } } }, now, prev: null })
  t('2 安卓掉 unavailable ⇒ 判红(翻转类,单轮即喊)', b.state === 'red' && b.findings.some((f) => f.id === 'android-apk:end-unavailable' && f.immediate === true))
  // 3 非翻转的 snapshot 降级 ⇒ 进 pending,不当轮喊人
  const c = judge({ doc: { ...goodDoc(now), downloads: { ...goodDoc(now).downloads, ios: { source: 'snapshot', reason: 'fetch-timeout' } } }, now, prev: null })
  t('3 iOS snapshot 单轮 ⇒ 先不喊人(进 pending)', c.state === 'ok' && (c.pending ?? []).includes('ios:end-snapshot'))
  const c2 = judge({
    doc: { ...goodDoc(now), downloads: { ...goodDoc(now).downloads, ios: { source: 'snapshot', reason: 'fetch-timeout' } } },
    now,
    prev: { findings: [{ id: 'ios:end-snapshot' }], states: { ios: 'live' } },
  })
  t('3b 同一条第二轮 ⇒ 升级为可喊人并转红', c2.state === 'red' && c2.findings.find((f) => f.id === 'ios:end-snapshot')?.immediate === true)
  // 4 体积拿不到 ⇒ 判据命中(安卓那格今天真出过 0)
  const d = judge({ doc: { ...goodDoc(now), downloads: { ...goodDoc(now).downloads, 'android-apk': end({ assets: [{ sizeBytes: 0 }] }) } }, now, prev: null })
  t('4 安卓体积 0 ⇒ no-asset-bytes 命中', d.findings.some((f) => f.id === 'android-apk:no-asset-bytes'))
  // 5 整站停更:超过上限 ⇒ stale-payload(超 2× 上限当轮即喊)
  const stale = judge({
    doc: {
      ...goodDoc(now),
      generatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      downloads: Object.fromEntries(Object.entries(goodDoc(now).downloads).map(([k, v]) => [k, { ...v, resolvedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString() }])),
    },
    now,
    prev: null,
  })
  t('5 整站 3h 未刷新 ⇒ stale 且属立即类', stale.state === 'red' && stale.findings.some((f) => f.id === '(整体):stale-payload' && f.immediate))
  // 6 少一端 ⇒ missing-end 立即类
  const missing = judge({ doc: { ...goodDoc(now), downloads: { ...goodDoc(now).downloads, extension: undefined } }, now, prev: null })
  t('6 少了 extension 一端 ⇒ missing-end', missing.findings.some((f) => f.id === 'extension:missing-end'))
  // 7 web 变成 live ⇒ 只报名不判红
  const web = judge({ doc: { ...goodDoc(now), downloads: { ...goodDoc(now).downloads, web: end({}) } }, now, prev: null })
  t('7 web 变 live ⇒ 报名但不判红', web.state === 'ok' && web.findings.some((f) => f.id === 'web:web-design-changed' && !f.immediate))
  // 8 取不到 ⇒ unjudged,既不绿也不红
  const u = judge({ doc: null, now, prev: null })
  t('8 payload 取不到 ⇒ unjudged(不冒绿)', u.state === 'unjudged' && /取不到/.test(u.reason ?? ''))
  const u2 = judge({ doc: { generatedAt: new Date(now).toISOString() }, now, prev: null })
  t('9 没有 downloads 层 ⇒ unjudged 不猜', u2.state === 'unjudged')
  // 10 两臂顺序:本机臂必须在公网臂之前(公网要过 CDN+跨境段)
  const as = arms()
  t('10 取数臂先本机后公网', as[0].label === 'source' && as[1].label === 'public' && /127\.0\.0\.1/.test(as[0].url))
  // 11 新鲜度重试一次才判:第一次 stale、第二次新鲜 ⇒ 不误报
  let calls = 0
  const r = await runCheck({
    now,
    prev: null,
    wait: async () => {},
    readImpl: async () => {
      calls += 1
      return { doc: calls === 1 ? { ...goodDoc(now), generatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), downloads: Object.fromEntries(Object.entries(goodDoc(now).downloads).map(([k, v]) => [k, { ...v, resolvedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString() }])) } : goodDoc(now), tried: [`mock:${calls}`] }
    },
  })
  t('11 stale 先重试一次 ⇒ 第二把新鲜就不喊', calls === 2 && !r.findings.some((f) => f.kind === 'stale-payload'))
  // 12 反向锁:时刻字段整个拿掉 ⇒ 必须落"判不了新鲜度",不得静默当通过
  const noAnyTs = {
    downloads: Object.fromEntries(
      Object.entries(goodDoc(now).downloads).map(([k, v]) => [k, { ...v, resolvedAt: undefined }]),
    ),
  }
  const noTs = judge({ doc: noAnyTs, now, prev: null })
  t('12 无任何时刻字段 ⇒ no-timestamp 立即类(未判定不许当绿)', noTs.findings.some((f) => f.id === '(整体):no-timestamp' && f.immediate))
  const bad = out.filter((x) => !x.pass)
  for (const x of out) console.log(`${x.pass ? '✔' : '✘'} ${x.name}`)
  console.log(`自检 ${out.length - bad.length}/${out.length} 通过`)
  return bad.length === 0 ? 0 : 1
}

/** 台账落点(供调度器读上一轮);本器只写自己那一份,不与他人共用。按脚本自身位置推导,不以仓库根为锚点(本器读的是运行台账,不是仓库内容) */
export const STATE_FILE = fileURLToPath(new URL('../.ihui-agent/state/downloads-live-health-last.json', import.meta.url)).split(path.sep).join('/')
function readPrev() {
  try {
    const o = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    return { findings: Array.isArray(o.findings) ? o.findings : [], states: o.states && typeof o.states === 'object' ? o.states : {} }
  } catch {
    return null
  }
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  const r = await runCheck({ prev: readPrev() })
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ state: r.state, findings: r.findings, pending: r.pending ?? [], readings: r.readings, agesMs: r.agesMs ?? null, tried: r.tried, reason: r.reason ?? null })}\n`)
  } else {
    for (const f of r.findings) console.log(`  ${f.immediate ? '❌' : '⚠'} [${f.id}] ${f.detail}`)
    console.log(`判定:${r.state} | 臂:${(r.tried ?? []).join(' → ')} | 读数:${(r.readings ?? []).length} 端${r.reason ? ` | ${r.reason}` : ''}`)
  }
  return r.state === 'red' ? 1 : r.state === 'unjudged' ? 2 : 0
}

export const __test__ = { judge, runCheck, arms, END_EXPECTATIONS, WEB_REASON, STALE_MS, newestResolvedAtMs, readPayload }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((code) => process.exit(code))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
