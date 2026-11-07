// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「一行一个 token」行文本入池通道的镜像测试(2026-11-06 立)。
 *
 * 钉七件事(对派单第 7 条逐条):
 *   ① 纯 token 行 ②「名称<TAB或空格>token」两段形态 ③ 空行与 # 注释行被忽略
 *   ④ 批内重复 token ⇒ 行号点名且**不折半**(落库口径的 duplicateUids 留给下游)
 *   ⑤ 空文件 / 全注释 / 读不到 ⇒ exit 2 未判定,一次下游都不派
 *   ⑥ 与 JSON 通路产出同构(同一批 token,两通道交给下游的 accounts 逐字段相等)
 *   ⑦ 默认归属仍走 scripts/lib/pool-owner.mjs 单源,--ops-pool 反旗照旧
 *
 * 判据 import 自生产模块的 `__test__`(§22c),本文件不重写判定、不复制脱敏算式。
 * 测试隔离(§5):不连生产库(PG 8810/Redis 8811)、不写库、不起导入子进程 ——
 * 下游 `runImporter` 注入替身;夹具走 mkScratch,token 一律合成假值,零真凭据。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as PoolOwner } from '../lib/pool-owner.mjs'
import { __test__ as T } from '../lib/relay-account-tokens-text.mjs'
import { __test__ as Cli } from '../relay-account-pool.mjs'

const OWNER_UUID = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'
/** 合成假 token(结构与真实 JWT 同形,内容全假;零凭据纪律:夹具里不许出现真票) */
const TOK_A = 'eyJhbGciOiJSUzI1NiJ9.SYNTHETIC-FAKE-PAYLOAD-A.sigA'
const TOK_B = 'eyJhbGciOiJSUzI1NiJ9.SYNTHETIC-FAKE-PAYLOAD-B.sigB'
const TOK_C = 'eyJhbGciOiJSUzI1NiJ9.SYNTHETIC-FAKE-PAYLOAD-C.sigC'

/** 在假家目录里摆一枚 pool-owner(路径拼法走单源出口,测试不另抄一份 §0.6) */
function writePoolOwner(home, content) {
  const file = PoolOwner.poolOwnerFilePath(home)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, content, 'utf8')
}

/** 夹具目录:写一行文本 + 一份同批的标准 JSON,并按需摆 pool-owner */
function mkFixtures({ tokensText, jsonAccounts, poolOwner }) {
  const home = mkScratch('relay-tokens-')
  if (poolOwner !== undefined) writePoolOwner(home, poolOwner)
  const file = join(home, 'tokens.txt')
  if (tokensText !== undefined) writeFileSync(file, tokensText, 'utf8')
  const jsonFile = join(home, 'accounts.json')
  if (jsonAccounts !== undefined)
    writeFileSync(jsonFile, JSON.stringify({ accounts: jsonAccounts }), 'utf8')
  return { home, file, jsonFile }
}

/**
 * 默认归属替身:走**真判据**(§22c 不复制判定),只把解析基准换成一枚必然不存在的家目录
 * ⇒ reason='missing'(§0.3 具名原因),个人池那一档留给 ⑦ 用真夹具单独钉。
 * 读一个不存在的路径 ⇒ ENOENT ⇒ 'missing',不建目录、不写盘、零泄漏。
 */
const NO_SUCH_HOME = '__relay_tokens_text_no_such_home__'
const ownerMiss = () => PoolOwner.resolveDefaultPoolOwner({ home: NO_SUCH_HOME })

/** 跑一次编排器 main:下游导入/默认归属/脱敏装载三面全注入替身,回收 stdout+stderr+裁决 */
async function runMain(
  argv,
  { calls = [], resolveDefaultOwner = ownerMiss } = {},
  maskPhoneFn = null,
) {
  const out = []
  const err = []
  const o = process.stdout.write.bind(process.stdout)
  const e = process.stderr.write.bind(process.stderr)
  process.stdout.write = (chunk, enc, cb) => {
    out.push(String(chunk))
    if (typeof enc === 'function') enc()
    else if (typeof cb === 'function') cb()
    return true
  }
  process.stderr.write = (chunk, enc, cb) => {
    err.push(String(chunk))
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
      resolveDefaultOwner,
      loadMaskPhone: async () => maskPhoneFn,
    })
  } finally {
    process.stdout.write = o
    process.stderr.write = e
  }
  return { exit, calls, stdout: out.join(''), stderr: err.join('') }
}

test('① 纯 token 行:一行一枚、顺序即序号、名称走可追溯指纹形', () => {
  const r = T.parseTokensLineText(`${TOK_A}\n${TOK_B}\n`)
  assert.equal(r.reason, 'ok')
  assert.equal(r.entries.length, 2)
  assert.deepEqual(
    r.entries.map((e) => [e.index, e.line, e.token, e.nameSource]),
    [
      [0, 1, TOK_A, 'auto'],
      [1, 2, TOK_B, 'auto'],
    ],
  )
  assert.deepEqual(
    r.entries.map((e) => e.name),
    [`token-${T.tokenFingerprint(TOK_A)}`, `token-${T.tokenFingerprint(TOK_B)}`],
  )
  assert.match(r.entries[0].name, /^token-[0-9a-f]{12}$/, '自动名必须是可追溯的指纹形')
  // 变异锁:指纹必须是哈希前缀,不得是明文截断(否则 stdout 一 echo 就漏票)
  assert.ok(!r.entries[0].name.includes('SYNTHETIC'))
  assert.equal(T.tokenFingerprint(TOK_A).length, T.FINGERPRINT_LENGTH)
  // --name-prefix 只改前缀,不改可追溯性
  const p = T.parseTokensLineText(`${TOK_A}\n`, { namePrefix: 'wb01' })
  assert.equal(p.entries[0].name, `wb01-token-${T.tokenFingerprint(TOK_A)}`)
})

test('②「名称 + token」两段形态:TAB 与空格同权,首段算名称其余算 token', () => {
  const r = T.parseTokensLineText(`豆包主号\t${TOK_A}\n备用号 ${TOK_B}\n`)
  assert.equal(r.entries.length, 2)
  assert.equal(r.entries[0].name, '豆包主号')
  assert.equal(r.entries[0].token, TOK_A)
  assert.equal(r.entries[0].nameSource, 'given')
  assert.equal(r.entries[1].name, '备用号')
  assert.equal(r.entries[1].token, TOK_B)
  assert.equal(r.duplicates.length, 0)
  // 名称本身含空格 ⇒ 切出来的 token 带空白:如实点名提示,但**不改判、不丢弃**(判定权在下游)
  const amb = T.parseTokensLineText(`张三 李四 ${TOK_C}\n`)
  assert.equal(amb.entries.length, 1)
  assert.equal(amb.entries[0].name, '张三')
  assert.equal(amb.notes.length, 1)
  assert.equal(amb.notes[0].code, 'two-part-form-ambiguous')
  assert.equal(amb.notes[0].line, 1)
})

test('③ 空行与 # 注释行被忽略;BOM 不吃进 token', () => {
  const r = T.parseTokensLineText(`﻿# 一行一个 token\n\n   \n${TOK_A}\n#尾注\n${TOK_B}\n`)
  assert.equal(r.reason, 'ok')
  assert.equal(r.entries.length, 2)
  assert.deepEqual(
    r.entries.map((e) => e.line),
    [4, 6],
    '序号↔行号映射必须指到真行号(忽略行也要占号)',
  )
  assert.equal(r.stats.comments, 2)
  assert.equal(r.stats.blank, 3, '文件结尾的换行也算一枚空白行 ⇒ 如实计数,不美化')
  assert.ok(!r.entries[0].token.includes('﻿'))
})

test('④ 批内同一 token 重复 ⇒ 行号逐组点名,一行都不折半', () => {
  const r = T.parseTokensLineText(`${TOK_A}\n${TOK_A}\n#注释\n${TOK_B}\n${TOK_A}\n`)
  assert.equal(r.entries.length, 4, '重复 token 必须原样留在批里(折半 = 抹掉"覆盖了哪一行")')
  assert.equal(r.duplicates.length, 1)
  assert.deepEqual(r.duplicates[0].lines, [1, 2, 5])
  assert.equal(r.duplicates[0].fingerprint, T.tokenFingerprint(TOK_A))
  const notice = T.renderDuplicateNotice(r.duplicates)
  assert.match(notice, /行 1,2,5/, '回显必须给出行号')
  assert.match(notice, /duplicateUids/, '必须把落库口径交给下游预检,不自己冒充结论')
  assert.ok(!notice.includes(TOK_A), '重复点名只给指纹,绝不回显 token 明文')
  // 无重复 ⇒ 一行提示都不产(空串,不是"0 组"的假话)
  assert.equal(T.renderDuplicateNotice([]), '')
})

test('⑤ 空文件 / 全注释 / 读不到 ⇒ exit 2 未判定并点名原因,一次下游都不派', async () => {
  const empty = mkFixtures({ tokensText: '\n\n   \n', poolOwner: undefined })
  try {
    const r = await runMain(['--tokens-file', empty.file, '--provider', 'workbuddy'])
    assert.equal(r.exit, 2)
    assert.match(r.stderr, /未判定/)
    assert.match(r.stderr, /没有任何内容行/)
    assert.equal(r.calls.length, 0, '没有可用 token ⇒ 绝不派下游,更不许报"导入 0 枚"')
  } finally {
    rmScratch(empty.home)
  }
  const comments = mkFixtures({ tokensText: '# 全是注释\n# 还是注释\n', poolOwner: undefined })
  try {
    const r = await runMain(['--tokens-file', comments.file, '--provider', 'workbuddy'])
    assert.equal(r.exit, 2)
    assert.match(r.stderr, /只有 # 注释行/)
    assert.match(r.stderr, /注释=2/)
    assert.equal(r.calls.length, 0)
  } finally {
    rmScratch(comments.home)
  }
  const missing = mkFixtures({ tokensText: undefined, poolOwner: undefined })
  try {
    const r = await runMain(['--tokens-file', join(missing.home, 'nope.txt'), '--provider', 'trae'])
    assert.equal(r.exit, 2)
    assert.match(r.stderr, /读取行文本失败\(未判定\)/)
    assert.equal(r.calls.length, 0)
  } finally {
    rmScratch(missing.home)
  }
  // 平台必须显式给(行文本没有顶层 providerCode 可回落)
  assert.match(
    Cli.parseArgs(['--tokens-file', 'a.txt']).error ?? '',
    /必须配 --provider/,
    '缺 --provider ⇒ 参数面未判定,不静默猜平台',
  )
  assert.match(
    Cli.parseArgs(['--tokens-file', 'a.txt', '--file', 'b.json']).error ?? '',
    /只能二选一/,
  )
  assert.match(Cli.parseArgs(['--from', 'trae', '--tokens-file', 'a.txt']).error ?? '', /二选一/)
  assert.equal(Cli.parseArgs(['--tokens-file', 'a.txt', '--provider', 'trae']).error, null)
})

test('⑥ 与 JSON 通路产出同构:同一批 token,两通道交给下游的 accounts 逐字段相等', async () => {
  const entries = T.parseTokensLineText(`${TOK_A}\n我的号\t${TOK_B}\n`).entries
  const jsonAccounts = entries.map((e) => ({ name: e.name, token: e.token, enabled: true }))
  const fx = mkFixtures({
    tokensText: `${TOK_A}\n我的号\t${TOK_B}\n`,
    jsonAccounts,
    poolOwner: undefined,
  })
  const calls = []
  // 解析/纪律类断言:注入一枚个人池(李总)归属,避免"首次强制落个人池"拒绝干扰本测试意图
  const deps = {
    calls,
    resolveDefaultOwner: () => ({
      owner: OWNER_UUID,
      source: 'default-owner-file',
      reason: 'ok',
      file: '',
    }),
  }
  try {
    const viaTokens = await runMain(
      ['--tokens-file', fx.file, '--provider', 'workbuddy'],
      deps,
      (s) => s,
    )
    assert.equal(viaTokens.exit, 0)
    const viaJson = await runMain(['--file', fx.jsonFile, '--provider', 'workbuddy'], deps)
    assert.equal(viaJson.exit, 0)
    assert.equal(calls.length, 2)
    assert.equal(viaTokens.calls[0].providerCode, 'workbuddy')
    assert.deepEqual(
      JSON.parse(calls[0].payloadText).accounts,
      JSON.parse(calls[1].payloadText).accounts,
      '行文本折叠产物必须与手写标准 JSON 逐字段相等 ⇒ 预检读数天然同源',
    )
    // 下游拿到的就是同一条 stdin 通路:两通道的旗标装配也必须同一枚出口
    assert.deepEqual(
      Cli.buildImporterArgs('workbuddy', viaTokens.calls[0].options, viaTokens.calls[0].decision),
      Cli.buildImporterArgs('workbuddy', viaJson.calls[0].options, viaJson.calls[0].decision),
    )
  } finally {
    rmScratch(fx.home)
  }
})

test('⑦ 默认归属仍走 pool-owner 单源;--ops-pool 反旗照旧(行文本入口不另立第 2 套)', async () => {
  const fx = mkFixtures({ tokensText: `${TOK_A}\n`, poolOwner: undefined })
  try {
    // 取不到个人池归属 ⇒ 首次强制落个人池,拒绝导入(exit 2);--ops-pool 反旗照旧(下方)
    const r = await runMain(['--tokens-file', fx.file, '--provider', 'workbuddy'])
    assert.equal(r.exit, 2, '取不到个人池归属 ⇒ 拒绝导入(exit 2)')
    assert.equal(r.calls.length, 0, '不得静默落运营池')
    assert.match(r.stdout, /未取到个人池归属文件/, '取不到默认归属必须点名,不静默')
    const ops = await runMain(['--tokens-file', fx.file, '--provider', 'workbuddy', '--ops-pool'])
    assert.equal(ops.calls[0].decision.owner, null)
    assert.match(ops.stdout, /归属=运营池\(--ops-pool 显式指定\)/)
    assert.match(
      Cli.parseArgs(['--tokens-file', fx.file, '--provider', 'trae', '--owner']).error ?? '',
      /需要 users\.id/,
    )
  } finally {
    rmScratch(fx.home)
  }
  // 真判据那一档:假家目录里写一枚 uuid ⇒ 默认必须落到个人池并透传给下游(替身只换解析基准,不换实现)
  const home2 = mkScratch('relay-tokens-owner-')
  try {
    writePoolOwner(home2, `${OWNER_UUID}\n`)
    const f2 = join(home2, 'tokens.txt')
    writeFileSync(f2, `${TOK_A}\n`, 'utf8')
    const calls = []
    const r2 = await runMain(
      ['--tokens-file', f2, '--provider', 'workbuddy'],
      { calls, resolveDefaultOwner: () => PoolOwner.resolveDefaultPoolOwner({ home: home2 }) },
      null,
    )
    assert.equal(r2.exit, 0)
    assert.equal(calls[0].decision.owner, OWNER_UUID)
    assert.equal(calls[0].decision.source, 'default-owner-file')
    assert.match(r2.stdout, /归属=个人池 30763d9f\*\*\*\(默认:取自 pool-owner\)/)
    const args = Cli.buildImporterArgs('workbuddy', calls[0].options, calls[0].decision)
    assert.equal(args[args.indexOf('--owner') + 1], OWNER_UUID, '默认归属必须透传给下游')
  } finally {
    rmScratch(home2)
  }
})

test('⑧ 凭据纪律:token 明文不进 stdout/stderr;人给的名称只经 maskPhone 单源出镜', async () => {
  const fx = mkFixtures({ tokensText: `13812345678\t${TOK_A}\n${TOK_B}\n`, poolOwner: undefined })
  const seen = []
  try {
    const spy = (s) => {
      seen.push(s)
      return `138****5678`
    }
    const r = await runMain(
      ['--tokens-file', fx.file, '--provider', 'workbuddy'],
      {
        resolveDefaultOwner: () => ({
          owner: OWNER_UUID,
          source: 'default-owner-file',
          reason: 'ok',
          file: '',
        }),
      },
      spy,
    )
    assert.equal(r.exit, 0)
    assert.ok(!r.stdout.includes(TOK_A) && !r.stderr.includes(TOK_A), 'stdout/stderr 不得含 token')
    assert.ok(!r.stdout.includes(TOK_B) && !r.stderr.includes(TOK_B))
    assert.ok(!r.stderr.includes('13812345678'), '人给的名称必须脱敏后才回显')
    assert.deepEqual(seen, ['13812345678'], 'given 名走单源脱敏;auto 名本身就是指纹,不重复脱敏')
    assert.match(r.stderr, /名称=138\*\*\*\*5678/)
    // 单源取不到 ⇒ 少显示而不是多泄露(绝不回落成明文)
    const nomask = await runMain(
      ['--tokens-file', fx.file, '--provider', 'workbuddy'],
      {
        resolveDefaultOwner: () => ({
          owner: OWNER_UUID,
          source: 'default-owner-file',
          reason: 'ok',
          file: '',
        }),
      },
      null,
    )
    assert.match(nomask.stderr, new RegExp(T.NAME_NOT_MASKED_TEXT.replace(/[()]/g, '\\$&')))
    assert.ok(!nomask.stderr.includes('13812345678'))
  } finally {
    rmScratch(fx.home)
  }
})

test('⑨ 折叠台账:序号↔行号↔指纹逐条给,且走 stderr(不污染 --json 的 stdout 机器面)', async () => {
  const fx = mkFixtures({
    tokensText: `#头注\n\n${TOK_A}\n我的号 ${TOK_B}\n`,
    poolOwner: undefined,
  })
  try {
    const r = await runMain(
      ['--tokens-file', fx.file, '--provider', 'workbuddy', '--json'],
      {
        resolveDefaultOwner: () => ({
          owner: OWNER_UUID,
          source: 'default-owner-file',
          reason: 'ok',
          file: '',
        }),
      },
      (s) => s,
    )
    assert.equal(r.exit, 0)
    assert.match(r.stderr, /行文本折入/)
    assert.match(r.stderr, /#1 ← 第3行/)
    assert.match(r.stderr, /#2 ← 第4行/)
    assert.ok(!r.stdout.includes('行文本折入'), '台账进 stdout 会把 --json 机器面搅浑')
    assert.equal(JSON.parse(r.calls[0].payloadText).accounts.length, 2)
    assert.equal(readFileSync(fx.file, 'utf8').includes(TOK_A), true, '夹具自身不被改写')
  } finally {
    rmScratch(fx.home)
  }
})

test('⑩ 帮助面写出这条命令(§0.8 文档不得写跑不通的出路)', () => {
  const h = Cli.helpText()
  assert.match(h, /--tokens-file <tokens\.txt> --provider <code>/)
  assert.match(h, /--name-prefix/)
  assert.match(h, /一行一枚 token/)
  assert.match(h, /duplicateUids/)
  assert.match(h, /exit 2 未判定/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
