// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-14 镜像测试:scripts/register-app-version-latest.mjs 的幂等决策与两腿执行。
 * 判据直接 import 源文件;DB 腿用内存 fake(记录 SQL 序列)证明"跑两次第二次不写"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULTS,
  buildPlan,
  validateDesired,
  parseArgs,
  applyViaApi,
  applyViaDb,
  fetchAllRowsViaApi,
} from '../register-app-version-latest.mjs'

const DESIRED = { version: '0.0.9', buildNumber: 26102816, downloadUrl: DEFAULTS.downloadUrl }

function row(over = {}) {
  return {
    id: over.id ?? 'row-1',
    version: over.version ?? '0.0.9',
    platform: 'android',
    buildNumber: over.buildNumber ?? 26102816,
    downloadUrl: over.downloadUrl ?? DEFAULTS.downloadUrl,
    status: over.status ?? 'latest',
  }
}

// ---------------------------------------------------------------------------
// ① 纯决策三态
// ---------------------------------------------------------------------------

test('默认值来自线上 apk 实测(文件名/响应头),不是票面文字', () => {
  assert.equal(DEFAULTS.version, '0.0.9')
  assert.equal(DEFAULTS.buildNumber, 26102816)
  assert.equal(
    DEFAULTS.downloadUrl,
    'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk',
  )
  assert.equal(DEFAULTS.platform, 'android')
})

test('create:表内无该 version 行(线上空 data 的现状)', () => {
  const p = buildPlan([], DESIRED)
  assert.equal(p.action, 'create')
  assert.deepEqual(p.demoteIds, [])
})

test('create:有其它版本的 latest ⇒ 同时降级', () => {
  const p = buildPlan([row({ id: 'old', version: '0.0.8', buildNumber: 26102800 })], DESIRED)
  assert.equal(p.action, 'create')
  assert.deepEqual(p.demoteIds, ['old'])
})

test('noop:唯一 latest 且 version/build/downloadUrl 全等(幂等的第二次运行)', () => {
  const p = buildPlan([row()], DESIRED)
  assert.equal(p.action, 'noop')
  assert.equal(p.targetId, 'row-1')
})

test('update:同 version 行存在但状态是 history', () => {
  const p = buildPlan([row({ status: 'history' })], DESIRED)
  assert.equal(p.action, 'update')
  assert.equal(p.targetId, 'row-1')
})

test('update:latest 在位但 downloadUrl 是旧的第三方地址', () => {
  const p = buildPlan([row({ downloadUrl: 'https://example.com/a.apk' })], DESIRED)
  assert.equal(p.action, 'update')
  assert.match(p.reason, /url/)
})

test('update:latest 在位但 buildNumber 不符', () => {
  const p = buildPlan([row({ buildNumber: 1 })], DESIRED)
  assert.equal(p.action, 'update')
})

test('update:同平台两条 latest(数据腐烂)⇒ 收敛成一条并降级另一条', () => {
  const p = buildPlan([row({ id: 'a' }), row({ id: 'b' })], DESIRED)
  assert.equal(p.action, 'update')
  assert.deepEqual(p.demoteIds, ['b'])
  assert.match(p.reason, /latest 有 2 条|腐烂/)
})

test('update:同 version 两行(不同构建号)⇒ 选 buildNumber 大的一条', () => {
  const p = buildPlan(
    [
      row({ id: 'a', buildNumber: 26102816, status: 'history' }),
      row({ id: 'b', buildNumber: 26102817, status: 'latest' }),
    ],
    DESIRED,
  )
  assert.equal(p.action, 'update')
  assert.equal(p.targetId, 'b')
})

// ---------------------------------------------------------------------------
// ② 参数校验
// ---------------------------------------------------------------------------

test('validateDesired:合法默认值零红;非 https / 非自有域 / 坏 semver 各红', () => {
  assert.deepEqual(validateDesired({ platform: 'android', ...DESIRED }), [])
  assert.ok(
    validateDesired({ platform: 'android', ...DESIRED, downloadUrl: 'http://www.aizhs.top/a.apk' })
      .length > 0,
  )
  assert.ok(
    validateDesired({ platform: 'android', ...DESIRED, downloadUrl: 'https://evil.example/a.apk' })
      .length > 0,
  )
  assert.ok(validateDesired({ platform: 'android', ...DESIRED, version: '0.0' }).length > 0)
  assert.ok(validateDesired({ platform: 'android', ...DESIRED, buildNumber: 0 }).length > 0)
})

test('parseArgs:两腿凭据来自环境变量,缺省指向线上站点', () => {
  const a = parseArgs([], { IHUI_ADMIN_TOKEN: 'jwt-x', DATABASE_URL: 'postgres://dev' })
  assert.equal(a.via, 'api')
  assert.equal(a.token, 'jwt-x')
  assert.equal(a.dbUrl, 'postgres://dev')
  assert.equal(a.apply, false, '默认必须是 dry-run')
  const b = parseArgs(['--via', 'db', '--apply', '--build-number', '42'], {})
  assert.equal(b.via, 'db')
  assert.equal(b.apply, true)
  assert.equal(b.buildNumber, 42)
})

// ---------------------------------------------------------------------------
// ③ A 腿:admin 端点(注入 fetch)
// ---------------------------------------------------------------------------

function jsonRes(status, body) {
  return {
    status,
    body,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    body_: null,
  }
}

test('A 腿 dry-run:只拉列表、不写、不隐藏计划', async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url}`)
    if (url.includes('/api/app-version?platform='))
      return jsonRes(200, { code: 0, data: { list: [], page: 1, pageSize: 100 } })
    throw new Error(`不该发出的请求: ${url}`)
  }
  const r = await applyViaApi({
    baseUrl: DEFAULTS.baseUrl,
    platform: 'android',
    ...DESIRED,
    token: 't',
    apply: false,
    fetchImpl,
  })
  assert.equal(r.plan.action, 'create')
  assert.equal(r.wrote, false)
  assert.equal(calls.length, 1, 'dry-run 只能有列表 GET')
})

test('A 腿 create:POST 后重读 /latest 自证;写后不一致必须抛错(不报成功)', async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    const m = init.method ?? 'GET'
    calls.push(`${m} ${url}`)
    if (url.includes('/api/app-version?platform='))
      return jsonRes(200, { code: 0, data: { list: [] } })
    if (m === 'POST') return jsonRes(201, { code: 0, data: { version: { id: 'new' } } })
    if (url.includes('/latest?platform='))
      return jsonRes(200, {
        code: 0,
        data: {
          latest: {
            version: '0.0.8',
            buildNumber: 1,
            status: 'latest',
            downloadUrl: DESIRED.downloadUrl,
          },
        },
      })
    throw new Error(`未编排: ${m} ${url}`)
  }
  await assert.rejects(
    () =>
      applyViaApi({
        baseUrl: DEFAULTS.baseUrl,
        platform: 'android',
        ...DESIRED,
        token: 't',
        apply: true,
        fetchImpl,
      }),
    /不符/,
  )
  assert.ok(calls.includes('POST https://www.aizhs.top/api/app-version'))
})

test('A 腿 create 成功后自证通过', async () => {
  const fetchImpl = async (url, init = {}) => {
    const m = init.method ?? 'GET'
    if (url.includes('/api/app-version?platform='))
      return jsonRes(200, { code: 0, data: { list: [] } })
    if (m === 'POST') return jsonRes(201, { code: 0, data: { version: { id: 'new' } } })
    if (url.includes('/latest?platform='))
      return jsonRes(200, {
        code: 0,
        data: {
          latest: {
            version: '0.0.9',
            buildNumber: 26102816,
            status: 'latest',
            downloadUrl: DESIRED.downloadUrl,
          },
        },
      })
    throw new Error(`未编排: ${m} ${url}`)
  }
  const r = await applyViaApi({
    baseUrl: DEFAULTS.baseUrl,
    platform: 'android',
    ...DESIRED,
    token: 't',
    apply: true,
    fetchImpl,
  })
  assert.equal(r.wrote, true)
})

test('A 腿 401/403 ⇒ 抛错并点名令牌(不静默当"无行")', async () => {
  const fetchImpl = async () => jsonRes(401, { code: 401, message: 'Authentication required' })
  await assert.rejects(
    () =>
      fetchAllRowsViaApi({
        baseUrl: DEFAULTS.baseUrl,
        platform: 'android',
        token: 'bad',
        fetchImpl,
      }),
    /令牌被拒/,
  )
})

// ---------------------------------------------------------------------------
// ④ B 腿:直连库(内存 fake,验证幂等 + 单事务顺序)
// ---------------------------------------------------------------------------

function makeFakeDb(initial) {
  const state = initial.map((r) => ({ ...r }))
  const log = []
  const exec = async (q, ...vals) => {
    const s = q.join('?').replace(/\s+/g, ' ').trim()
    log.push(s)
    if (s.startsWith('select id')) {
      return state.map((r) => ({
        id: r.id,
        version: r.version,
        build_number: r.buildNumber,
        status: r.status,
        download_url: r.downloadUrl,
      }))
    }
    if (s.startsWith('select version')) {
      return state
        .filter((r) => r.status === 'latest')
        .map((r) => ({
          version: r.version,
          build_number: r.buildNumber,
          status: r.status,
          download_url: r.downloadUrl,
        }))
    }
    if (s.startsWith('update') && s.includes('id <>')) {
      const target = vals[1]
      for (const r of state) if (r.status === 'latest' && r.id !== target) r.status = 'history'
      return []
    }
    if (s.startsWith('update') && s.includes('build_number = ?')) {
      const [bn, url, id] = vals
      const r = state.find((x) => x.id === id)
      if (!r) throw new Error(`fake: 找不到 ${id}`)
      r.buildNumber = bn
      r.downloadUrl = url
      r.status = 'latest'
      return []
    }
    if (s.startsWith('update')) {
      for (const r of state) if (r.status === 'latest') r.status = 'history'
      return []
    }
    if (s.startsWith('insert')) {
      const [v, , bn, url] = vals
      state.push({
        id: `n${state.length}`,
        version: v,
        buildNumber: bn,
        downloadUrl: url,
        status: 'latest',
      })
      return []
    }
    throw new Error(`fake 未实现: ${s}`)
  }
  const sql = (q, ...v) => exec(q, ...v)
  sql.begin = async (fn) => fn((q, ...v) => exec(q, ...v))
  return { sql, state, log }
}

test('B 腿 create:空表 ⇒ 单事务 INSERT,写后 latest 恰好 1 条', async () => {
  const { sql, state } = makeFakeDb([])
  const r = await applyViaDb({ sql, platform: 'android', ...DESIRED, apply: true })
  assert.equal(r.plan.action, 'create')
  assert.equal(state.length, 1)
  assert.equal(state[0].status, 'latest')
})

test('B 腿幂等:同一输入跑两次,第二次 noop 且没有多余 SQL', async () => {
  const { sql, state, log } = makeFakeDb([])
  await applyViaDb({ sql, platform: 'android', ...DESIRED, apply: true })
  const firstLen = log.length
  const r2 = await applyViaDb({ sql, platform: 'android', ...DESIRED, apply: true })
  assert.equal(r2.plan.action, 'noop')
  assert.equal(r2.wrote, false)
  assert.equal(log.length, firstLen + 1, '第二次只该读一次(select),不得再写')
  assert.equal(state.filter((x) => x.status === 'latest').length, 1)
})

test('B 腿 update:旧 latest 在位时先降级其它 latest 再升格,最终只有 1 条 latest', async () => {
  const { sql, state } = makeFakeDb([
    {
      id: 'old',
      version: '0.0.8',
      buildNumber: 26102800,
      status: 'latest',
      downloadUrl: 'https://www.aizhs.top/remote-images/download/ihui-ai-0.0.8-26102800.apk',
    },
    { id: 'cur', version: '0.0.9', buildNumber: 26102816, status: 'history', downloadUrl: null },
  ])
  const r = await applyViaDb({ sql, platform: 'android', ...DESIRED, apply: true })
  assert.equal(r.plan.action, 'update')
  assert.equal(state.filter((x) => x.status === 'latest').length, 1)
  assert.equal(state.find((x) => x.status === 'latest').id, 'cur')
  assert.equal(state.find((x) => x.id === 'old').status, 'history')
})

test('B 腿 dry-run:不写库', async () => {
  const { sql, state, log } = makeFakeDb([])
  const r = await applyViaDb({ sql, platform: 'android', ...DESIRED, apply: false })
  assert.equal(r.wrote, false)
  assert.equal(state.length, 0)
  assert.equal(log.filter((s) => s.startsWith('insert')).length, 0)
})

test('B 腿写后行数≠1 必须抛错(重复 latest 不许当成功)', async () => {
  // 写后查回两条 latest:模拟"收敛没做干净",必须抛错而不是报成功
  const lying = async (q, ..._v) => {
    const s = q.join('?').replace(/\s+/g, ' ').trim()
    if (s.startsWith('select version')) {
      const one = {
        version: '0.0.9',
        build_number: 26102816,
        status: 'latest',
        download_url: DESIRED.downloadUrl,
      }
      return [one, { ...one }]
    }
    if (s.startsWith('select id')) return []
    return []
  }
  lying.begin = async (fn) => fn(lying)
  await assert.rejects(
    () => applyViaDb({ sql: lying, platform: 'android', ...DESIRED, apply: true }),
    /行数为 2/,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
