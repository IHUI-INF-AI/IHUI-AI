// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端更新钥匙"配对"判据的镜像测试(§22c:判据只有一份,这里 import 源脚本,不复制常量)。
// 钉住 2026-10-17 那次事故的全部三种失效形态:孤儿私钥、注释自洽但不配对、输入取不到却想记绿。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as pairing } from '../lib/updater-key-pairing.mjs'

const CONF_PUB = '19dac610993f308da8227d25e61de4044efa7363024fdc7ca1640c50a6f29944'
const OTHER_PUB = '392ca89b8b03f5587c3d7a4037694404c0adba22bda82858623e3619ab6edebd'
const confB64 = pairing.buildConfPubkeyFixtureForTest(CONF_PUB)
const secretOf = (pub) => pairing.buildSecretTextFixtureForTest(pub)
const rawInner = (s) => Buffer.from(s.trim(), 'base64').toString('latin1')

test('正例:私钥内嵌公钥 == 配置信任公钥 → ok', () => {
  const r = pairing.judgeUpdaterKeyPairing({ confPubkey: confB64, secretText: rawInner(secretOf(CONF_PUB)) })
  assert.equal(r.verdict, 'ok')
})

test('反例(事故型):私钥是另一把 → orphan,且报错里两串公钥都点名', () => {
  const r = pairing.judgeUpdaterKeyPairing({ confPubkey: confB64, secretText: rawInner(secretOf(OTHER_PUB)) })
  assert.equal(r.verdict, 'orphan')
  assert.match(r.reason, new RegExp(CONF_PUB))
  assert.match(r.reason, new RegExp(OTHER_PUB))
})

test('变异自证:摘掉配对这一维(只比注释)就会放过事故 → 判据必须比字节而不是比注释', () => {
  // 造一枚"注释/keynum 与配置完全相同、公钥字节不同"的私钥:按注释口径它会绿,按字节口径必须 orphan。
  const sameKeynumConf = pairing.buildConfPubkeyFixtureForTest(CONF_PUB, '08DBB1A27EE6D7B5')
  const confDec = pairing.decodeUpdaterPubkey(sameKeynumConf)
  const secretDec = pairing.decodeSecretEmbeddedPub(rawInner(secretOf(OTHER_PUB)))
  assert.equal(confDec.keynum, '08DBB1A27EE6D7B5')
  assert.equal(confDec.commentKeynum, Buffer.from('08DBB1A27EE6D7B5', 'hex').reverse().toString('hex').toUpperCase())
  assert.notEqual(secretDec.pubHex, confDec.pubHex)
  assert.equal(pairing.judgeUpdaterKeyPairing({ confPubkey: sameKeynumConf, secretText: rawInner(secretOf(OTHER_PUB)) }).verdict, 'orphan')
})

test('未判定:私钥魔数不是 EdScB2 → undetermined(不记绿也不冒红)', () => {
  const bogus = Buffer.from(`untrusted comment: x\n${Buffer.concat([Buffer.from('XX'), Buffer.alloc(152)]).toString('base64')}\n`, 'latin1').toString('base64')
  const r = pairing.judgeUpdaterKeyPairing({ confPubkey: confB64, secretText: rawInner(bogus) })
  assert.equal(r.verdict, 'undetermined')
  assert.match(r.reason, /EdScB2/)
})

test('未判定:配置侧没有 pubkey / 私钥为空 → undetermined', () => {
  assert.equal(pairing.judgeUpdaterKeyPairing({ confPubkey: undefined, secretText: rawInner(secretOf(CONF_PUB)) }).verdict, 'undetermined')
  assert.equal(pairing.judgeUpdaterKeyPairing({ confPubkey: confB64, secretText: '' }).verdict, 'undetermined')
})

test('未判定:公钥 blob 长度不是 42 → undetermined,而不是当成不配对冒红', () => {
  const shortRaw = Buffer.concat([Buffer.from([0x45, 0x64]), Buffer.alloc(8), Buffer.alloc(16)]).toString('base64')
  const bad = Buffer.from(`untrusted comment: minisign public key: 0\n${shortRaw}\n`, 'latin1').toString('base64')
  const r = pairing.judgeUpdaterKeyPairing({ confPubkey: bad, secretText: rawInner(secretOf(CONF_PUB)) })
  assert.equal(r.verdict, 'undetermined')
  assert.match(r.reason, /42 字节/)
})

test('方向锁:取不到输入的失败方向是"未判定"两字,绝不能被渲染成通过', () => {
  const r = pairing.judgeUpdaterKeyPairing({ confPubkey: confB64, secretText: 'not-base64-at-all' })
  assert.equal(r.verdict, 'undetermined')
  assert.ok(!'ok'.includes(r.verdict))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
