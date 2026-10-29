// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-14 镜像测试:scripts/check-app-version-latest.mjs 的判据。
 * 判据函数一律直接 import 源文件(§22c 反"只复读实现"),fixture 逐字取自线上现读:
 *   GET https://www.aizhs.top/api/app-version/latest?platform=android
 *   → {"code":0,"message":"success","data":{}}
 * 覆盖:现状即红 / 自有腿三向 / 探针三元 / 版本标记一致性 / 退出码优先级。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  judgeLatestPayload,
  judgeRow,
  judgeOwnLegUrl,
  judgeDownloadProbe,
  judgeVersionConsistency,
  summarize,
  parseArgs,
  runCheck,
  probeAdminList,
  PINNED_DOWNLOAD_URL,
} from '../check-app-version-latest.mjs'

/** 线上现读的原始响应(逐字) */
const LIVE_EMPTY = { code: 0, message: 'success', data: {} }

/** 一行合法的 latest(形状取自 packages/database/src/schema/app-version.ts) */
const GOOD_ROW = {
  id: '0b3f8d1e-1111-4222-8333-944455556666',
  version: '0.0.9',
  platform: 'android',
  buildNumber: 26102816,
  downloadUrl: PINNED_DOWNLOAD_URL,
  forceUpdate: false,
  releaseNotes: null,
  status: 'latest',
}

function fakeResponse({ status = 200, headers = {}, json, text }) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]))
  return {
    status,
    url: '',
    headers: { get: (k) => h.get(String(k).toLowerCase()) ?? null },
    body: { cancel: async () => {} },
    async text() {
      return text ?? JSON.stringify(json)
    },
    async json() {
      return json
    },
  }
}

// ---------------------------------------------------------------------------
// ① 端点判据:空 data 是"无行",不是"读不到"
// ---------------------------------------------------------------------------

test('线上现状(逐字 fixture)判红:data 为空对象 ⇒ 无 status=latest 行', () => {
  const { latest, items } = judgeLatestPayload(LIVE_EMPTY)
  assert.equal(latest, null)
  assert.equal(items[0].state, 'pass', '端点本身是可读的(200 code=0),不能判 undetermined')
  const rowItem = items.find((i) => i.id === 'latest-row')
  assert.equal(rowItem.state, 'fail')
  assert.match(rowItem.detail, /status=latest/)
})

test('反假绿:用同一份 fixture 构造四元组,红必须压过 undetermined(exit 1)', () => {
  const items = [
    ...judgeLatestPayload(LIVE_EMPTY).items,
    { id: 'table-state', state: 'undetermined', detail: '无令牌' },
  ]
  assert.equal(summarize(items).exitCode, 1, '有红时不得因为"还有未判定项"退成 2')
})

test('端点读不到 ⇒ undetermined,不得冒充"表里没有行"', () => {
  const r1 = judgeLatestPayload(null)
  assert.equal(r1.items[0].state, 'undetermined')
  const r2 = judgeLatestPayload({ code: 500, message: 'boom' })
  assert.equal(r2.items[0].state, 'undetermined')
  assert.equal(
    r2.items.some((i) => i.state === 'fail'),
    false,
    '服务端故障不是"表里无行"的证据',
  )
  const r3 = judgeLatestPayload({ code: 0 })
  assert.equal(r3.items[0].state, 'undetermined')
})

test('有 latest 行时端点判据转绿,并交出行对象', () => {
  const { latest, items } = judgeLatestPayload({ code: 0, data: { latest: GOOD_ROW } })
  assert.equal(latest.id, GOOD_ROW.id)
  assert.ok(items.every((i) => i.state === 'pass'))
})

// ---------------------------------------------------------------------------
// ② 行形状 + 自有腿
// ---------------------------------------------------------------------------

test('合法行通过形状判据', () => {
  assert.deepEqual(
    judgeRow(GOOD_ROW).map((i) => i.state),
    ['pass'],
  )
})

test('行形状三向腐烂各红一次(platform / status / buildNumber)', () => {
  assert.equal(judgeRow({ ...GOOD_ROW, platform: 'ios' })[0].state, 'fail')
  assert.equal(judgeRow({ ...GOOD_ROW, status: 'history' })[0].state, 'fail')
  assert.equal(judgeRow({ ...GOOD_ROW, buildNumber: 0 })[0].state, 'fail')
  assert.equal(
    judgeRow({ ...GOOD_ROW, buildNumber: '26102816' })[0].state,
    'fail',
    '字符串构建号不算正整数',
  )
})

test('自有腿判据:站点腿过,dl 腿/第三方/http/空 全红', () => {
  assert.equal(judgeOwnLegUrl(PINNED_DOWNLOAD_URL).ok, true)
  assert.equal(
    judgeOwnLegUrl('https://aizhs.top/remote-images/download/ihui-ai-latest.apk').ok,
    true,
  )
  assert.equal(
    judgeOwnLegUrl('https://dl.aizhs.top/ihui-ai-latest.apk').ok,
    false,
    'COS/CF 腿不是"与网页按钮同一个源"',
  )
  assert.equal(judgeOwnLegUrl('https://cdn.example.com/remote-images/download/x.apk').ok, false)
  assert.equal(judgeOwnLegUrl('http://www.aizhs.top/remote-images/download/x.apk').ok, false)
  assert.equal(judgeOwnLegUrl('https://www.aizhs.top/other/x.apk').ok, false)
  assert.equal(judgeOwnLegUrl('').ok, false)
  assert.equal(judgeOwnLegUrl(null).ok, false)
  assert.match(judgeOwnLegUrl('').reason, /downloadUrl 为空/)
})

// ---------------------------------------------------------------------------
// ③ 下载探针(手动跟跳 + Range)与版本标记
// ---------------------------------------------------------------------------

test('探针三元:302→206 apk 为 present / 302→404 为 absent / 网络异常为 undetermined', () => {
  const present = {
    state: 'present',
    status: 206,
    contentType: 'application/vnd.android.package-archive',
    totalSize: 84915649,
    hops: 2,
    finalUrl: 'https://www.aizhs.top/remote-images/download/ihui-ai-0.0.9-26102816.apk',
  }
  assert.equal(judgeDownloadProbe(present).state, 'pass')
  assert.equal(judgeDownloadProbe({ state: 'absent', detail: 'HTTP 404' }).state, 'fail')
  assert.equal(
    judgeDownloadProbe({ state: 'undetermined', detail: 'ETIMEDOUT' }).state,
    'undetermined',
  )
  assert.equal(judgeDownloadProbe(null).state, 'undetermined')
})

test('Content-Type 不是 apk 时判红(落到占位页的典型形态)', () => {
  const r = judgeDownloadProbe({
    state: 'present',
    status: 200,
    contentType: 'text/html',
    totalSize: 1234,
    hops: 1,
  })
  assert.equal(r.state, 'fail')
  assert.match(r.detail, /Content-Type/)
})

test('版本标记一致性:与行一致过 / 不一致红 / 缺头 undetermined', () => {
  const probe = { state: 'present', releaseVersion: '0.0.9', releaseVersionCode: '26102816' }
  assert.equal(judgeVersionConsistency(GOOD_ROW, probe).state, 'pass')
  assert.equal(
    judgeVersionConsistency(GOOD_ROW, { ...probe, releaseVersionCode: '26102815' }).state,
    'fail',
  )
  assert.equal(
    judgeVersionConsistency(GOOD_ROW, { state: 'present' }).state,
    'undetermined',
    '缺 x-release-* 不能算"包同版"',
  )
  assert.equal(judgeVersionConsistency(GOOD_ROW, { state: 'absent' }).state, 'undetermined')
})

test('退出码:全绿 0 / 仅未判定 2 / 有红 1', () => {
  assert.equal(summarize([{ id: 'a', state: 'pass', detail: '' }]).exitCode, 0)
  assert.equal(
    summarize([
      { id: 'a', state: 'pass', detail: '' },
      { id: 'b', state: 'undetermined', detail: '' },
    ]).exitCode,
    2,
  )
  assert.equal(
    summarize([
      { id: 'b', state: 'undetermined', detail: '' },
      { id: 'c', state: 'fail', detail: '' },
    ]).exitCode,
    1,
  )
})

// ---------------------------------------------------------------------------
// ④ 端到端(注入 fake fetch,不联网):红/绿/未判定三态各跑一遍
// ---------------------------------------------------------------------------

function routedFetch(routes) {
  return async (url) => {
    for (const [needle, make] of routes) if (String(url).includes(needle)) return make(String(url))
    throw new Error(`未编排的 URL: ${url}`)
  }
}

test('runCheck 对"空 data + 站点腿通"的编排:红在 latest-row,且仍探针了跨平台面', async () => {
  const fetchImpl = routedFetch([
    ['/api/app-version/latest?platform=android', () => fakeResponse({ json: LIVE_EMPTY })],
    ['/api/app-version/latest', () => fakeResponse({ json: LIVE_EMPTY })],
  ])
  const r = await runCheck({ fetchImpl })
  assert.equal(r.state, 'fail')
  assert.equal(r.exitCode, 1)
  const ids = r.items.map((i) => i.id)
  for (const need of ['endpoint', 'latest-row', 'cross-platform-latest', 'download-url-own-leg']) {
    assert.ok(ids.includes(need), `缺判据项 ${need}`)
  }
  // table-state 是诊断(不计入红/绿),但必须出现在输出里:它决定该 INSERT 还是 UPDATE
  assert.equal(r.diagnostics.map((d) => d.id).includes('table-state'), true)
  assert.match(r.items.find((i) => i.id === 'latest-row').detail, /android/)
})

test('runCheck 对"有行 + 302→206 + 版本标记一致"的编排:全绿 exit 0', async () => {
  const fetchImpl = routedFetch([
    [
      '/api/app-version/latest?platform=android',
      () => fakeResponse({ json: { code: 0, data: { latest: GOOD_ROW } } }),
    ],
    [
      'ihui-ai-latest.apk',
      () =>
        fakeResponse({
          status: 302,
          headers: {
            location: 'https://www.aizhs.top/remote-images/download/ihui-ai-0.0.9-26102816.apk',
            'x-release-version': '0.0.9',
            'x-release-version-code': '26102816',
          },
        }),
    ],
    [
      'ihui-ai-0.0.9-26102816.apk',
      () =>
        fakeResponse({
          status: 206,
          headers: {
            'content-type': 'application/vnd.android.package-archive',
            'content-range': 'bytes 0-0/84915649',
          },
        }),
    ],
    [
      '/api/app-version/latest',
      () => fakeResponse({ json: { code: 0, data: { latest: GOOD_ROW } } }),
    ],
  ])
  const r = await runCheck({ fetchImpl })
  assert.equal(r.state, 'pass', JSON.stringify(r.items, null, 1))
  assert.equal(r.exitCode, 0)
})

test('runCheck 网络全挂 ⇒ undetermined(exit 2),不伪造成红也不伪造成绿', async () => {
  const fetchImpl = async () => {
    throw new Error('ENOTFOUND')
  }
  const r = await runCheck({ fetchImpl })
  assert.equal(r.state, 'undetermined')
  assert.equal(r.exitCode, 2)
  assert.equal(r.red.length, 0)
})

// ---------------------------------------------------------------------------
// ⑤ admin 诊断:区分「表里没有该平台行」与「有行但 status≠latest」
// ---------------------------------------------------------------------------

test('admin 诊断:空列表 ⇒ rowCount=0(无行,该 INSERT)', async () => {
  const r = await probeAdminList({
    token: 't',
    fetchImpl: async () => fakeResponse({ json: { code: 0, data: { list: [] } } }),
  })
  assert.equal(r.state, 'present')
  assert.equal(r.rowCount, 0)
  assert.match(r.detail, /0/)
})

test('admin 诊断:有行但全是 history ⇒ 给出 status 分布(有行,该 UPDATE)', async () => {
  const r = await probeAdminList({
    token: 't',
    fetchImpl: async () =>
      fakeResponse({
        json: {
          code: 0,
          data: { list: [{ version: '0.0.9', buildNumber: 26102816, status: 'history' }] },
        },
      }),
  })
  assert.equal(r.state, 'present')
  assert.equal(r.rowCount, 1)
  assert.equal(r.statusDist.history, 1)
  assert.match(r.detail, /行数 1/)
})

test('admin 诊断:无令牌 / 401 ⇒ undetermined 并点名原因(不得冒充"无行")', async () => {
  const noTok = await probeAdminList({})
  assert.equal(noTok.state, 'undetermined')
  assert.match(noTok.detail, /admin-token/)
  const rejected = await probeAdminList({
    token: 'x',
    fetchImpl: async () => fakeResponse({ status: 401, json: { code: 401 } }),
  })
  assert.equal(rejected.state, 'undetermined')
  assert.match(rejected.detail, /401/)
})

// ---------------------------------------------------------------------------
// ⑥ CLI 参数
// ---------------------------------------------------------------------------

test('parseArgs 默认与覆盖;未知参数抛错', () => {
  const a = parseArgs([])
  assert.equal(a.baseUrl, 'https://www.aizhs.top')
  assert.equal(a.platform, 'android')
  const b = parseArgs([
    '--base-url',
    'https://api.aizhs.top/',
    '--platform',
    'ios',
    '--admin-token',
    't',
    '--json',
  ])
  assert.equal(b.baseUrl, 'https://api.aizhs.top')
  assert.equal(b.platform, 'ios')
  assert.equal(b.adminToken, 't')
  assert.equal(b.json, true)
  assert.throws(() => parseArgs(['--nope']))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
