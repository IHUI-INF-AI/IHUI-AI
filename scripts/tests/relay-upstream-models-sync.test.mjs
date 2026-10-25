// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:号池上游登记器(AGENTS §22c —— 判据一律 import 源实现,零复算)。
// 锁:①登记表形状非法⇒未判定 ②幂等(同表两次⇒行数不变) ③只碰登记 provider ④取不到库⇒exit 2
// ⑤⑥⑦ 三把形状锁在同目录 companion relay-upstream-models-plan.test.mjs(单文件 <250 行)。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { applyActions } from '../lib/relay-upstream-models-db.mjs'
import {
  __test__ as plan,
  parseRegistry,
  planRegistration,
  relayProviderCodes,
  touchesOnlyRegistered,
} from '../lib/relay-upstream-models-plan.mjs'
import { __test__ as cli, runMain } from '../relay-upstream-models-sync.mjs'

const CODES = relayProviderCodes(readFileSync(cli.PROVIDER_SOURCE, 'utf8'))
const BASE_URL = 'https://openapi.qoder.com.cn'

const entry = (over = {}) => ({
  providerCode: 'qoder',
  configName: 'Qoder 账号池(反代)',
  baseUrl: BASE_URL,
  apiFormat: 'openai_chat',
  enabled: true,
  isRelayPublic: false,
  models: [{ alias: 'qoder/auto', upstreamModel: 'auto', displayName: 'Qoder Auto' }],
  reason: '号池 2 枚 healthy 号零调用,根因是反查无登记',
  reviewBy: '2099-12-31',
  ...over,
})
const cfg = (id, providerCode, over = {}) => ({
  id,
  providerCode,
  baseUrl: BASE_URL,
  apiFormat: 'openai_chat',
  enabled: true,
  ...over,
})
const mdl = (id, configId, modelId, over = {}) => ({
  id,
  configId,
  modelId,
  enabled: true,
  isRelayPublic: false,
  ...over,
})
const snap = (configs = [], models = []) => ({ configs, models })
// 替身事务执行器:记录 emit 的语句与参数,不连库(判据仍走源实现,测试零复算)
const fakeTx = (sink) => {
  const f = (strings, ...vals) => {
    sink.push({ text: strings.join('?'), vals: vals.map(String) })
    return Promise.resolve([{ id: 9001 }])
  }
  f.begin = (fn) => fn(f)
  return f
}

test('① 登记表形状非法 ⇒ problems 逐条点名(调用方据此落未判定,不落库)', () => {
  const cases = [
    entry({ providerCode: 'not_a_pool_provider' }),
    entry({ reason: '太短' }),
    entry({ reviewBy: '2099-13-01' }),
    entry({ reviewBy: '2020-01-01' }),
    entry({ models: [] }),
    entry({ isRelayPublic: 'false' }),
    entry({ models: [{ alias: 'qoder/auto' }] }),
    entry({
      models: [
        { alias: 'a', upstreamModel: 'x' },
        { alias: 'a', upstreamModel: 'y' },
      ],
    }),
  ]
  for (const e of cases) {
    const got = parseRegistry(`${JSON.stringify(e)}\n`, CODES)
    assert.equal(got.entries.length, 0, `非法行不该产出 entry:${JSON.stringify(e).slice(0, 80)}`)
    assert.equal(got.problems.length, 1, '必须点名一条,不合并成"参数错误"')
  }
  const noWl = parseRegistry(`${JSON.stringify(entry())}\n`, null)
  assert.match(noWl.problems[0], /白名单/, '白名单取不到 ⇒ 未判定,不回落硬编码清单')
  assert.match(
    parseRegistry('\n\n', CODES).problems[0],
    /为空/,
    '空表枚举到 0 个登记意图判死,不记绿',
  )
  assert.match(
    parseRegistry('{"providerCode":"qoder"\n', CODES).problems[0],
    /第 1 行/,
    '非法 JSON 点名行号',
  )
})

test('② 幂等:同一登记表跑两次 ⇒ 行数不变、第二轮零写动作', () => {
  const p1 = planRegistration([entry()], snap())
  assert.equal(p1.actions.length, 2, '首轮:配置行 + 模型行各一条写动作')
  const landed = snap([cfg(9001, 'qoder')], [mdl(9002, 9001, 'qoder/auto')])
  assert.equal(
    planRegistration([entry()], landed).actions.length,
    0,
    '二轮零动作(重复跑不产生第二行)',
  )
  assert.equal(planRegistration([entry()], landed).actions.length, 0, '三轮照旧零动作,不是侥幸')
  assert.equal(landed.configs.length + landed.models.length, 2, '落库后总行数仍是 2')
  assert.deepEqual(planRegistration([entry()], landed).count, { missing: 0, drift: 0, matched: 2 })
})

test('②b 漂移量得到:enabled / is_relay_public 与登记表不符 ⇒ drift + 回写动作', () => {
  const p = planRegistration(
    [entry()],
    snap(
      [cfg(9001, 'qoder', { apiFormat: 'anthropic_messages', enabled: false })],
      [mdl(9002, 9001, 'qoder/auto', { enabled: false, isRelayPublic: true })],
    ),
  )
  assert.deepEqual(p.count, { missing: 0, drift: 2, matched: 0 }, '配置行与模型行各判一次漂移')
  assert.equal(p.actions.find((a) => a.kind === 'updateConfig').apiFormat, 'openai_chat')
  const um = p.actions.find((a) => a.kind === 'updateModel')
  assert.equal(
    um.isRelayPublic,
    false,
    'is_relay_public=true 会把账号池冒充 OpenAI 兼容渠道,必须回写 false',
  )
})

test('③ 只碰登记 provider:他人行不出动作,emit 的 SQL 也碰不到它们', async () => {
  const foreign = cfg(555, 'deepseek', { baseUrl: 'https://api.deepseek.com/v1' })
  const foreignModel = mdl(777, 555, 'deepseek-chat', { isRelayPublic: true })
  const before = structuredClone({ foreign, foreignModel })
  const p = planRegistration([entry()], snap([foreign], [foreignModel]))
  assert.ok(touchesOnlyRegistered(p.actions, ['qoder']), '计划里不得出现非登记 provider')
  assert.ok(
    p.actions.every((a) => a.providerCode === 'qoder'),
    '每条动作都得自带 providerCode 且等于登记值',
  )
  assert.deepEqual({ foreign, foreignModel }, before, '非登记表内行逐字节不变')

  const ins = []
  await applyActions(fakeTx(ins), p.actions)
  assert.equal(ins.length, p.actions.length, '一条动作一条语句,不夹带')
  const foreignIds = ['555', '777']
  for (const e of ins) {
    assert.match(e.text, /provider_code|config_id/, '写语句必须带 provider 或 config 归属谓词')
    assert.ok(!e.vals.some((v) => foreignIds.includes(v)), `不得把他人行 id 送进写语句:${e.text}`)
  }
  // 反向对照:漂移档走 UPDATE —— 空集上的 every 不算证据,这里必须真有两条 UPDATE
  const upd = []
  const driftActions = planRegistration(
    [entry()],
    snap(
      [cfg(9001, 'qoder', { enabled: false })],
      [mdl(9002, 9001, 'qoder/auto', { enabled: false })],
    ),
  ).actions
  await applyActions(fakeTx(upd), driftActions)
  const updates = upd.filter((e) => /update ai_model_config/i.test(e.text))
  assert.equal(updates.length, 2, '两条漂移 ⇒ 两条 UPDATE')
  assert.ok(
    updates.every((e) => e.text.includes('provider_code=')),
    'UPDATE 把 provider 谓词写进 WHERE(结构上改不到别人)',
  )
  assert.ok(
    updates.every((e) => e.vals.includes('qoder')),
    'UPDATE 参数里的 provider 只能是登记值',
  )
  assert.ok(
    !updates.some((e) => e.vals.some((v) => foreignIds.includes(v))),
    'UPDATE 不得触及他人行',
  )
})

test('③b 大小写变体与同键多行 ⇒ 未判定(不自动改名、不猜写哪行)', () => {
  const p1 = planRegistration(
    [entry()],
    snap([cfg(9001, 'qoder')], [mdl(9002, 9001, 'QODER/AUTO')]),
  )
  assert.equal(p1.problems.length, 1, '仅大小写不同的 model_id 撞 lower 索引 ⇒ 点名')
  assert.match(p1.problems[0], /lower/)
  const p2 = planRegistration([entry()], snap([cfg(1, 'qoder'), cfg(2, 'qoder')]))
  assert.equal(p2.problems.length, 1, '同 (provider_code, base_url) 多行 ⇒ 无法判定该写哪行')
  assert.equal(p2.actions.length, 0, '判不出就一条都不写')
})

test('④ 取不到输入 ⇒ exit 2(未判定),既不记绿也不冒红', async () => {
  const logs = []
  const cap = (m) => (s) => {
    logs.push(String(s))
    return m
  }
  const [oe, ol] = [console.error, console.log]
  console.error = cap(oe)
  console.log = cap(ol)
  try {
    const cases = [
      [[], '没给档位旗标'],
      [['--check', '--registry', '/nope/none.jsonl'], '登记表取不到'],
      [
        ['--check', '--dsn', 'postgresql://u:pw@db.example.com:5432/ihui'],
        '非本机回环(生产库不得尝试)',
      ],
      [['--check', '--dsn', 'postgresql://u:9@127.0.0.1:1/ihui'], '回环端口无人应答'],
    ]
    for (const [argv, why] of cases) assert.equal(await runMain(argv, {}), 2, `${why} 必须 exit 2`)
    assert.ok(
      logs.some((l) => l.includes('未判定') || l.includes('用法')),
      `每支都得说清,实得:${logs.join('|').slice(0, 160)}`,
    )
    assert.ok(!logs.some((l) => /:9@|:pw@|alice:/.test(l)), '任何输出不得回显凭据')
  } finally {
    console.error = oe
    console.log = ol
  }
})

test('④b DSN 面只含 host:port/db;取法顺序 --dsn > .env > 进程环境', () => {
  assert.equal(plan.dsnFace('postgresql://alice:secr3t@localhost:5432/ihui'), 'localhost:5432/ihui')
  assert.equal(plan.dsnFace('postgresql://alice@127.0.0.1/db'), '127.0.0.1:5432/db')
  assert.equal(plan.dsnFace('not-a-dsn'), null, '不可解析 ⇒ null,不猜')
  assert.equal(
    plan.resolveDsn(['--dsn', 'A://x'], 'DATABASE_URL=B', { DATABASE_URL: 'C' }).dsn,
    'A://x',
  )
  assert.equal(
    plan.resolveDsn([], 'DATABASE_URL=B\nDATABASE_APP_URL=C', {}).dsn,
    'B',
    'DATABASE_URL 先于 APP_URL',
  )
  assert.equal(
    plan.resolveDsn([], 'DATABASE_APP_URL=C', { DATABASE_URL: 'D' }).dsn,
    'C',
    '文件优先于进程环境',
  )
  assert.match(
    plan.resolveDsn(['--dsn'], 'DATABASE_URL=B', {}).error,
    /--dsn 需要一个/,
    '给了旗标没给值 ⇒ 点名,不静默回落',
  )
  assert.match(plan.resolveDsn([], '', {}).error, /DSN 取不到/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
