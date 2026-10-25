// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试 companion:判据层与库层的形状锁(§22c —— 一律 import 源实现,零复算)。
// 锁:⑤快照 SQL 别名带引号 ⑥provider 白名单读单源 ⑦仓内登记表自证干净。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { readSnapshot } from '../lib/relay-upstream-models-db.mjs'
import { parseRegistry, relayProviderCodes } from '../lib/relay-upstream-models-plan.mjs'
import { __test__ as cli } from '../relay-upstream-models-sync.mjs'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
