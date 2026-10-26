// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试 companion:判据层与库层的形状锁(§22c —— 一律 import 源实现,零复算)。
// 锁:⑤快照 SQL 别名带引号(含 description) ⑥provider 白名单读单源 ⑦仓内登记表自证干净
// ⑧–⑫ 同键归属三档:同键+本器出处⇒复用 / 同 provider 异 base_url⇒新增 / 同键无出处⇒breach。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { readSnapshot } from '../lib/relay-upstream-models-db.mjs'
import {
  PROVENANCE_MARK,
  __test__ as plan,
  describeAction,
  isOurs,
  parseRegistry,
  planRegistration,
  provenanceDescription,
  relayProviderCodes,
} from '../lib/relay-upstream-models-plan.mjs'
import { __test__ as cli, runMain } from '../relay-upstream-models-sync.mjs'

const CODES = relayProviderCodes(readFileSync(cli.PROVIDER_SOURCE, 'utf8'))
const REGISTRY = readFileSync(cli.REGISTRY_DEFAULT, 'utf8')

test('⑤ 形状锁:快照 SQL 的别名必须带引号(postgres-js 把裸别名整体转小写)', async () => {
  const c1 = []
  await readSnapshot(
    (strings) => {
      c1.push(strings.join('?'))
      return Promise.resolve([])
    },
    ['qoder', 'trae'],
  )
  assert.equal(c1.length, 1, '无配置行时不该发模型查询(空列表 ⇒ 少一次无谓往返)')
  assert.match(c1[0], /as "providerCode"/, '驼峰别名不加引号会被读成 undefined ⇒ 全表假红')
  assert.match(c1[0], /owner_uuid is null/, '只读全局行,别人的私配行不得进快照')
  assert.match(
    c1[0],
    /description/,
    '同键归属判据只认 description(本器出处标记)⇒ 快照必须把它读回来,否则每一行都被判成别人的',
  )
  const c2 = []
  await readSnapshot(
    (strings) => {
      const text = strings.join('?')
      c2.push(text)
      return Promise.resolve(text.includes('ai_model_config_models') ? [] : [{ id: '49' }])
    },
    ['qoder'],
  )
  assert.equal(c2.length, 2, '有配置行时必须接着查模型行')
  assert.match(c2[1], /is_relay_public as "isRelayPublic"/)
  assert.match(c2[1], /config_id = any\(/, '模型行按 config_id 收窄,不得全表扫')
})

test('⑥ provider 白名单读的是单源那一枚(不是测试里的副本)', () => {
  assert.ok(CODES?.includes('qoder') && CODES.includes('trae'), `实得:${(CODES ?? []).join('/')}`)
  assert.match(
    readFileSync(cli.PROVIDER_SOURCE, 'utf8'),
    /export const RELAY_PROVIDERS/,
    '读的是 apps/api 里那枚声明',
  )
  assert.equal(relayProviderCodes('const X = 1'), null, '解析不到 ⇒ null ⇒ 调用方落未判定')
})

test('⑦ 仓内登记表自证:真实登记表 + 真实白名单 ⇒ 零 problems 且每行都有交代', () => {
  const got = parseRegistry(REGISTRY, CODES)
  assert.deepEqual(got.problems, [], `登记表非法:${got.problems.join(' / ')}`)
  assert.ok(got.entries.length >= 1, '至少一枚登记意图')
  for (const e of got.entries) {
    assert.ok(e.reason.trim().length >= 10, `${e.providerCode} 缺 reason`)
    assert.equal(
      e.isRelayPublic,
      false,
      `${e.providerCode} 是账号池 provider,isRelayPublic 必须 false`,
    )
    assert.ok(
      e.models.every((m) => m.alias && m.upstreamModel),
      `${e.providerCode} 模型行缺 alias/upstreamModel`,
    )
  }
  assert.ok(
    !/\.(ts|mjs|tsx):\d+/.test(REGISTRY),
    '证据指针不得用行号(一次 append 就挪位)—— 用符号名/章节名锚',
  )
})

// ---- 同键归属三档(⑧⑨⑩⑫ 纯判据,⑪ 走 CLI 真跑 --check) ----
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
const cfg = (id, over = {}) => ({
  id,
  providerCode: 'qoder',
  baseUrl: BASE_URL,
  apiFormat: 'openai_chat',
  enabled: true,
  description: provenanceDescription('测试夹具'),
  ...over,
})
const snap = (configs = [], models = []) => ({ configs, models })

test('⑧ 同 provider 同 base_url 且带本器出处 ⇒ 复用并就地 update,不再 insert', () => {
  const ours = cfg(49, { enabled: false })
  assert.ok(isOurs(ours), '出处标记必须被认出来')
  const p = planRegistration([entry()], snap([ours], []))
  assert.deepEqual(p.breaches, [], '本器写的行不是 breach')
  assert.equal(
    p.actions.filter((a) => a.kind === 'insertConfig').length,
    0,
    '同键行已存在且是本器的 ⇒ 不得再插第二行(否则撞 uq_ai_model_config_global_provider_base)',
  )
  const uc = p.actions.find((a) => a.kind === 'updateConfig')
  assert.equal(uc.id, 49, '复用既有行 id,不是新建')
  assert.equal(uc.enabled, true)
  const im = p.actions.find((a) => a.kind === 'insertModel')
  assert.equal(im.configId, 49, '模型行挂到复用的配置行上')
})

test('⑨ 同 provider 不同 base_url ⇒ 键不同,仍按 insert(plan 层自己表达键,不靠库索引)', () => {
  const other = cfg(49, { baseUrl: 'https://openapi.qoder.com.cn/v1' })
  const p = planRegistration([entry()], snap([other], []))
  assert.deepEqual(p.breaches, [], '不同键是两行,不是抢同一行')
  assert.equal(p.actions.filter((a) => a.kind === 'updateConfig').length, 0, '另一端点行不得被改')
  const ic = p.actions.find((a) => a.kind === 'insertConfig')
  assert.equal(ic.baseUrl, BASE_URL, '新增行自带自己的 base_url')
  assert.match(describeAction(ic), /base_url=https:\/\/openapi\.qoder\.com\.cn /, '预览里键两维都在')
  assert.equal(
    planRegistration([entry()], snap([other, cfg(90)], [{ id: 91, configId: 90, modelId: 'qoder/auto', enabled: true, isRelayPublic: false }]))
      .actions.length,
    0,
    '两行各归各键后第二轮零动作 ⇒ 同键关系由 plan 层表达,不依赖库里有没有这条唯一索引',
  )
})

test('⑩ 同键行不带本器出处 ⇒ 既不复用也不改,breach 点名「两条路径抢同一行」', () => {
  const theirs = cfg(48, { description: '真号端到端联调登记(2026-10-23)' })
  const p = planRegistration([entry()], snap([theirs], []))
  assert.equal(p.actions.length, 0, '既不复用也不改 = 一条动作都不产')
  assert.equal(p.breaches.length, 1)
  assert.match(p.breaches[0], /两条路径抢同一行/)
  assert.match(p.breaches[0], /id=48/)
  assert.deepEqual(p.count, { missing: 0, matched: 0, drift: 0 }, 'breach 不冒充缺登记/漂移')
  assert.ok(!isOurs({ ...theirs, description: null }), '取不到 description ⇒ 不认领(不动别人行)')
})

test('⑪ --check 遇同键他人行 ⇒ 打 BREACH 点名 + exit 1,且一条也不落库', async () => {
  const logs = []
  const [oe, ol] = [console.error, console.log]
  const cap = (orig) => (s) => {
    logs.push(String(s))
    return orig(s)
  }
  console.error = cap(oe)
  console.log = cap(ol)
  const fakeSql = Object.assign(() => Promise.resolve([]), { end: async () => {} })
  let wrote = 0
  try {
    const theirs = {
      id: 48,
      providerCode: 'qoder',
      baseUrl: BASE_URL,
      apiFormat: 'openai_chat',
      enabled: true,
      description: '真号端到端联调登记(2026-10-23)',
    }
    const rc = await runMain(
      [
        '--check',
        '--dsn',
        'postgresql://u:p@127.0.0.1:5432/ihui',
        '--registry',
        cli.REGISTRY_DEFAULT,
        '--env-file',
        cli.REGISTRY_DEFAULT,
      ],
      {},
      {
        openDevClient: async () => ({ ok: true, postgres: () => fakeSql }),
        readSnapshot: async () => snap([theirs], []),
        applyActions: async () => {
          wrote++
          return []
        },
      },
    )
    assert.equal(rc, 1, 'breach 是判得出的冲突 ⇒ exit 1(不是未判定的 2)')
    assert.ok(
      logs.some((l) => l.includes('BREACH') && l.includes('两条路径抢同一行')),
      `输出必须点名,实得:${logs.join('|').slice(0, 200)}`,
    )
    assert.equal(wrote, 0, 'breach 档一条也不落库')
  } finally {
    console.error = oe
    console.log = ol
  }
})

test('⑫ 出处字面量单一真相源:库层只 import plan 层,不再自拼一份', () => {
  const dbSrc = readFileSync(new URL('../lib/relay-upstream-models-db.mjs', import.meta.url), 'utf8')
  assert.match(dbSrc, /provenanceDescription/, '写侧必须用 plan 层生成的出处')
  assert.ok(
    !dbSrc.includes(PROVENANCE_MARK),
    '库层不得再自拼出处字面量(两份必然漂移 ⇒ 读侧认不出自己写的行)',
  )
  assert.equal(typeof plan.PROVENANCE_MARK, 'string', '__test__ 形状锁:镜像测试不抄常量')
  assert.ok(provenanceDescription('x').includes(PROVENANCE_MARK))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
