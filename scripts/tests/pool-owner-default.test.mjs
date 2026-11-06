// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「机主导入的号默认跟他账号走」接线锁(2026-11-06 立)。
 *
 * 立因(2026-11-06 亲踩事故):`node scripts/relay-account-pool.mjs --from trae` 不带 `--owner`
 * ⇒ ownerUserId=null ⇒ 落运营池 ⇒ 对同 uid 的个人池行查不到 existing ⇒ 凭空多出一枚运营池
 * 重复行,直接违反机主 2026-10-31 永久指令「我自己填入号池的账号只能跟着我的账号走,
 * 别的用户不得看见、不得使用」。出路写在帮助文字里 = 把永久指令压在"人记得带旗标"上
 * (§0.8/§12f 禁止的形状);本票把它做成工具保证。
 *
 * 判据 import 自生产模块的 `__test__`(§22c),本文件不重写判定。
 * 测试隔离(§5):不连生产库(PG 8810/Redis 8811)、不写库、不起导入子进程 ——
 * 下游 `runImporter` 一律注入替身;`pool-owner` 文件走 scratch 夹具目录,绝不读真实家目录。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as PoolOwner } from '../lib/pool-owner.mjs'
import { __test__ as Cli } from '../relay-account-pool.mjs'

const OWNER_UUID = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'

/**
 * 造夹具:`home/.wb-switch/pool-owner` 写入 content(undefined = 不建文件),
 * 并在同目录放一枚账号 JSON 载荷(只给 --file 出口读字节,不校验 ⇒ 零凭据)。
 */
function mkHome(content) {
  const home = mkScratch('pool-owner-')
  if (content !== undefined) {
    // 目录只到 .wb-switch;文件名由单源出口给出(§0.6,测试不另拼一份路径)
    mkdirSync(dirname(PoolOwner.poolOwnerFilePath(home)), { recursive: true })
    writeFileSync(PoolOwner.poolOwnerFilePath(home), content, 'utf8')
  }
  const file = join(home, 'accounts.json')
  writeFileSync(file, JSON.stringify({ accounts: [] }), 'utf8')
  return { home, file }
}

/** 归属读取替身:仍走真判据(§0.6 不复制),只把解析基准换成夹具目录 */
const ownerResolverFor = (home) => () => PoolOwner.resolveDefaultPoolOwner({ home })

/** 跑一次编排器 main(下游导入注入替身,绝不真起子进程/真写库),回收 stdout 与裁决 */
async function runMain(argv, home) {
  const calls = []
  const lines = []
  const orig = process.stdout.write.bind(process.stdout)
  process.stdout.write = (chunk, enc, cb) => {
    lines.push(String(chunk))
    if (typeof enc === 'function') enc()
    else if (typeof cb === 'function') cb()
    return true
  }
  let exit = -1
  try {
    exit = await Cli.main(argv, {
      runImporter: async (payloadText, providerCode, options, decision) => {
        calls.push({ payloadText, providerCode, options, decision })
        return { code: 0, error: null }
      },
      resolveDefaultOwner: ownerResolverFor(home),
    })
  } finally {
    process.stdout.write = orig
  }
  return { exit, calls, stdout: lines.join('') }
}

test('① 无 --owner ∧ 取得到 pool-owner ⇒ 下游 owner = 文件里的 uuid(默认跟人走)', async () => {
  const { home, file } = mkHome(`${OWNER_UUID}\n`)
  try {
    const r = await runMain(['--file', file, '--provider', 'trae'], home)
    assert.equal(r.exit, 0)
    assert.equal(r.calls.length, 1, '必须走到下游导入出口(替身)')
    const d = r.calls[0].decision
    assert.equal(d.owner, OWNER_UUID, '默认归属必须等于 pool-owner 文件里的 users.id')
    assert.equal(d.source, 'default-owner-file')
    assert.match(r.stdout, /归属=个人池 30763d9f\*\*\*\(默认:取自 pool-owner\)/)
  } finally {
    rmScratch(home)
  }
})

test('② 显式 --owner 永远优先 ⇒ 用显式值,忽略文件', async () => {
  const { home, file } = mkHome(`${OWNER_UUID}\n`)
  const other = '11112222-3333-4444-5555-666677778888'
  try {
    const r = await runMain(['--file', file, '--provider', 'trae', '--owner', other], home)
    assert.equal(r.calls[0].decision.owner, other)
    assert.equal(r.calls[0].decision.source, 'explicit-flag')
    assert.match(r.stdout, /--owner 显式指定/)
  } finally {
    rmScratch(home)
  }
})

test('③ --ops-pool ⇒ 传 null 并忽略文件(确需运营池的显式出口)', async () => {
  const { home, file } = mkHome(`${OWNER_UUID}\n`)
  try {
    const r = await runMain(['--file', file, '--provider', 'trae', '--ops-pool'], home)
    assert.equal(r.calls[0].decision.owner, null)
    assert.equal(r.calls[0].decision.source, 'none')
    assert.match(r.stdout, /归属=运营池\(--ops-pool 显式指定\)/)
    const args = Cli.buildImporterArgs('trae', r.calls[0].options, r.calls[0].decision)
    assert.ok(!args.includes('--owner'), '--ops-pool 不得把默认归属偷偷带给下游')
  } finally {
    rmScratch(home)
  }
})

test('④ 文件不存在 ⇒ 落运营池,但 stdout 必须点名具名原因与出路(不静默)', async () => {
  const { home, file } = mkHome(undefined)
  try {
    const r = await runMain(['--file', file, '--provider', 'trae'], home)
    assert.equal(r.calls[0].decision.owner, null, '取不到 ⇒ 旧行为(运营池)')
    assert.equal(r.calls[0].decision.reason, 'missing')
    assert.match(r.stdout, /未取到个人池归属文件/, '必须有具名警告行')
    assert.match(r.stdout, /文件不存在/)
    assert.match(r.stdout, /⇒ 本次落运营池/)
    assert.match(r.stdout, /--owner <users\.id>/, '必须写明怎么显式指定')
  } finally {
    rmScratch(home)
  }
})

test('⑤ 文件为空 ⇒ 同 ④(具名原因=空),不得冒充个人池', async () => {
  const { home, file } = mkHome('   \n')
  try {
    const r = await runMain(['--file', file, '--provider', 'trae'], home)
    assert.equal(r.calls[0].decision.owner, null)
    assert.equal(r.calls[0].decision.reason, 'empty')
    assert.match(r.stdout, /未取到个人池归属文件/)
    assert.match(r.stdout, /文件为空/)
  } finally {
    rmScratch(home)
  }
})

test('⑥ 内容不是合法 uuid ⇒ 同 ④(具名原因=形状不合法)', async () => {
  const { home, file } = mkHome('不是-uuid-30763d9f\n')
  try {
    const r = await runMain(['--file', file, '--provider', 'trae'], home)
    assert.equal(r.calls[0].decision.owner, null)
    assert.equal(r.calls[0].decision.reason, 'invalid-format')
    assert.match(r.stdout, /未取到个人池归属文件/)
    assert.match(r.stdout, /不是合法 uuid/)
  } finally {
    rmScratch(home)
  }
})

test('⑦ --json 机器面透传:归属值脱敏,来源如实(explicit-flag|default-owner-file|none)', () => {
  const base = { dryRun: false, health: true, json: true }
  const fileArgs = Cli.buildImporterArgs('trae', base, {
    owner: OWNER_UUID,
    source: 'default-owner-file',
    reason: 'ok',
    file: '',
  })
  assert.deepEqual(fileArgs.slice(0, 2), ['--stdin', '--provider'])
  assert.ok(fileArgs.includes('--json'))
  assert.equal(fileArgs[fileArgs.indexOf('--owner') + 1], OWNER_UUID)
  assert.equal(fileArgs[fileArgs.indexOf('--owner-source') + 1], 'default-owner-file')
  const noneArgs = Cli.buildImporterArgs('trae', base, {
    owner: null,
    source: 'none',
    reason: 'missing',
    file: 'X',
  })
  assert.equal(noneArgs.includes('--owner'), false)
  assert.equal(noneArgs[noneArgs.indexOf('--owner-source') + 1], 'none')
})

test('⑧ 参数面:--owner 与 --ops-pool 互斥;--owner 不给值即未判定', () => {
  assert.match(
    Cli.parseArgs(['--file', 'a.json', '--owner', OWNER_UUID, '--ops-pool']).error ?? '',
    /只能二选一/,
  )
  assert.match(Cli.parseArgs(['--file', 'a.json', '--owner']).error ?? '', /需要 users\.id/)
  assert.equal(Cli.parseArgs(['--file', 'a.json', '--ops-pool']).error, null)
  assert.equal(Cli.parseArgs(['--file', 'a.json']).options.opsPool, false)
})

test('⑨ 单源不漂移:归属文件路径的读法只许 scripts/lib/pool-owner.mjs 一份(§0.6)', async () => {
  const fs = await import('node:fs')
  const cliText = fs.readFileSync(new URL('../relay-account-pool.mjs', import.meta.url), 'utf8')
  const syncText = fs.readFileSync(
    new URL('../../apps/api/scripts/relay-pool-snapshot-sync.ts', import.meta.url),
    'utf8',
  )
  // 入池方向必须从单源取默认归属,而不是自己再拼一次 .wb-switch/pool-owner
  assert.match(cliText, /from '\.\/lib\/pool-owner\.mjs'/)
  assert.doesNotMatch(cliText, /'\.wb-switch'/, 'CLI 不得自带第二份归属路径拼法')
  // 读取方向(号池 → 本机快照)必须委托同一枚单源
  assert.match(syncText, /pool-owner\.mjs/, '读侧必须委托单源,不得留在原地再写一份')
  assert.doesNotMatch(syncText, /join\(home, '\.wb-switch', 'pool-owner'\)/)
  // 词汇表也只有一份
  assert.deepEqual([...PoolOwner.OWNER_SOURCES].sort(), [
    'default-owner-file',
    'explicit-flag',
    'none',
  ])
})

test('⑩ 默认归属取到时必须回显来源;取不到时不得冒充个人池', () => {
  const got = Cli.ownerNoticeLine({
    owner: OWNER_UUID,
    source: 'default-owner-file',
    reason: 'ok',
    file: 'X',
  })
  assert.match(got, /归属=个人池 30763d9f\*\*\*/)
  assert.match(got, /默认:取自 pool-owner/)
  assert.ok(!got.includes(OWNER_UUID), '回显必须脱敏,不得整串 users.id 外显')
  const missed = Cli.ownerNoticeLine({
    owner: null,
    source: 'none',
    reason: 'unreadable',
    file: 'C:\\somewhere\\.wb-switch\\pool-owner',
  })
  assert.match(missed, /文件读不出来/)
  assert.ok(!missed.includes('归属=个人池'), '取不到 ⇒ 不得把结论说成个人池')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
