// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 判据单一真相源 = scripts/security/lib/tsa-token.mjs;这里只 import,一条都不抄。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TSA_ENDPOINTS,
  TSA_STATE,
  judgeVerifyOutput,
  parseTsReplyText,
  summarizeVerification,
  tsaBaseNameOf,
  tsaPayloadBytes,
  tsaPayloadOf,
} from '../security/lib/tsa-token.mjs'

const GEN = '0'.repeat(64)

// ── 载荷 ────────────────────────────────────────────────────────────────────
test('载荷:取链尾的 hash 与 seq,不含 prevAnchor', () => {
  const p = tsaPayloadOf([{ seq: 0, hash: 'a'.repeat(64) }, { seq: 1, hash: 'b'.repeat(64) }], 'T', GEN)
  assert.equal(p.count, 2)
  assert.equal(p.seq, 1)
  assert.equal(p.chainHead, 'b'.repeat(64))
  assert.equal(p.prevAnchor, undefined)
  assert.equal(p.v, 1)
})

test('载荷:空链用 genesis 兜底,不是 null', () => {
  const p = tsaPayloadOf([], 'T', GEN)
  assert.equal(p.count, 0)
  assert.equal(p.seq, 0)
  assert.equal(p.chainHead, GEN)
})

test('载荷字节:同输入逐字节一致(验签靠这个,多一个空格就 imprint mismatch)', () => {
  const p = tsaPayloadOf([{ seq: 0, hash: 'c'.repeat(64) }], '2026-11-25T00:00:00.000Z', GEN)
  const a = tsaPayloadBytes(p)
  const b = tsaPayloadBytes({ ...p })
  assert.equal(a.equals(b), true)
  assert.equal(a.toString('utf8').endsWith('\n'), true)
})

// ── 文件名 ──────────────────────────────────────────────────────────────────
test('文件名:ISO 里的冒号/点号必须压掉,否则 Windows 上根本建不出文件', () => {
  const n = tsaBaseNameOf('2026-11-25T07:03:20.463Z', 'dbf70ea67da8ff00')
  assert.equal(/[:.]/.test(n), false)
  assert.equal(n.startsWith('20261125T070320463Z'), true)
  assert.equal(n.endsWith('-dbf70ea67da8'), true)
})

// ── reply 解析 ──────────────────────────────────────────────────────────────
const SAMPLE = [
  'Using configuration from /usr/ssl/openssl.cnf',
  'Status info:',
  'Status: Granted.',
  'Status description: unspecified',
  'Failure info: unspecified',
  '',
  'TST info:',
  'Version: 1',
  'Policy OID: 2.16.840.1.114412.7.1',
  'Hash Algorithm: sha256',
  'Message data:',
  '    0000 - b6 2f 07 62 f9 d4 5d 96-cc 60 68 e3 97 f3 1a 30   ./.b..]..`h....0',
  '    0010 - 4d 55 88 a5 b0 77 30 87-ed aa f5 18 43 76 58 63   MU...w0.....CvXc',
  'Serial number: 0x1CF3F5F1026716B41ADEB42DDB58D1F7',
  'Time stamp: Nov 25 07:01:19 2026 GMT',
  'Accuracy: unspecified',
  'Ordering: no',
  'Nonce: 0xD0D20FB2940B3F1A',
].join('\n')

test('reply 解析:真实 DigiCert 样本逐字取到状态/时间/序列号/imprint', () => {
  const r = parseTsReplyText(SAMPLE)
  assert.equal(r.granted, true)
  assert.equal(r.status, 'Granted.')
  assert.equal(r.time, 'Nov 25 07:01:19 2026 GMT')
  assert.equal(r.serial, '0x1CF3F5F1026716B41ADEB42DDB58D1F7')
  assert.equal(r.hashAlgorithm, 'sha256')
  assert.equal(r.imprint, 'b62f0762f9d45d96cc6068e397f31a304d5588a5b0773087edaaf51843765863')
})

test('reply 解析:未授予 ⇒ granted=false(不能当凭证收下)', () => {
  const r = parseTsReplyText('Status info:\nStatus: Rejected.\nStatus description: bad request\n')
  assert.equal(r.granted, false)
  assert.equal(r.status, 'Rejected.')
})

test('reply 解析:空/乱文本不抛', () => {
  const r = parseTsReplyText('')
  assert.equal(r.granted, false)
  assert.equal(r.time, null)
  assert.equal(r.imprint, null)
})

// ── 验签判读(核心纪律:本机 rc 恒 0,只能读文本) ──────────────────────────
test('验签判读:Verification: OK ⇒ ok', () => {
  const v = judgeVerifyOutput('Using configuration from /usr/ssl/openssl.cnf\nVerification: OK\n')
  assert.equal(v.state, TSA_STATE.OK)
})

test('验签判读:imprint mismatch ⇒ failed(改一个字节必须验不过)', () => {
  const v = judgeVerifyOutput('100000000A000000:error:17800067:time stamp routines:ts_check_imprints:message imprint mismatch:crypto/ts/ts_rsp_verify.c:508:\nVerification: FAILED\n')
  assert.equal(v.state, TSA_STATE.FAILED)
})

test('验签判读:空输出 ⇒ undetermined,绝不冒充通过', () => {
  assert.equal(judgeVerifyOutput('').state, TSA_STATE.UNDETERMINED)
  assert.equal(judgeVerifyOutput(null).state, TSA_STATE.UNDETERMINED)
  assert.equal(judgeVerifyOutput('Using configuration from /usr/ssl/openssl.cnf').state, TSA_STATE.UNDETERMINED)
})

test('验签判读:只有 error 行(如缺 CA/证书链)没有 FAILED 字样 ⇒ undetermined', () => {
  // 这种输出分不清"验不过"和"本机缺 CA 包"——前者是假凭证,后者是我们的环境问题。
  // 判据不猜:落未判定,等一次定向说明;既不冒绿也不冒红。
  const v = judgeVerifyOutput('100000000A000000:error:17800064:time stamp routines:ts_verify_cert:certificate verify error\n')
  assert.equal(v.state, TSA_STATE.UNDETERMINED)
})

// ── 汇总 ────────────────────────────────────────────────────────────────────
test('汇总:全通过 ⇒ ok', () => {
  const s = summarizeVerification([{ state: 'ok' }, { state: 'ok' }])
  assert.equal(s.state, TSA_STATE.OK)
  assert.equal(s.ok, 2)
})

test('汇总:任何一条 failed ⇒ 整体 failed(一条假凭证就够判死)', () => {
  const s = summarizeVerification([{ state: 'ok' }, { state: 'failed' }])
  assert.equal(s.state, TSA_STATE.FAILED)
  assert.equal(s.failed, 1)
})

test('汇总:有未判定而其余通过 ⇒ undetermined(半判不写成判过)', () => {
  const s = summarizeVerification([{ state: 'ok' }, { state: 'undetermined' }])
  assert.equal(s.state, TSA_STATE.UNDETERMINED)
})

test('汇总:一条都没有 ⇒ undetermined,不是 ok', () => {
  const s = summarizeVerification([])
  assert.equal(s.state, TSA_STATE.UNDETERMINED)
  assert.equal(s.total, 0)
})

// ── 端点清单 ────────────────────────────────────────────────────────────────
test('端点:至少两个且全是 http(s),不能有空串', () => {
  assert.equal(TSA_ENDPOINTS.length >= 2, true)
  for (const u of TSA_ENDPOINTS) assert.match(u, /^https?:\/\/.+/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
