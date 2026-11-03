// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型配置去重器物 + 生产导入器物的镜像测试(2026-10-26 立)。
 *
 * 立因:这两件都直接动数据/跨环境投递,判据错了后果不可逆(丢模型行 / 把半成品送生产)。
 * 只测**纯判据**与**参数面**(不连库、不发网):判据 import 源实现的 __test__(§22c)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as ingest } from '../relay-prod-ingest.mjs'

const goodPem = {
  deviceKeyPem: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----',
  devicePubPem: '-----BEGIN PUBLIC KEY-----\nBBBB\n-----END PUBLIC KEY-----',
}

test('① 生产载荷判据:四件套齐 ⇒ 无问题', () => {
  const p = {
    providerCode: 'trae',
    accounts: [
      { uid: '1', token: 't', refreshToken: 'r', deviceId: '4355605738307003', ...goodPem },
    ],
  }
  assert.deepEqual(ingest.judgePayload(p), [])
})

test('② 缺任一必需字段 ⇒ 点名(不把半成品送生产)', () => {
  const base = {
    providerCode: 'trae',
    accounts: [
      { uid: '1', token: 't', refreshToken: 'r', deviceId: '4355605738307003', ...goodPem },
    ],
  }
  for (const k of ['uid', 'token', 'refreshToken', 'deviceId', 'deviceKeyPem', 'devicePubPem']) {
    const p = structuredClone(base)
    delete p.accounts[0][k]
    const probs = ingest.judgePayload(p)
    assert.ok(
      probs.some((x) => x.includes(k)),
      `缺 ${k} 应被点名,实际:${probs.join(' | ')}`,
    )
  }
})

test('③ PEM 形态不对 ⇒ 点名(防把 base64 裸串当密钥投过去)', () => {
  const p = {
    providerCode: 'trae',
    accounts: [
      {
        uid: '1',
        token: 't',
        refreshToken: 'r',
        deviceId: '1',
        deviceKeyPem: 'not-a-pem',
        devicePubPem: '-----BEGIN PUBLIC KEY-----\nB\n-----END PUBLIC KEY-----',
      },
    ],
  }
  const probs = ingest.judgePayload(p)
  assert.ok(probs.some((x) => x.includes('deviceKeyPem')))
})

test('④ providerCode 不是 trae ⇒ 拒绝(本器只为 Trae 桌面票而写)', () => {
  const p = {
    providerCode: 'qoder',
    accounts: [
      { uid: '1', token: 't', refreshToken: 'r', deviceId: '1', ...goodPem },
    ],
  }
  assert.ok(ingest.judgePayload(p).some((x) => x.includes('providerCode')))
})

test('⑤ 空载荷/无 accounts ⇒ 判据不抛,返回点名(未判定不冒绿)', () => {
  assert.ok(ingest.judgePayload(null).length > 0)
  assert.ok(ingest.judgePayload({}).length > 0)
  assert.ok(ingest.judgePayload({ providerCode: 'trae', accounts: [] }).length > 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
