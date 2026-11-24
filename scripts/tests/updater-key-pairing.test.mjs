// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端更新钥匙"配对"判据的镜像测试(§22c:判据只有一份,这里 import 源脚本,不复制常量)。
// 钉住 2026-10-17 那次事故的全部三种失效形态:孤儿私钥、注释自洽但不配对、输入取不到却想记绿。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { __test__ as pairing } from '../lib/updater-key-pairing.mjs'
import { __test__ as sig } from '../desktop-updater-sig-verify.mjs'

const CONF_PUB = '19dac610993f308da8227d25e61de4044efa7363024fdc7ca1640c50a6f29944'
const OTHER_PUB = '392ca89b8b03f5587c3d7a4037694404c0adba22bda82858623e3619ab6edebd'
const confB64 = pairing.buildConfPubkeyFixtureForTest(CONF_PUB)
const secretOf = (pub) => pairing.buildSecretTextFixtureForTest(pub)
const rawInner = (s) => Buffer.from(s.trim(), 'base64').toString('latin1')

test('正例:私钥内嵌公钥 == 配置信任公钥 → ok', () => {
  const r = pairing.judgeUpdaterKeyPairing({ confPubkey: confB64, secretText: rawInner(secretOf(CONF_PUB)) })
  assert.equal(r.verdict, 'ok')
})

test('正例(本机真实形态):私钥是「整段 base64」包裹形态 → 一样判 ok,不报无法判定', () => {
  // 2026-11-18 实测:~/.tauri/ihui-updater.key 里躺的就是这一型(外层一行 base64,
  // 解开才是两行 minisign 文本)。判据原先只认内层文本,把配得上的钥匙报成
  // 「私钥侧无法解析 ⇒ 无法判定」,本机发版链在签名前就停住。
  const wrapped = secretOf(CONF_PUB)
  assert.match(rawInner(wrapped), /untrusted comment:/) // 前提:夹具确实是"外层 base64 包裹内层文本"
  const r = pairing.judgeUpdaterKeyPairing({ confPubkey: confB64, secretText: wrapped })
  assert.equal(r.verdict, 'ok')
  // 包裹形态不得变成"一律放行":同一层包裹下换成另一把,仍要 orphan。
  assert.equal(pairing.judgeUpdaterKeyPairing({ confPubkey: confB64, secretText: secretOf(OTHER_PUB) }).verdict, 'orphan')
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

// ─── 验签器必须同时认两种官方 .sig 形态(2026-11-18 更新桌面端到 0.1.78 时实测踩中) ───
// CI 构建产物旁是裸 minisign 文本;GitHub Release 分发的 .sig 资产与 latest.json 的
// platforms[*].signature 是"整份文本再 base64 一层"的 Tauri 形态。两条都是有效产物。
const SIG_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
function sigFixture(algorithm) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const publicRawKey = Buffer.from(publicKey.export({ format: 'der', type: 'spki' }).subarray(SIG_SPKI_PREFIX.length))
  const artifactBytes = Buffer.from('installer bytes 安装包', 'utf8')
  const built = sig.buildSignatureForTest({ artifactBytes, privateKey, publicRawKey, algorithm, keyIdHex: 'B5D7E67EA2B1DB08' })
  return { built, artifactBytes }
}
for (const algorithm of ['Ed', 'ED']) {
  test(`验签正例(${algorithm}): 裸 minisign 文本验签通过`, () => {
    const { built, artifactBytes } = sigFixture(algorithm)
    const r = sig.verifyUpdaterSignature({ artifactBytes, sigText: built.sigText, pubkeyBase64: built.pubkeyBase64 })
    assert.equal(r.ok, true, r.reason)
  })
  test(`验签正例(${algorithm}): Tauri 双层 base64 .sig 验签通过(与裸文本等价)`, () => {
    const { built, artifactBytes } = sigFixture(algorithm)
    const wrapped = Buffer.from(built.sigText, 'utf8').toString('base64')
    const r = sig.verifyUpdaterSignature({ artifactBytes, sigText: wrapped, pubkeyBase64: built.pubkeyBase64 })
    assert.equal(r.ok, true, r.reason)
  })
  test(`验签反例(${algorithm}): Tauri 双层 .sig 篡改字节必须判红`, () => {
    const { built, artifactBytes } = sigFixture(algorithm)
    const wrapped = Buffer.from(built.sigText, 'utf8').toString('base64')
    const tampered = Buffer.concat([artifactBytes, Buffer.from('x')])
    const r = sig.verifyUpdaterSignature({ artifactBytes: tampered, sigText: wrapped, pubkeyBase64: built.pubkeyBase64 })
    assert.equal(r.ok, false)
    assert.match(r.reason, /验签失败|不匹配|长度/)
  })
}
test('normalizeSigText: 裸文本原样返回,损坏/非 base64 原样交回(不把解不开伪装成空签名)', () => {
  const raw = 'untrusted comment: sig\nAAAA\n'
  assert.equal(sig.normalizeSigText(raw), raw)
  assert.equal(sig.normalizeSigText('not-base64!@#'), 'not-base64!@#')
  assert.equal(sig.normalizeSigText(''), '')
})
test('normalizeSigText: Tauri 双层解成裸文本', () => {
  const raw = 'untrusted comment: sig\nQUJD\n'
  assert.equal(sig.normalizeSigText(Buffer.from(raw, 'utf8').toString('base64')), raw)
})
test('变异自证: 旧版只认裸文本的判据会把 Tauri 形态判红(证明锁的是真实行为)', () => {
  // 复刻旧判据:整段单行 base64 解出来远大于 74 字节 ⇒ decodeSignatureFile 必抛长度错。
  const { built, artifactBytes } = sigFixture('Ed')
  const wrapped = Buffer.from(built.sigText, 'utf8').toString('base64')
  assert.notEqual(Buffer.from(wrapped.trim(), 'base64').length, 74)
  // 而修复后的判据必须接受同一份输入
  assert.equal(sig.verifyUpdaterSignature({ artifactBytes, sigText: wrapped, pubkeyBase64: built.pubkeyBase64 }).ok, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
