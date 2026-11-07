// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机会话自动入池的归属锁(2026-11-06 立)。
 *
 * 立因:回灌腿的 auto-import 支路此前硬写 `importAccounts(provider, [autoInput], null)`
 * ⇒ 本机新登录的号恒落运营池;机主再手动 `--owner` 导入同一枚 ⇒ 两条 partial unique
 * 各自成立 ⇒ 同 uid 双行,而 chooseSyncTargetRow 运营池优先 ⇒ 个人池那行永远拿不到
 * 客户端新票。2026-11-06 亲踩,且该支路**零测试覆盖**(缺陷因此存活 7 天无人喊)。
 *
 * 三型牙:
 *  ① 纯函数:归属解析按注入的 fs 替身判(判据 import 源脚本 __test__,本层零复算 §22c);
 *  ② 措辞:运营池档必须自带"为什么"(§0.3 不静默 / §0.10 失效方向是多要一次说明);
 *  ③ 形状锁:两条本人号腿不得再出现硬 null,且必须把 owner 传给落库出口;
 *     minimax 那腿**保留** null 但必须带"刻意"注释(防下一个人当漏网补错)。
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  __test__ as ownerTest,
  describeAutoImportOwner,
  resolveAutoImportOwner,
} from '../scripts/relay-session-autoimport-owner.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const TRAE_SRC = readFileSync(resolve(HERE, '../scripts/relay-trae-session-sync.ts'), 'utf8')
const QODER_SRC = readFileSync(resolve(HERE, '../scripts/relay-qoder-session-sync.ts'), 'utf8')
const MINIMAX_SRC = readFileSync(resolve(HERE, '../scripts/relay-minimax-session-sync.ts'), 'utf8')

const UUID = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'

/** 只给 readFileSync 一枚替身:工具层只需要这一个动作 */
function fakeFs(text: string | Error) {
  return {
    readFileSync() {
      if (text instanceof Error) throw text
      return text
    },
  }
}

test('① 配置里有归属 ⇒ 个人池 + 来源具名', () => {
  const d = resolveAutoImportOwner({ home: 'H', fsImpl: fakeFs(`${UUID}\n`) })
  assert.equal(d.ownerUserId, UUID)
  assert.equal(d.source, 'default-owner-file')
  assert.equal(d.reason, 'ok', `取到归属时档位必须是工具层的 'ok'(措辞单源,不在本层洗成空串)`)
})

test('② 配置文件不存在 ⇒ 运营池但原因必须带回(不静默))', () => {
  const err = Object.assign(new Error('nope'), { code: 'ENOENT' })
  const d = resolveAutoImportOwner({ home: 'H', fsImpl: fakeFs(err) })
  assert.equal(d.ownerUserId, null)
  assert.equal(d.source, 'none')
  assert.equal(d.reason, 'missing')
})

test('③ 内容不是合法 uuid ⇒ 运营池 + invalid-format(不把脏值当归属用)', () => {
  const d = resolveAutoImportOwner({ home: 'H', fsImpl: fakeFs('ops-pool\n') })
  assert.equal(d.ownerUserId, null)
  assert.equal(d.reason, 'invalid-format')
})

test('④ 措辞单源:个人池只露前 8 位,运营池必须自带原因', () => {
  assert.match(
    describeAutoImportOwner({
      ownerUserId: UUID,
      source: 'default-owner-file',
      reason: '',
      file: 'f',
    }),
    /^个人池 30763d9f\*\*\*\(来源:default-owner-file\)$/,
  )
  const ops = describeAutoImportOwner({
    ownerUserId: null,
    source: 'none',
    reason: 'missing',
    file: 'f',
  })
  assert.match(ops, /运营池/)
  assert.match(ops, /missing/, `运营池档必须把"为什么"写进回显: ${ops}`)
})

test('⑤ 出口模块真装载上了工具层单源(装载失败会抛,不许悄悄落运营池)', () => {
  assert.ok(ownerTest.poolOwnerLib, 'scripts/lib/pool-owner.mjs 未装载 ⇒ 归属判据根本没接上')
})

test('⑥ 形状锁:两条本人号腿的 auto-import 不再硬写 null,而是传解析出的归属', () => {
  for (const [name, src, provider] of [
    ['trae', TRAE_SRC, 'trae'],
    ['qoder', QODER_SRC, 'qoder'],
  ] as const) {
    assert.doesNotMatch(
      src,
      new RegExp(`importAccounts\\('${provider}',\\s*\\[autoInput\\],\\s*null\\)`),
      `${name} 腿的 auto-import 又回到硬 null:同 uid 双行的根因会复发`,
    )
    assert.match(
      src,
      new RegExp(
        `importAccounts\\('${provider}',\\s*\\[autoInput\\],\\s*autoOwner\\.ownerUserId\\)`,
      ),
      `${name} 腿必须把 resolveAutoImportOwner 的结果交给落库出口`,
    )
    assert.match(src, /resolveAutoImportOwner\(\)/, `${name} 腿没接归属单源出口`)
  }
})

test('⑦ 形状锁:minimax 那腿保留运营池,但必须写明"刻意"而非漏网', () => {
  assert.match(
    MINIMAX_SRC,
    /importAccounts\('minimax',\s*\[autoInput\],\s*null\)/,
    'minimax 是槽位形态共享 key 池,不该被顺手接进个人池射程',
  )
  assert.match(MINIMAX_SRC, /刻意落运营池/, '保留 null 必须自带理由,否则下一个人会当漏网补错')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
