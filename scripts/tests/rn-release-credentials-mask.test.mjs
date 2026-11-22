// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { storeCredential, STORE_VENDORS, STATUS } from '../lib/rn-release-credentials.mjs'

// 脱敏形状锁(2026-11-22 立):storeCredential 的 fields 只许输出「带冒号的短键名」作字段标签,
// 绝不输出凭据原值。旧写法 split(/[:：]/)[0] 对**无冒号行**返回整行,把 CSV 数据行 /
// 单行纯私钥值 / 证书 base64 / cookie 的原值当字段名泄漏进日志(probe-store-channel 实测)。
// 本测试用临时 root 构造**合成 canary 凭据**(不含任何真实凭据),import 源脚本判据,禁止复制判据(§0.6)。
// 变异自证:若把非 JSON 分支还原成旧 split 逻辑,下列「原值不得出现」断言立即变红。

let root
const vendorOf = (id) => STORE_VENDORS.find((v) => v.id === id)
const fieldsOf = (id) => {
  const c = storeCredential(vendorOf(id), { root })
  if (c.status !== STATUS.FOUND) return []
  return c.value.flatMap((d) => d.fields)
}
const detailOf = (id) => {
  const c = storeCredential(vendorOf(id), { root })
  return c.status === STATUS.FOUND ? c.detail : ''
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'rn-cred-mask-'))
  // CSV:表头 + 数据行均无冒号,数据行含敏感 canary 值
  writeFileSync(join(root, '华为账号test.csv'), 'User Name,Access Key Id,Secret Access Key\nprobeuser,AKIDCANARY0001,SECRETCANARY999\n')
  // 单行纯私钥值(无冒号)
  writeFileSync(join(root, '小米私钥test.txt'), 'xiaomiprivatekeycanary000111222333444555666777888\n')
  // 证书 base64(无冒号)
  writeFileSync(join(root, '小米公钥test.cer'), '-----BEGIN CERTIFICATE-----\nMIICsjCCAhugAwIBAgIUCANARYBASE64BODY000111222333444555666777888999\n-----END CERTIFICATE-----\n')
  // 键:值 文本(有冒号,只许出键名)
  writeFileSync(join(root, '荣耀api_test.txt'), 'client_id: honoridcanary\nclient_secret: honorsecretcanary\n')
  // JSON(只许出键名)
  writeFileSync(join(root, 'vivo APItest.json'), JSON.stringify({ access_key: 'vivoakcanary', access_secret: 'vivoascanary' }))
  // 超长「键名」(>40 字符)带冒号:不得整段当键名输出
  writeFileSync(join(root, '荣耀long_test.txt'), `${'k'.repeat(60)}: longkeycanaryvalue\n`)
})
after(() => { rmSync(root, { recursive: true, force: true }) })

test('CSV 数据行原值(Secret/AccessKey/用户名)不得泄漏进 fields 或 detail', () => {
  const f = fieldsOf('huawei')
  const d = detailOf('huawei')
  for (const canary of ['SECRETCANARY999', 'AKIDCANARY0001', 'probeuser']) {
    assert.ok(!f.some((x) => x.includes(canary)), `fields 泄漏 CSV 原值 ${canary}`)
    assert.ok(!d.includes(canary), `detail 泄漏 CSV 原值 ${canary}`)
  }
})

test('单行纯私钥值与证书 base64 不得泄漏(无冒号行一律跳过)', () => {
  const f = fieldsOf('xiaomi')
  const d = detailOf('xiaomi')
  for (const canary of ['xiaomiprivatekeycanary', 'CANARYBASE64BODY']) {
    assert.ok(!f.some((x) => x.includes(canary)), `fields 泄漏 ${canary}`)
    assert.ok(!d.includes(canary), `detail 泄漏 ${canary}`)
  }
})

test('键:值 文本只输出键名,不输出值', () => {
  const f = fieldsOf('honor')
  assert.ok(f.includes('client_id'), '应保留键名 client_id')
  assert.ok(f.includes('client_secret'), '应保留键名 client_secret')
  assert.ok(!f.some((x) => x.includes('honoridcanary') || x.includes('honorsecretcanary')), '不得输出键值')
  assert.ok(!detailOf('honor').includes('honorsecretcanary'), 'detail 不得含值')
})

test('JSON 只输出键名,不输出值', () => {
  const f = fieldsOf('vivo')
  assert.deepEqual([...f].sort(), ['access_key', 'access_secret'])
  assert.ok(!detailOf('vivo').includes('vivoascanary'), 'detail 不得含 JSON 值')
})

test('超长键名(>40)不得整段当字段标签输出', () => {
  const f = fieldsOf('honor')
  assert.ok(!f.some((x) => x.length > 40), `fields 含超长标签: ${f.filter((x) => x.length > 40).length} 个`)
  assert.ok(!f.some((x) => x.includes('longkeycanaryvalue')), '不得泄漏超长行的值')
})

test('所有厂商 fields 标签长度 ≤40 且不含 canary 原值(总闸)', () => {
  for (const v of STORE_VENDORS) {
    for (const x of fieldsOf(v.id)) {
      assert.ok(x.length <= 40, `${v.id} 字段标签超长: len=${x.length}`)
      assert.ok(!/canary/i.test(x), `${v.id} 字段标签含 canary 原值`)
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
