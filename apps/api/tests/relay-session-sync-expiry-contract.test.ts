// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「rt 自然终点」跨边界契约锁(2026-11-01 立)。
 *
 * 立因是量出来的静默丢数据,不是预防性设计:提取器 `toPoolAccount` 的账号侧真键名是
 * `refreshTokenExpiresAt`,而 Trae 回灌 wrapper 转发的却是 `a.refreshExpiresAt`(该键在账号对象上
 * 从来不存在)⇒ 本机 storage 明明写着 rt 到期 2027-04-29,库里 `refresh_expires_at` 却恒 NULL,
 * 而所有门照绿。同一条链上键名一旦由生产端与消费端各写一份,唯一的失效表现就是安静少数据。
 *
 * 本锁把 生产端(真函数)→ wrapper(真函数)→ 腿侧单源读取器 整条跑一遍:任何一环改名或漏转发
 * 都在这里翻红,而不是让库里那一列继续静默为 NULL。不连库、不打上游、不留凭据(夹具 token 是 't')。
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

import { __test__ as traeLeg } from '../scripts/relay-trae-session-sync.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')

const loadModule = async (rel: string): Promise<Record<string, unknown>> =>
  import(/* @vite-ignore */ pathToFileURL(resolve(REPO, rel)).href)

let producers: {
  buildTraePayload: (extracted: unknown) => { accounts: Record<string, unknown>[] }
  buildQoderPayload: (sessions: unknown, meta: unknown) => { accounts: Record<string, unknown>[] }
  toPoolAccount: (userInfo: Record<string, unknown>) => unknown
} | null = null

async function P() {
  if (producers) return producers
  const [traeWrapper, qoderWrapper, extractLib] = await Promise.all([
    loadModule('scripts/sync-trae-client-session.mjs'),
    loadModule('scripts/sync-qoder-client-session.mjs'),
    loadModule('scripts/lib/trae-auth-extract.mjs'),
  ])
  producers = {
    buildTraePayload: traeWrapper.buildPayload as never,
    buildQoderPayload: qoderWrapper.buildPayload as never,
    toPoolAccount: extractLib.toPoolAccount as never,
  }
  return producers
}

const readRaw = traeLeg.clientRefreshExpiryRaw
const KEYS = traeLeg.CLIENT_REFRESH_EXPIRY_KEYS

test('① 正向链:提取器真产出 → wrapper → 腿侧单源读取器,值必须原样到达', async () => {
  const { buildTraePayload, toPoolAccount } = await P()
  const extracted = toPoolAccount({
    userId: 'u1',
    token: 't',
    refreshToken: 'rt',
    expiredAt: '2026-11-07T00:00:00.000Z',
    refreshExpiredAt: '2027-04-21T00:00:00.000Z',
  })
  const account = buildTraePayload(extracted).accounts[0]
  assert.equal(readRaw(account), '2027-04-21T00:00:00.000Z')
})

test('② 反向对照:提取器没给 rt 终点 ⇒ 读取器返回 null(①不得靠假值蒙过)', async () => {
  const { buildTraePayload, toPoolAccount } = await P()
  const extracted = toPoolAccount({ userId: 'u2', token: 't', refreshToken: 'rt' })
  const account = buildTraePayload(extracted).accounts[0]
  assert.equal(readRaw(account), null)
})

test('③ 单源键集:两种拼写都认,且规范拼写排在优先位', () => {
  assert.deepEqual(KEYS, ['refreshTokenExpiresAt', 'refreshExpiresAt'])
  assert.equal(
    readRaw({ refreshExpiresAt: '2027-01-01T00:00:00.000Z' }),
    '2027-01-01T00:00:00.000Z',
  )
  assert.equal(
    readRaw({ refreshTokenExpiresAt: 'A', refreshExpiresAt: 'B' }),
    'A',
    '两种拼写同时在场时规范拼写必须赢 —— 否则「键名单源」只是句口号',
  )
  // 空串/非字符串不是证据,不得被当成时刻
  assert.equal(readRaw({ refreshTokenExpiresAt: '  ', refreshExpiresAt: 123 }), null)
})

test('④ qoder 生产端同链:wrapper 出口必须是规范拼写', async () => {
  const { buildQoderPayload } = await P()
  const payload = buildQoderPayload(
    [
      {
        uid: 'q1',
        accessToken: 't',
        refreshToken: 'rt',
        expiresAt: '2026-12-01T00:00:00.000Z',
        refreshTokenExpiresAt: '2027-05-01T00:00:00.000Z',
      },
    ],
    {},
  )
  assert.equal(readRaw(payload.accounts[0]), '2027-05-01T00:00:00.000Z')
})

test('⑤ 消费端纪律:三条腿不得再绕过单源读取器自己认键名', () => {
  const legs = [
    'relay-trae-session-sync.ts',
    'relay-qoder-session-sync.ts',
    'relay-minimax-session-sync.ts',
  ]
  const RAW_READ = /acc\.(?:refreshTokenExpiresAt|refreshExpiresAt)\b/g
  for (const file of legs) {
    const src = readFileSync(resolve(HERE, '../scripts', file), 'utf8')
    const raw = src.match(RAW_READ)?.length ?? 0
    assert.equal(raw, 0, `${file} 里有 ${raw} 处按字面键名直读 rt 终点 ⇒ 键名一改就又静默`)
    assert.match(src, /clientRefreshExpiryRaw\(/, `${file} 必须经单源读取器取 rt 终点`)
  }
})

test('⑥ 回填判据:只在票面一致时把未知填成已知,绝不把已知改回未知', () => {
  const { expiryBackfillOf } = traeLeg
  const known = new Date('2027-04-21T00:00:00.000Z')
  const older = new Date('2026-12-01T00:00:00.000Z')
  assert.deepEqual(
    expiryBackfillOf({
      ticketIdentical: true,
      poolTokenExpiresAt: known,
      poolRefreshExpiresAt: null,
      clientExpiresAt: older,
      clientRefreshExpiresAt: known,
    }),
    { refreshExpiresAt: known },
  )
  assert.deepEqual(
    expiryBackfillOf({
      ticketIdentical: true,
      poolTokenExpiresAt: known,
      poolRefreshExpiresAt: known,
      clientExpiresAt: older,
      clientRefreshExpiresAt: older,
    }),
    {},
    '两列都已知 ⇒ 本轮什么都不补(调用方据此不写库、不推 updatedAt)',
  )
  assert.deepEqual(
    expiryBackfillOf({
      ticketIdentical: true,
      poolTokenExpiresAt: null,
      poolRefreshExpiresAt: null,
      clientExpiresAt: null,
      clientRefreshExpiresAt: null,
    }),
    {},
    '客户端也没证据 ⇒ 不补(拿 null 去"覆盖"未知是白写一轮)',
  )
  // 票面不一致(池刚轮转、客户端还持旧票)⇒ 旧票的到期时刻描述的不是池里这枚 rt,一行都不补。
  // 这一条是真接管实测逼出来的:2026-11-01 池刷成功后 rt 终点按契约写回未知,
  // 若不问票面就把 storage 里旧快照的 2027-04-29 填上去,管理面读到的是一枚已死 rt 的未来。
  assert.deepEqual(
    expiryBackfillOf({
      ticketIdentical: false,
      poolTokenExpiresAt: known,
      poolRefreshExpiresAt: null,
      clientExpiresAt: older,
      clientRefreshExpiresAt: known,
    }),
    {},
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
