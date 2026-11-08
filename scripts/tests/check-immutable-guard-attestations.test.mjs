// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 夹具：具名追认台账（`scripts/data/immutable-guard-attestations.jsonl`）的六条红线。
 *
 * 这里只测**判定**本身（`lib/immutable-guard.mjs` 的 `decide` / `lookupAttestation`），
 * 不建真仓、不碰工作树——判据是纯函数，夹具就必须能把"多一条/少一条/改签名/理由短/重复/倒填"
 * 逐条单独打出来。端到端（`--range` 真跑）由验收步骤覆盖。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  ATTEST_MIN_REASON_CHARS,
  EXEMPT_TRAILER,
  SIG_TRAILER,
  attestPayload,
  decide,
  lookupAttestation,
  parseAttestLedger,
  signAttestation,
  signExemption,
} from '../lib/immutable-guard.mjs'

const KEY = 'k'.repeat(32) // 独立追认钥
const SUBMIT_KEY = 's'.repeat(32) // 提交签名钥（必须与追认钥不是同一把）
const OTHER_KEY = 'z'.repeat(32)
const SHA = 'b'.repeat(40)
const COMMIT_DATE = '2026-11-07'
const HIT = 'scripts/x.mjs'
const REASON =
  '当时这一笔是在修护栏自身的漏判，提交时只写了标题就落账，没有把改动面与理由写进提交信息，现按实际触发路径逐条具名追认。'

const ENTRIES = [
  { path: HIT, kind: 'gate-body', why: '夹具：单文件受保护面' },
  { path: 'scripts/y.mjs', kind: 'gate-body', why: '夹具：第二条受保护面（测"少一条"）' },
]

function sign(over = {}) {
  const row = {
    sha: SHA,
    paths: [HIT],
    reason: REASON,
    reviewer: '测试追认人 <reviewer@example.com>',
    attestedAt: COMMIT_DATE,
    ...over,
  }
  return { ...row, sig: signAttestation({ ...row, key: KEY }) }
}

function judge(attestRows, changes = [{ status: 'M', path: HIT }], extra = {}) {
  return decide({
    entries: ENTRIES,
    changes,
    message: '',
    sha: SHA,
    attestRows,
    commitDate: COMMIT_DATE,
    key: SUBMIT_KEY,
    ackKey: KEY,
    ...extra,
  })
}

test('A1 正常通过：路径逐元素相等 + 验签通过 ⇒ declared-attested（exit 0，不进 breaches）', () => {
  const out = judge([sign()])
  assert.equal(out.exit, 0)
  assert.equal(out.code, 'declared-attested')
  assert.equal(out.attest.row.reviewer, '测试追认人 <reviewer@example.com>')
  assert.equal(out.attest.row.attestedAt, COMMIT_DATE)
})

test('A2 paths 多一条 ⇒ 判红（不许"覆盖"）', () => {
  const out = judge([sign({ paths: [HIT, 'scripts/别处.mjs'] })])
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-paths-mismatch')
  assert.match(out.attest.why, /多出/)
})

test('A3 paths 少一条 ⇒ 判红（漏一条也不算覆盖）', () => {
  const out = judge([sign({ paths: [HIT] })], [
    { status: 'M', path: HIT },
    { status: 'M', path: 'scripts/y.mjs' },
  ])
  assert.equal(out.exit, 1, '实际触发两条、台账只写一条，必须红')
  assert.equal(out.attest.code, 'attest-paths-mismatch')
  assert.match(out.attest.why, /缺少/)
})

test('A4 sig 被篡改 ⇒ 判红（改一个 hex 也算）', () => {
  const row = sign()
  const tampered = { ...row, sig: (row.sig[0] === '0' ? '1' : '0') + row.sig.slice(1) }
  const out = judge([tampered])
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-sig-invalid')
})

test('A5 reason 过短 ⇒ 判红（40 字是下限，20 字不算说明；签名本身是对的）', () => {
  const row = {
    sha: SHA,
    paths: [HIT],
    reason: '这理由太短了只有二十来个字符不够用',
    reviewer: '测试追认人 <reviewer@example.com>',
    attestedAt: COMMIT_DATE,
  }
  // signAttestation 按设计拒绝短理由；这里直接算 HMAC，证明"签名对但理由短"照样判红，而不是被签发器挡掉。
  const sig = createHmac('sha256', KEY).update(attestPayload(row)).digest('hex')
  const out = judge([{ ...row, sig }])
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-reason-short')
  assert.ok([...row.reason].length < ATTEST_MIN_REASON_CHARS)
  assert.throws(() => signAttestation({ ...row, key: KEY }), /reason 不足/, '签发器必须拒绝短理由')
})

test('A6 同一 sha 两条记录 ⇒ 判红（不许重复追认，也不取最后一行）', () => {
  const out = judge([sign(), sign({ reviewer: '第二个追认人 <two@example.com>' })])
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-duplicate')
  assert.equal(out.attest.count, 2)
})

test('A7 追认日期早于提交日期 ⇒ 判红（不许倒填背书）', () => {
  const out = judge([sign({ attestedAt: '2026-11-06' })])
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-backdated')
})

test('A8 reviewer 为空 ⇒ 判红（空署名不算说明；签名本身是对的）', () => {
  const row = {
    sha: SHA,
    paths: [HIT],
    reason: REASON,
    reviewer: '',
    attestedAt: COMMIT_DATE,
  }
  const sig = createHmac('sha256', KEY).update(attestPayload(row)).digest('hex')
  const out = judge([{ ...row, sig }])
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-reviewer-empty')
})

test('A9 取错追认钥验不过 ⇒ 判红（不是"有签名就放行"；提交钥换成另一把不影响追认判）', () => {
  const out = judge([sign()], [{ status: 'M', path: HIT }], { ackKey: OTHER_KEY })
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-sig-invalid')
})

test('A10 台账坏行（sha 短写）⇒ parse 阶段就点名，不静默当成"没有追认"', () => {
  const good = sign()
  const bad = { ...good, sha: SHA.slice(0, 12) }
  const parsed = parseAttestLedger(`${JSON.stringify(good)}\n${JSON.stringify(bad)}\n`)
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.problems.length, 1)
  assert.match(parsed.problems[0].why, /40 位/)
})

test('A11 签名载荷键序固定：换序/改一个字段 ⇒ 验签必失败', () => {
  const row = sign()
  assert.equal(
    lookupAttestation({ rows: [row], sha: SHA, hits: [{ path: HIT }], commitDate: COMMIT_DATE, ackKey: KEY })
      .code,
    'attest-verified',
  )
  const reordered = {
    ...row,
    sig: createHmac('sha256', KEY)
      .update(
        JSON.stringify({
          paths: row.paths,
          sha: row.sha,
          reason: row.reason,
          reviewer: row.reviewer,
          attestedAt: row.attestedAt,
        }),
      )
      .digest('hex'),
  }
  assert.equal(
    lookupAttestation({
      rows: [reordered],
      sha: SHA,
      hits: [{ path: HIT }],
      commitDate: COMMIT_DATE,
      ackKey: KEY,
    }).code,
    'attest-sig-invalid',
    '键序变了就是另一段 JSON，必须验不过',
  )
})
// ---------------------------------------------------------------------------
// 钥分离（2026-11-07）：追认台账只用独立追认钥签/验，不做双钥并存；缺钥判未判定
// ---------------------------------------------------------------------------

test('A12 旧提交钥签的追认行 ⇒ 判红（旧钥不再被追认路径读取，不做双钥并存）', () => {
  const row = {
    sha: SHA,
    paths: [HIT],
    reason: REASON,
    reviewer: '测试追认人 <reviewer@example.com>',
    attestedAt: COMMIT_DATE,
  }
  const oldSig = signAttestation({ ...row, key: SUBMIT_KEY })
  const out = judge([{ ...row, sig: oldSig }])
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-sig-invalid')
  // 同一行换成追认钥签 ⇒ 立刻变绿（证明夹具区分的是"哪把钥签的"，不是内容坏了）
  const ok = judge([{ ...row, sig: signAttestation({ ...row, key: KEY }) }])
  assert.equal(ok.exit, 0)
  assert.equal(ok.code, 'declared-attested')
})

test('A13 追认钥与提交钥是同一把 ⇒ 判红（attest-self-key，退回作者自认）', () => {
  const out = judge([sign()], [{ status: 'M', path: HIT }], { key: KEY })
  assert.equal(out.exit, 1)
  assert.equal(out.attest.code, 'attest-self-key')
})

test('A14 追认钥不可得 ⇒ 判未判定（exit 2），不静默放行', () => {
  const out = judge([sign()], [{ status: 'M', path: HIT }], { ackKey: null })
  assert.equal(out.exit, 2, '缺追认钥必须判未判定，不能绿')
  assert.equal(out.code, 'attest-undetermined')
  assert.equal(out.attest.state, 'unavailable')
  assert.equal(out.attest.code, 'attest-key-unavailable')
})

test('A15 到期日边界（注入 2026-11-11）：11-10 仍放行、11-11 当天判红', () => {
  const textOnly = {
    entries: ENTRIES,
    changes: [{ status: 'M', path: HIT }],
    message: `refactor: text-only\n\n${EXEMPT_TRAILER} ${REASON}`,
    key: SUBMIT_KEY,
    ackKey: KEY,
    signatureRequiredFrom: '2026-11-11',
  }
  const before = decide({ ...textOnly, today: '2026-11-10' })
  assert.equal(before.exit, 0)
  assert.equal(before.code, 'declared-unsigned')
  const onDay = decide({ ...textOnly, today: '2026-11-11' })
  assert.equal(onDay.exit, 1, '到期日当天必须收紧')
  assert.equal(onDay.code, 'undeclared-unsigned')
})

test('A16 到期日当天签名有效 ⇒ 仍然放行（不是"到期一刀切红"）', () => {
  const subject = 'refactor: signed'
  const sig = signExemption({ subject, hits: [{ path: HIT }], reason: REASON, key: SUBMIT_KEY })
  const out = decide({
    entries: ENTRIES,
    changes: [{ status: 'M', path: HIT }],
    message: `${subject}\n\n${EXEMPT_TRAILER} ${REASON}\n${SIG_TRAILER} ${sig}`,
    key: SUBMIT_KEY,
    ackKey: KEY,
    signatureRequiredFrom: '2026-11-11',
    today: '2026-11-11',
  })
  assert.equal(out.exit, 0)
  assert.equal(out.code, 'declared')
  assert.equal(out.signature.code, 'sig-verified')
})

test('A17 到期日当天签名验不过 ⇒ 仍判红（日期到了但签名无效不许放行）', () => {
  const subject = 'refactor: bad-sig'
  const sig = signExemption({ subject, hits: [{ path: HIT }], reason: REASON, key: OTHER_KEY })
  const out = decide({
    entries: ENTRIES,
    changes: [{ status: 'M', path: HIT }],
    message: `${subject}\n\n${EXEMPT_TRAILER} ${REASON}\n${SIG_TRAILER} ${sig}`,
    key: SUBMIT_KEY,
    ackKey: KEY,
    signatureRequiredFrom: '2026-11-11',
    today: '2026-11-11',
  })
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'undeclared-unsigned')
  assert.equal(out.signature.code, 'sig-invalid')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
