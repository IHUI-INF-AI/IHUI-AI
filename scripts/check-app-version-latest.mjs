#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-app-version-latest.mjs — App 内更新卡的「latest 行」只读对账(2026-10-29 立,Y-14)
 *
 * 为什么要有这一条:线上 `GET /api/app-version/latest?platform=android` 返回
 * `{"code":0,"data":{}}` —— 空对象不是超时,是服务端把 `undefined` 序列化时丢了字段。
 * 更新卡拿不到下载地址这件事在监控上是"200 正常",在用户侧是"没有可点的按钮",
 * 所以**必须有一条只读断言把它钉住**,否则修好了也会在下一次发布会悄悄退回原状。
 *
 * 判据三条(逐条来自票面,不增不减):
 *   ① 存在 status=latest 的 android 行(端点能读到该行,且 platform/status/buildNumber 自洽)
 *   ② 该行 downloadUrl 指向**自有站点腿**(host ∈ {www.aizhs.top, aizhs.top} ∧ path 前缀
 *      /remote-images/download/) —— dl.aizhs.top(COS/CF 腿)与第三方网盘都不算,
 *      因为票面要求"与网页按钮同一个源"
 *   ③ 该地址真的能取到 apk(302 落到版本副本,Range 探测 200/206,Content-Type 是 apk)
 *
 * 附加一致性项(不是票面新增判据,而是③的必要条件):apk 端点回的
 * `x-release-version` / `x-release-version-code` 必须与行里的 version/buildNumber 相同。
 * 否则会出现"行写了新版本、包还是旧的"这种账绿实红 —— publish-mobile-apk.mjs 里
 * 同一份教训写成了"线上版本标记会骗"。缺该头 ⇒ undetermined(点名原因),不判红。
 *
 * 退出码:0 全绿 / 1 有红 / 2 未判定(取不到输入,或有项 undetermined 而无红)。
 * 纪律:取不到输入一律 undetermined 并点名原因,**绝不为过门放宽判据**。
 *
 * 用法:
 *   node scripts/check-app-version-latest.mjs
 *   node scripts/check-app-version-latest.mjs --base-url https://www.aizhs.top --platform android
 *   node scripts/check-app-version-latest.mjs --admin-token "$JWT"   # 额外区分"无行" vs "有行但 status≠latest"
 *   node scripts/check-app-version-latest.mjs --json
 */
import { pathToFileURL } from 'node:url'

export const DEFAULT_BASE_URL = 'https://www.aizhs.top'
export const EXPECTED_PLATFORM = 'android'
/** 自有站点腿(与 publish-mobile-apk.mjs 的 SITE_LEG.PublicBase 同源) */
export const OWN_LEG_HOSTS = ['www.aizhs.top', 'aizhs.top']
export const OWN_LEG_PATH_PREFIX = '/remote-images/download/'
/** 票面指定的固定下载地址(与网页按钮同一个源) */
export const PINNED_DOWNLOAD_URL = 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk'
const APK_CONTENT_TYPE = 'vnd.android.package-archive'

// =============================================================================
// 纯判据(不碰网络、不碰磁盘 ⇒ 镜像测试可逐条钉)
// =============================================================================

/** 结果项:pass / fail / undetermined 三元,不允许第四态。 */
export function item(id, state, detail) {
  return { id, state, detail }
}

/**
 * 解析 /latest 的响应体。
 * 关键区分(这就是票面要我钉死的那条):
 *   - `data.latest` 缺失 且 data 是对象 ⇒ **有输入、判据不命中** = fail(表里没有 latest 行)
 *   - 响应读不到 / 不是 JSON / code≠0 ⇒ undetermined(说不出表里有没有行)
 * 绝不允许把后者当成前者,也不允许反过来。
 */
export function judgeLatestPayload(payload, { platform = EXPECTED_PLATFORM } = {}) {
  if (payload === null || typeof payload !== 'object') {
    return { latest: null, items: [item('endpoint', 'undetermined', '/latest 响应不是 JSON 对象')] }
  }
  if (payload.code !== 0) {
    return {
      latest: null,
      items: [
        item(
          'endpoint',
          'undetermined',
          `/latest 返回 code=${payload.code} message=${payload.message ?? ''}`,
        ),
      ],
    }
  }
  const data = payload.data
  if (data === null || typeof data !== 'object') {
    return { latest: null, items: [item('endpoint', 'undetermined', '/latest 响应缺 data 对象')] }
  }
  const latest = data.latest
  if (latest === undefined || latest === null) {
    return {
      latest: null,
      items: [
        item('endpoint', 'pass', '/latest 可读且 code=0'),
        item(
          'latest-row',
          'fail',
          `data.latest 缺失 ⇒ app_versions 表内没有 status=latest 的 ${platform} 行(端点判据是 status='latest' + platform,不是版本排序兜底)`,
        ),
      ],
    }
  }
  return {
    latest,
    items: [
      item('endpoint', 'pass', '/latest 可读且 code=0'),
      item(
        'latest-row',
        'pass',
        `拿到 latest 行 version=${latest.version} build=${latest.buildNumber}`,
      ),
    ],
  }
}

/** downloadUrl 是否指向自有站点腿。返回 {ok, reason}。 */
export function judgeOwnLegUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, reason: 'downloadUrl 为空 ⇒ 更新卡拿到的 downloadUrl 是 null' }
  }
  let u
  try {
    u = new URL(raw)
  } catch {
    return { ok: false, reason: `downloadUrl 不是绝对 URL: ${raw}` }
  }
  if (u.protocol !== 'https:') return { ok: false, reason: `downloadUrl 不是 https: ${raw}` }
  if (!OWN_LEG_HOSTS.includes(u.hostname)) {
    return {
      ok: false,
      reason: `downloadUrl host=${u.hostname} 不在自有站点腿 ${OWN_LEG_HOSTS.join('/')} 内: ${raw}`,
    }
  }
  if (!u.pathname.startsWith(OWN_LEG_PATH_PREFIX)) {
    return { ok: false, reason: `downloadUrl path 不以 ${OWN_LEG_PATH_PREFIX} 开头: ${raw}` }
  }
  return { ok: true, reason: `自有站点腿: ${raw}` }
}

/** 行自洽性:platform / status / version / buildNumber。 */
export function judgeRow(row, { platform = EXPECTED_PLATFORM } = {}) {
  const items = []
  if (row.platform !== platform) {
    items.push(
      item(
        'row-shape',
        'fail',
        `latest 行 platform=${JSON.stringify(row.platform)},期望 ${platform}`,
      ),
    )
  }
  if (row.status !== 'latest') {
    items.push(
      item('row-shape', 'fail', `latest 行 status=${JSON.stringify(row.status)},期望 latest`),
    )
  }
  if (typeof row.version !== 'string' || row.version.trim() === '') {
    items.push(item('row-shape', 'fail', 'latest 行 version 为空'))
  }
  if (!Number.isInteger(row.buildNumber) || row.buildNumber <= 0) {
    items.push(
      item(
        'row-shape',
        'fail',
        `latest 行 buildNumber=${JSON.stringify(row.buildNumber)} 不是正整数`,
      ),
    )
  }
  if (items.length === 0) {
    items.push(
      item(
        'row-shape',
        'pass',
        `platform=${row.platform} status=latest version=${row.version} buildNumber=${row.buildNumber}`,
      ),
    )
  }
  return items
}

/**
 * 探针结果判定(纯函数):把 probeDownload 的观测折成一项。
 * present ⇒ pass;absent ⇒ fail;undetermined ⇒ undetermined(点名原因)。
 */
export function judgeDownloadProbe(probe) {
  if (!probe || typeof probe !== 'object') {
    return item('apk-downloadable', 'undetermined', '未执行下载探针')
  }
  if (probe.state === 'undetermined') {
    return item('apk-downloadable', 'undetermined', probe.detail || '下载探针未判定')
  }
  if (probe.state !== 'present') {
    return item('apk-downloadable', 'fail', probe.detail || '下载地址取不到 apk')
  }
  const detail = `HTTP ${probe.status} ${probe.contentType} 大小 ${probe.totalSize ?? '?'} 跳数 ${probe.hops} → ${probe.finalUrl}`
  if (!String(probe.contentType || '').includes(APK_CONTENT_TYPE)) {
    return item('apk-downloadable', 'fail', `Content-Type 不是 apk(多半落到占位页): ${detail}`)
  }
  return item('apk-downloadable', 'pass', detail)
}

/** apk 响应头里的版本标记 vs 行里登记的版本。缺头 ⇒ undetermined。 */
export function judgeVersionConsistency(row, probe) {
  if (!probe || probe.state !== 'present') {
    return item('apk-matches-row', 'undetermined', '下载探针未取到 apk,无法比对版本标记')
  }
  const rv = probe.releaseVersion
  const rc = probe.releaseVersionCode
  if (!rv && !rc) {
    return item(
      'apk-matches-row',
      'undetermined',
      'apk 响应缺 x-release-version / x-release-version-code 头 ⇒ 无法证明包与行同版',
    )
  }
  const bad = []
  if (rv && String(rv) !== String(row.version))
    bad.push(`x-release-version=${rv} ≠ 行 version=${row.version}`)
  if (rc && String(rc) !== String(row.buildNumber))
    bad.push(`x-release-version-code=${rc} ≠ 行 buildNumber=${row.buildNumber}`)
  if (bad.length > 0) return item('apk-matches-row', 'fail', bad.join(';'))
  return item('apk-matches-row', 'pass', `apk 标记与行一致(${rv ?? '?'} / ${rc ?? '?'})`)
}

/** 三项汇总成退出码。任一 red ⇒ 1;无红但有 undetermined ⇒ 2;否则 0。 */
export function summarize(items) {
  const red = items.filter((i) => i.state === 'fail')
  const undetermined = items.filter((i) => i.state === 'undetermined')
  const state = red.length > 0 ? 'fail' : undetermined.length > 0 ? 'undetermined' : 'pass'
  return {
    state,
    red,
    undetermined,
    exitCode: state === 'fail' ? 1 : state === 'undetermined' ? 2 : 0,
  }
}

// =============================================================================
// 网络探针(仅 IO,不含判据)
// =============================================================================

async function readJson(url, { fetchImpl = fetch, timeoutMs = 20000, token } = {}) {
  const res = await fetchImpl(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return {
      httpStatus: res.status,
      body: null,
      error: `响应不是 JSON(HTTP ${res.status}): ${text.slice(0, 120)}`,
    }
  }
  return { httpStatus: res.status, body, error: null }
}

/**
 * 下载探针:手动跟跳(不用 redirect:'follow',因为 x-release-* 只挂在 302 那一跳,
 * follow 会把中间头丢掉),最后用 Range: bytes=0-0 拿到 206 + 总大小,不拖 80MB。
 * 任何网络异常都折成 undetermined 并带原因,绝不抛给调用方。
 */
export async function probeDownload(
  url,
  { fetchImpl = fetch, timeoutMs = 20000, maxHops = 3 } = {},
) {
  const release = { version: null, code: null }
  let current = url
  try {
    for (let hop = 1; hop <= maxHops + 1; hop++) {
      // 每一跳都带 Range:302 那跳的正文是空的,带 Range 不影响重定向;而万一首跳直接
      // 回文件(CDN 不做指针中转),Range 保证不会把 80MB 拖回来。线上实测 302 仍带 x-release-*。
      const res = await fetchImpl(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { range: 'bytes=0-0' },
      })
      const headers = res.headers
      if (!release.version && headers.get('x-release-version'))
        release.version = headers.get('x-release-version')
      if (!release.code && headers.get('x-release-version-code'))
        release.code = headers.get('x-release-version-code')

      const loc = headers.get('location')
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => {})
        if (!loc) return { state: 'absent', detail: `HTTP ${res.status} 但缺 Location` }
        const next = new URL(loc, current).toString()
        if (!next.startsWith('https://'))
          return { state: 'absent', detail: `重定向目标不是 https: ${next}` }
        current = next
        continue
      }

      const ct = headers.get('content-type') || ''
      const cr = headers.get('content-range') || ''
      const totalFromRange = cr.includes('/') ? Number(cr.split('/')[1]) : null
      const total = totalFromRange ?? Number(headers.get('content-length') || 0) ?? null
      await res.body?.cancel().catch(() => {})

      if (res.status !== 200 && res.status !== 206) {
        return {
          state: 'absent',
          detail: `HTTP ${res.status} (${current})`,
          finalUrl: current,
          status: res.status,
          contentType: ct,
        }
      }
      return {
        state: 'present',
        finalUrl: current,
        status: res.status,
        contentType: ct,
        totalSize: total || null,
        hops: hop,
        releaseVersion: release.version,
        releaseVersionCode: release.code,
      }
    }
    return { state: 'absent', detail: `重定向超过 ${maxHops} 跳(停在 ${current})` }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return { state: 'undetermined', detail: `下载探针异常(${msg})` }
  }
}

/** 公开端点:不带 platform 查一次,用来区分"只有该平台缺"还是"全平台都没有 latest"。 */
export async function probeCrossPlatformLatest({
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch,
  timeoutMs = 20000,
} = {}) {
  try {
    const { body, error } = await readJson(`${baseUrl}/api/app-version/latest`, {
      fetchImpl,
      timeoutMs,
    })
    if (error) return { state: 'undetermined', detail: error }
    if (body?.code !== 0)
      return { state: 'undetermined', detail: `/latest(无 platform) code=${body?.code}` }
    const latest = body?.data?.latest
    return {
      state: 'present',
      hasAnyLatest: latest !== undefined && latest !== null,
      detail: latest
        ? `全平台 latest: ${latest.platform} ${latest.version} (build ${latest.buildNumber})`
        : '全平台均无 status=latest 行',
    }
  } catch (e) {
    return {
      state: 'undetermined',
      detail: `跨平台探针异常(${e instanceof Error ? e.message : e})`,
    }
  }
}

/** 需令牌的诊断项:列出该平台全部行,区分"无行"vs"有行但 status≠latest"。 */
export async function probeAdminList({
  baseUrl = DEFAULT_BASE_URL,
  platform = EXPECTED_PLATFORM,
  token,
  fetchImpl = fetch,
  timeoutMs = 20000,
} = {}) {
  if (!token) {
    return {
      state: 'undetermined',
      detail:
        '未提供 --admin-token ⇒ 无法区分「表里没有该平台行」与「有行但 status≠latest」(admin 面只认人用 JWT)',
    }
  }
  try {
    const url = `${baseUrl}/api/app-version?platform=${encodeURIComponent(platform)}&pageSize=100`
    const { body, error, httpStatus } = await readJson(url, { fetchImpl, timeoutMs, token })
    if (error) return { state: 'undetermined', detail: error }
    if (httpStatus === 401 || httpStatus === 403)
      return { state: 'undetermined', detail: `admin 令牌被拒(HTTP ${httpStatus}) ⇒ 换新 JWT 再跑` }
    if (body?.code !== 0)
      return {
        state: 'undetermined',
        detail: `admin 列表 code=${body?.code} message=${body?.message ?? ''}`,
      }
    const list = body?.data?.list
    if (!Array.isArray(list))
      return { state: 'undetermined', detail: 'admin 列表响应缺 data.list 数组' }
    const dist = {}
    for (const r of list) dist[r.status] = (dist[r.status] ?? 0) + 1
    const versions = list.map((r) => `${r.version}/${r.buildNumber}:${r.status}`)
    return {
      state: 'present',
      rowCount: list.length,
      statusDist: dist,
      detail:
        list.length === 0
          ? `表内 ${platform} 行数 0 ⇒ 是「无行」,登记要 INSERT`
          : `${platform} 行数 ${list.length},status 分布 ${JSON.stringify(dist)},行=${versions.join(', ')}`,
    }
  } catch (e) {
    return {
      state: 'undetermined',
      detail: `admin 列表探针异常(${e instanceof Error ? e.message : e})`,
    }
  }
}

// =============================================================================
// CLI
// =============================================================================

export function parseArgs(argv) {
  const out = {
    baseUrl: DEFAULT_BASE_URL,
    platform: EXPECTED_PLATFORM,
    adminToken: '',
    json: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base-url') out.baseUrl = (argv[++i] ?? '').replace(/\/+$/, '')
    else if (a === '--platform') out.platform = argv[++i] ?? EXPECTED_PLATFORM
    else if (a === '--admin-token') out.adminToken = argv[++i] ?? ''
    else if (a === '--json') out.json = true
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数: ${a}`)
  }
  if (!out.baseUrl) throw new Error('--base-url 不能为空')
  return out
}

export async function runCheck({
  baseUrl = DEFAULT_BASE_URL,
  platform = EXPECTED_PLATFORM,
  adminToken = '',
  fetchImpl = fetch,
  timeoutMs = 20000,
} = {}) {
  const items = []
  let payload = null
  try {
    const { body, error } = await readJson(
      `${baseUrl}/api/app-version/latest?platform=${encodeURIComponent(platform)}`,
      { fetchImpl, timeoutMs },
    )
    if (error) items.push(item('endpoint', 'undetermined', `取 /latest 失败: ${error}`))
    else payload = body
  } catch (e) {
    items.push(
      item('endpoint', 'undetermined', `取 /latest 异常(${e instanceof Error ? e.message : e})`),
    )
  }

  const parsed = payload ? judgeLatestPayload(payload, { platform }) : { latest: null, items: [] }
  items.push(...parsed.items)
  const row = parsed.latest

  const cross = await probeCrossPlatformLatest({ baseUrl, fetchImpl, timeoutMs })
  items.push(
    item(
      'cross-platform-latest',
      cross.state === 'present' ? (cross.hasAnyLatest ? 'pass' : 'fail') : 'undetermined',
      cross.detail,
    ),
  )

  if (row) {
    items.push(...judgeRow(row, { platform }))
    const leg = judgeOwnLegUrl(row.downloadUrl)
    items.push(item('download-url-own-leg', leg.ok ? 'pass' : 'fail', leg.reason))
    if (leg.ok) {
      const probe = await probeDownload(row.downloadUrl, { fetchImpl, timeoutMs })
      items.push(judgeDownloadProbe(probe))
      items.push(judgeVersionConsistency(row, probe))
    } else {
      items.push(
        item(
          'apk-downloadable',
          'undetermined',
          'downloadUrl 不是自有腿 ⇒ 不对第三方地址发探针(也不把 404 算成绿)',
        ),
      )
      items.push(item('apk-matches-row', 'undetermined', '无自有腿地址 ⇒ 无包可比版本'))
    }
  } else {
    items.push(item('row-shape', 'undetermined', '没有 latest 行可校验形状'))
    items.push(item('download-url-own-leg', 'undetermined', '没有 latest 行可校验 downloadUrl'))
    items.push(item('apk-downloadable', 'undetermined', '没有 latest 行可探针下载'))
    items.push(item('apk-matches-row', 'undetermined', '没有 latest 行可比对版本'))
  }

  // table-state 是**诊断**而非票面判据:无令牌时不参与红/绿(否则脚本永远不能绿),
  // 但它决定"该 INSERT 还是该 UPDATE",所以必须打在输出里。
  const admin = await probeAdminList({ baseUrl, platform, token: adminToken, fetchImpl, timeoutMs })
  const diagnostics = [
    item('table-state', admin.state === 'present' ? 'pass' : 'undetermined', admin.detail),
  ]

  return { items, diagnostics, ...summarize(items), platform, baseUrl }
}

function printHuman(result) {
  const icon = { pass: '✓', fail: '✗', undetermined: '?' }
  console.log(`对账目标: ${result.baseUrl} platform=${result.platform}`)
  for (const i of result.items)
    console.log(`  ${icon[i.state] ?? '?'} [${i.state}] ${i.id}: ${i.detail}`)
  for (const d of result.diagnostics ?? []) {
    console.log(`  · [诊断·不计入结论] ${d.id}: ${d.detail}`)
  }
  const { red, undetermined } = result
  console.log(
    `\n结论: ${result.state.toUpperCase()}  (红 ${red.length} / 未判定 ${undetermined.length} / 共 ${result.items.length})`,
  )
  if (red.length > 0) {
    console.log('红的项(不放宽判据,修数据而不是修尺):')
    for (const r of red) console.log(`  - ${r.id}: ${r.detail}`)
    console.log(
      '修法: node scripts/register-app-version-latest.mjs --help  (登记 0.0.9/26102816 为 android latest)',
    )
  }
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`未判定: ${e.message}`)
    return 2
  }
  if (args.help) {
    console.log(
      '用法: node scripts/check-app-version-latest.mjs [--base-url <url>] [--platform android] [--admin-token <JWT>] [--json]',
    )
    console.log('退出码: 0 全绿 / 1 有红(现状即红时如实打印) / 2 未判定')
    return 0
  }
  const result = await runCheck({
    baseUrl: args.baseUrl,
    platform: args.platform,
    adminToken: args.adminToken,
  })
  if (args.json) console.log(JSON.stringify(result, null, 2))
  else printHuman(result)
  return result.exitCode
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`未判定: ${e?.message ?? e}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
