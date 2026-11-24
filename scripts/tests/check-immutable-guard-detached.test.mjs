// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 夹具：分离签名台账（`scripts/data/immutable-guard-detached-signatures.jsonl`）的每条红线。
 *
 * 只测**判定**本身（`lib/immutable-guard.mjs` 的 `decide` / `lookupDetached` / `parseDetachedLedger`），
 * 不建真仓：判据是纯函数，夹具就必须能把「多一条路径 / 少一条路径 / 改一个 hex / 重复 / 缺钥 /
 * 换 sha / 没这条」逐条单独打出来。
 *
 * 最后一条是改前实现对照：把 `3b8531d83d` 的旧 lib 从 git 对象里取出来（同一夹具、同一日期），
 * 旧实现必须判红（`undeclared-unsigned`），新实现才是 `detached-valid` —— 证明这条通道真的改变了判定，
 * 而不是"新写的夹具自己跟自己绿"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  DETACHED_SIG_RE,
  EXEMPT_TRAILER,
  decide,
  parseDetachedLedger,
  signDetached,
} from '../lib/immutable-guard.mjs'

const KEY = 'k'.repeat(32) // 独立追认钥
const SUBMIT_KEY = 's'.repeat(32) // 提交签名钥（必须与追认钥不是同一把）
const OTHER_KEY = 'z'.repeat(32)
const SHA = 'c'.repeat(40)
const SHA_OTHER = 'd'.repeat(40)
const SIGNED_AT = '2026-11-07'
const EXPIRY = '2026-11-11'
const BEFORE_EXPIRY = '2026-11-10'
const HIT = 'scripts/x.mjs' // 受保护面
const EXTRA = 'docs/readme.md' // 非受保护面（但仍是该枚路径全集的一部分）
const REASON =
  '这一枚是在修护栏自己的漏判，提交时只写了文字理由、没有签名槽位，现按该枚实际路径全集补签。'

const ENTRIES = [{ path: HIT, kind: 'gate-body', why: '夹具：单文件受保护面' }]
/** 该枚 `rev^..rev` 差异集的**全路径集**（去重升序）：受保护 + 非受保护都在内。 */
const CHANGES = [
  { status: 'M', path: HIT },
  { status: 'A', path: EXTRA },
]
const FULL_PATHS = [EXTRA, HIT].sort()
/** 真实形态：提交信息里只有文字理由，**没有** `immutable-exempt-sig` 行。 */
const REASON_MESSAGE = `${EXEMPT_TRAILER} ${REASON}`

function sign(over = {}) {
  const row = { sha: SHA, paths: FULL_PATHS, reason: REASON, signedAt: SIGNED_AT, ...over }
  return { ...row, sig: signDetached({ ...row, key: KEY }) }
}

function judge(rows, extra = {}) {
  const {
    today = EXPIRY,
    ackKey = KEY,
    message = REASON_MESSAGE,
    changes = CHANGES,
    ...rest
  } = extra
  return decide({
    entries: ENTRIES,
    changes,
    message,
    today,
    key: SUBMIT_KEY,
    ackKey,
    signatureRequiredFrom: EXPIRY,
    sha: SHA,
    detachedRows: rows,
    commitDate: SIGNED_AT,
    ...rest,
  })
}

test('D1 正常通过：40 位 sha + 全路径集逐条相等 + 验签通过 ⇒ detached-valid（exit 0，不并进 declared）', () => {
  const out = judge([sign()])
  assert.equal(out.exit, 0)
  assert.equal(out.code, 'detached-valid')
  assert.equal(out.signature.code, 'sig-missing') // 提交当时确实没有签名：读数不许读成"当时就合规"
  assert.equal(out.detached.row.sha, SHA)
})

test('D2 paths 多一条 ⇒ detached-paths-mismatch（不做"包含即可"）', () => {
  const row = sign({ paths: [...FULL_PATHS, 'scripts/extra.mjs'].sort() })
  const out = judge([row])
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'detached-paths-mismatch')
  assert.match(out.detached.why, /多出/)
})

test('D3 paths 少一条 ⇒ detached-paths-mismatch（漏掉非受保护路径也算路径集不齐）', () => {
  const out = judge([sign({ paths: [HIT] })])
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'detached-paths-mismatch')
  assert.match(out.detached.why, /缺少/)
})

test('D4 改 sig 一个字符 ⇒ detached-sig-invalid（hex 变一位就验不过）', () => {
  const row = sign()
  const flipped = `${row.sig.slice(0, -1)}${row.sig.endsWith('0') ? '1' : '0'}`
  const out = judge([{ ...row, sig: flipped }])
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'detached-sig-invalid')
})

test('D5 同一 sha 两条 ⇒ detached-duplicate（不许重复签发，也不"取最后一行覆盖"）', () => {
  const a = sign()
  const b = sign({ signedAt: '2026-11-08' }) // 两条都合法，只是重复
  const out = judge([a, b])
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'detached-duplicate')
  assert.equal(out.detached.count, 2)
})

test('D6 独立追认钥不可得 ⇒ detached-key-unavailable（exit 2 未判定，绝不放行）', () => {
  const out = judge([sign()], { ackKey: null })
  assert.equal(out.exit, 2)
  assert.equal(out.code, 'detached-key-unavailable')
  assert.equal(out.detached.state, 'unavailable')
})

test('D7 台账里没有这一枚 ⇒ 回落原判序：11-10 放行（declared-unsigned）/ 11-11 判红（undeclared-unsigned）', () => {
  const before = judge([], { today: BEFORE_EXPIRY })
  assert.equal(before.exit, 0)
  assert.equal(before.code, 'declared-unsigned')
  const after = judge([], { today: EXPIRY })
  assert.equal(after.exit, 1)
  assert.equal(after.code, 'undeclared-unsigned') // 没写这一条 ≠ 静默放行
})

test('D8 台账行的 sha 换成另一枚 ⇒ 判红（本枚查不到，不会"借"别枚的签名）', () => {
  const out = judge([sign({ sha: SHA_OTHER })])
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'undeclared-unsigned')
})

test('D9 11-11 当天"有台账但签名无效"仍判红（日期到了不豁免验签）', () => {
  const bad = sign()
  const out = judge([{ ...bad, sig: 'f'.repeat(64) }], { today: EXPIRY })
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'detached-sig-invalid')
})

test('D10 到期前一天"有台账但验不过"也判红（命中台账即定档，不借窗口放行）', () => {
  const bad = sign()
  const out = judge([{ ...bad, sig: 'f'.repeat(64) }], { today: BEFORE_EXPIRY })
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'detached-sig-invalid')
})

test('D11 本通道不依赖提交信息里的签名槽位：只有文字理由也能验过（绑的是 sha+路径集+理由+日期）', () => {
  const out = judge([sign()], { message: `${EXEMPT_TRAILER} ${REASON}` })
  assert.equal(out.exit, 0)
  assert.equal(out.code, 'detached-valid')
  assert.equal(out.signature.code, 'sig-missing')
})

test('D12 用别的钥签的台账行 ⇒ detached-sig-invalid（不是"有签名就放行"）', () => {
  const row = sign()
  const foreign = { ...row, sig: signDetached({ ...row, key: OTHER_KEY }) }
  const out = judge([foreign])
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'detached-sig-invalid')
})

test('D13 parse：短 sha / 缺键 / 坏 sig 逐行点名；路径不齐的行保留在 rows（交给判定点名成因）', () => {
  const good = sign()
  const text = [
    JSON.stringify({ ...good, sha: 'abc123' }),
    JSON.stringify({ ...good, signedAt: '' }),
    JSON.stringify({ ...good, sig: 'XYZ' }),
    JSON.stringify({ ...good, paths: [HIT] }),
  ].join('\n')
  const parsed = parseDetachedLedger(text)
  assert.equal(parsed.problems.length, 3)
  assert.deepEqual(
    parsed.problems.map((p) => p.line),
    [1, 2, 3],
  )
  assert.equal(parsed.rows.length, 1) // 第 4 行形状合法（语义问题留给判定）
  assert.deepEqual(parsed.rows[0].paths, [HIT])
})

test('D14 载荷键序固定：换成别的键序 / 改一个字段 ⇒ HMAC 必变；paths 顺序归一后仍算同一行', () => {
  const row = sign()
  const hmac = (s) => createHmac('sha256', KEY).update(s).digest('hex')
  assert.equal(
    row.sig,
    hmac(
      JSON.stringify({
        sha: row.sha,
        paths: row.paths,
        reason: row.reason,
        signedAt: row.signedAt,
      }),
    ),
  )
  assert.notEqual(
    row.sig,
    hmac(
      JSON.stringify({
        reason: row.reason,
        sha: row.sha,
        paths: row.paths,
        signedAt: row.signedAt,
      }),
    ),
  )
  assert.notEqual(
    row.sig,
    hmac(
      JSON.stringify({
        sha: row.sha,
        paths: row.paths,
        reason: row.reason,
        signedAt: row.signedAt,
        v: 'v1',
      }),
    ),
  )
  // 行内 paths 顺序与签名时不同 ⇒ 归一后仍是同一路径集 ⇒ 合法（排序本身是签名的一部分，比较也排序）
  assert.equal(judge([{ ...row, paths: [...row.paths].reverse() }]).code, 'detached-valid')
})

test('D15 改前实现（3b8531d83d 的 lib）跑同一夹具必须判红：undeclared-unsigned', async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  let oldText
  try {
    oldText = execFileSync(
      'git',
      ['-C', repoRoot, 'show', '3b8531d83d:scripts/lib/immutable-guard.mjs'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch {
    // 浅克隆 / 换库时该历史对象可能不在：跳过对照，不把"取不到证据"伪装成通过。
    return
  }
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ig-detached-legacy-'))
  const file = path.join(dir, 'immutable-guard-old.mjs')
  writeFileSync(file, oldText, 'utf8')
  const oldLib = await import(pathToFileURL(file).href)
  const out = oldLib.decide({
    entries: ENTRIES,
    changes: CHANGES,
    message: REASON_MESSAGE,
    today: EXPIRY,
    key: SUBMIT_KEY,
    ackKey: KEY,
    signatureRequiredFrom: EXPIRY,
    sha: SHA,
    commitDate: SIGNED_AT,
    // 旧实现不认识 detachedRows：同一枚提交、同一天，只靠文字理由 ⇒ 必红
  })
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'undeclared-unsigned')
  // 新实现：同一夹具 + 台账行 ⇒ 绿（否则上面那些绿就没有意义）
  assert.equal(judge([sign()]).code, 'detached-valid')
  assert.equal(oldText.includes('lookupDetached'), false)
  assert.equal(DETACHED_SIG_RE.test(sign().sig), true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
