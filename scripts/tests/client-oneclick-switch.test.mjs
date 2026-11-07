// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as oneclick } from '../client-oneclick-switch.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const {
  pickByOrdinal,
  askOrdinal,
  RETRY_LIMIT,
  fmtAccountRow,
  fmtCountRow,
  runPoolListJson,
  POOL_LIST_TS,
} = oneclick

function row(over = {}) {
  return {
    uid: 'u-1',
    name: '15699571035',
    healthStatus: 'healthy',
    isEnabled: true,
    tempUnschedulable: false,
    tokenExpiresAt: '2026-12-05T10:00:00.000Z',
    refreshExpiresAt: '2027-10-29T10:00:00.000Z',
    credVersion: 9,
    ownerUserId: '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35',
    deviceId: 'dev',
    lastRefreshAt: null,
    updatedAt: null,
    ...over,
  }
}

test('① 序号解析:只认 1..N 的整数,其余一律 null(不猜)', () => {
  assert.equal(pickByOrdinal('1', 3), 0)
  assert.equal(pickByOrdinal(' 3 ', 3), 2)
  assert.equal(pickByOrdinal('0', 3), null)
  assert.equal(pickByOrdinal('4', 3), null)
  assert.equal(pickByOrdinal('2.5', 3), null)
  assert.equal(pickByOrdinal('qoder', 3), null)
  assert.equal(pickByOrdinal('', 3), null)
  assert.equal(pickByOrdinal('1', 0), null)
})

test('①b 序号重问:空答复=取消、连错 3 次=业务失败(与非 TTY 的 rc=2 分档)', async () => {
  const asked = []
  const fakeRl = (answers) => ({
    question: async (p) => {
      asked.push(p)
      return answers.shift() ?? ''
    },
  })
  // 第一次打错、第二次命中 ⇒ 应当成功返回下标
  assert.deepEqual(await askOrdinal(fakeRl(['99', '2']), '选: ', 8), { idx: 1 })
  // 空答复 ⇒ 取消(不是失败)
  assert.deepEqual(await askOrdinal(fakeRl(['']), '选: ', 8), { cancel: true })
  // 连续 RETRY_LIMIT 次打错 ⇒ fail,且问的次数恰等于上限(不多问一次)
  asked.length = 0
  const bad = await askOrdinal(fakeRl(['x', 'y', 'z']), '选: ', 8)
  assert.deepEqual(bad, { fail: true })
  assert.equal(asked.length, RETRY_LIMIT)
  // 打错时必须把射程口径回给人看
  asked.length = 0
  const notes = []
  await askOrdinal(fakeRl(['99', '1']), '选: ', 8, (t) => notes.push(t))
  assert.match(notes.join(''), /只认 1-8/)
  // 射程漏传必须当场炸:静默放行任何序号比拒跑更坏
  await assert.rejects(() => askOrdinal(fakeRl(['99']), '选: '), /正整数射程/)
})

test('② 展示面:序号行只给脱敏投影,绝不出现令牌形态字段', () => {
  // 名单数据在出口侧已按单源掩码(--mask 档),这里断言的是"展示行不会把全号带出来"
  const line = fmtAccountRow(row({ name: '156****1035' }), 0)
  assert.match(line, /\[1\] 156\*\*\*\*1035/)
  // 负锁:哪天忘了传 --mask,这条先红 —— 11 位连续数字就是手机号全号
  assert.doesNotMatch(line, /1\d{10}/)
  assert.match(line, /健康=healthy/)
  assert.match(line, /token到期=2026-12-05/)
  assert.match(line, /归属=个人池/)
  assert.match(fmtAccountRow(row({ ownerUserId: null }), 1), /归属=运营池/)
  assert.match(fmtAccountRow(row({ tokenExpiresAt: null }), 1), /token到期=无到期/)
  assert.match(fmtAccountRow(row({ isEnabled: false, tempUnschedulable: true }), 1), /启用=否/)
  assert.match(fmtAccountRow(row({ isEnabled: false, tempUnschedulable: true }), 1), /摘除=是/)
  for (const forbidden of ['accessToken', 'tokenEnc', 'cookiesEnc', 'secretsEnc', 'Bearer']) {
    assert.ok(!line.includes(forbidden), `展示面不得出现 ${forbidden}`)
  }
  assert.match(
    fmtCountRow({ providerCode: 'qoder', total: 11, enabled: 11 }, 2),
    /\[3\] qoder  池内 11 行\(启用 11\)/,
  )
})

test('②b 取名单那一趟必须带 --mask(双击出来的是会被截图的窗口)', () => {
  const entry = fileURLToPath(new URL('../client-oneclick-switch.mjs', import.meta.url))
  const src = fs.readFileSync(entry, 'utf8').replace(/[⁠​‌‍]*/g, '')
  assert.match(src, /'--provider', platform, '--json', '--mask'/)
  // 首屏只有枚数没有名称 ⇒ 不需要掩码档,但必须标注取数时刻(两屏之间池可能被别席改)
  assert.match(src, /'--counts', '--json'/)
  assert.match(src, /取数时刻=/)
})

test('③ 列池管道:污染行照取、非零 exit 落未判定、JSON 解不开落未判定', () => {
  const dir = mkScratch('oneclick-pipe')
  try {
    // 假 tsx:argv[1] 是被转调脚本路径(这里不真跑它),按 FIXTURE_MODE 造三种输出
    const fake = path.join(dir, 'fake-tsx.mjs')
    fs.writeFileSync(
      fake,
      [
        "const mode = process.env.FIXTURE_MODE || 'ok'",
        "if (mode === 'ok') {",
        "  process.stdout.write('[db] 建连日志一行\\n')",
        "  process.stdout.write(JSON.stringify({ counts: [{ providerCode: 'qoder', total: 1, enabled: 1 }] }) + '\\n')",
        "  process.stdout.write('[db] 尾行\\n')",
        '  process.exit(0)',
        '}',
        "if (mode === 'garbage') { process.stdout.write('not json at all\\n'); process.exit(0) }",
        "process.stderr.write('connection refused\\n')",
        'process.exit(2)',
      ].join('\n'),
    )
    const ok = runPoolListJson(fake, ['--counts', '--json'])
    assert.equal(ok.error, undefined)
    assert.equal(ok.data.counts[0].providerCode, 'qoder')

    // 显式造非零 exit
    process.env.FIXTURE_MODE = 'die'
    const die = runPoolListJson(fake, ['--counts', '--json'])
    assert.match(die.error, /exit=2/)
    assert.match(die.error, /connection refused/)

    process.env.FIXTURE_MODE = 'garbage'
    const garbage = runPoolListJson(fake, ['--provider', 'qoder', '--json'])
    assert.match(garbage.error, /未判定/)
    delete process.env.FIXTURE_MODE

    // 被转调脚本不在位 ⇒ node 起来就报 Cannot find module(exit 1),仍落未判定不冒绿
    const missing = runPoolListJson(path.join(dir, 'no-such-tsx.mjs'), ['--counts'])
    assert.match(missing.error, /exit=1/)
    assert.equal(missing.data, undefined)
    assert.ok(
      POOL_LIST_TS.endsWith(path.join('apps', 'api', 'scripts', 'relay-pool-account-list.ts')),
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
