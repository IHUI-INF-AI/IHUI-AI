// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// KR 台账镜像测试:scripts/data/i18n-key-removals.json
//
// 存在意义:
//   `scripts-mirror-tests` 的 --changed 面按 basename 令牌映射镜像测试，台账文件
//   (scripts/data/i18n-key-removals.json) 此前没有任何同名测试，改动一次就会被判
//   「映射到 0 条用例 ⇒ 未判定 ⇒ 红」。本测试补上这枚镜像，并同时锁住台账的结构
//   与「2026-11-05 删除的三枚 miniapp-taro ko 残留键」不回潮。
//
// 断言口径:
//   1) 台账每条声明字段完整、路径真实存在、键名格式合法、file+key 不重复；
//   2) 本次删除的三枚键在 zh-CN/en/ja/ko/zh-TW 五语言中均不存在（不是只删 ko 造成单侧缺键）；
//   3) 三枚键在台账里逐条声明，防止「删了键却漏登记」绕过 i18n 一致性门。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LEDGER_REL = 'scripts/data/i18n-key-removals.json'
const MINIAPP_LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const REMOVED_KEYS = [
  'devEnter.n8nModel.mockSuccess',
  'devEnter.modelEdit.submitSuccess',
  'deventerModeledit.q7',
]

function readJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
}

function readAt(obj, dotted) {
  let cur = obj
  for (const part of dotted.split('.')) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return { present: false }
    cur = cur[part]
  }
  return { present: true, value: cur }
}

test('KR 台账结构合法且无重复声明', () => {
  const ledger = readJson(LEDGER_REL)
  assert.equal(typeof ledger.$comment, 'string')
  assert.ok(Array.isArray(ledger.removals) && ledger.removals.length > 0, 'removals 必须是非空数组')

  const seen = new Set()
  for (const entry of ledger.removals) {
    assert.equal(typeof entry.file, 'string', 'file 必须是字符串')
    assert.ok(existsSync(join(ROOT, entry.file)), `file 不存在: ${entry.file}`)
    assert.ok(Array.isArray(entry.keys) && entry.keys.length > 0, `keys 必须非空: ${entry.file}`)
    assert.ok(entry.reason.length >= 10, `reason 过短: ${entry.file}`)
    assert.match(entry.until, /^\d{4}-\d{2}-\d{2}$/, `until 格式非法: ${entry.file}`)
    for (const key of entry.keys) {
      assert.match(key, /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_.-]+)*$/, `键名格式非法: ${entry.file} :: ${key}`)
      const id = `${entry.file}::${key}`
      assert.ok(!seen.has(id), `重复声明: ${id}`)
      seen.add(id)
    }
  }
})

test('三枚 ko 残留键在五语言中均不存在', () => {
  for (const locale of MINIAPP_LOCALES) {
    const messages = readJson(`packages/i18n/messages/miniapp-taro/${locale}.json`)
    for (const key of REMOVED_KEYS) {
      assert.equal(
        readAt(messages, key).present,
        false,
        `${locale}.json 仍存在 ${key}；删除必须五语言同步缺失，不能只让 ko 单侧缺键`,
      )
    }
  }
})

test('三枚键已在 KR 台账逐条声明', () => {
  const ledger = readJson(LEDGER_REL)
  const declared = new Set()
  for (const entry of ledger.removals) {
    if (entry.file === 'packages/i18n/messages/miniapp-taro/ko.json') {
      for (const key of entry.keys) declared.add(key)
    }
  }
  for (const key of REMOVED_KEYS) {
    assert.ok(declared.has(key), `台账未声明 ${key}，删键必须留痕`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
