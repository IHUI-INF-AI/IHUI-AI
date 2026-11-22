#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:号池 owner 身份键(email)读路径必须经 decryptCredential 解密(§12f 抗注释退化)。
 *
 * 立因:DB-35(2026-11-16 迁移 20261116174441)后 users.email 列存 enc:v1: 密文(随机 IV)。
 * relay-pool-owner-map.ts 立于 11-12 当时 email 是明文,直接读会把密文当身份键导出;
 * 两端 admin 的 users.id 不同、靠 email 做身份键,一端密文一端明文 ⇒ 跨环境 owner 翻译
 * 全跳过、同步静默失效(2026-11-21 实证)。修复=读路径经 decryptCredential(密文还原 /
 * 存量明文原样透传 / 解密失败 fail-closed 抛错,绝不把密文当身份键)。
 *
 * 判据(结构面,去注释后判定):两个脚本各自必须
 *   ① 真 import decryptCredential(非注释);
 *   ② 在把 email 写进身份键映射前真调用 decryptCredential(emailRaw)。
 * 只出现在注释里不算(§12f:注释能满足的判据=没有判据);同时做反退化锚点:检出集必须非空,
 * 且两个已知脚本都在集内,正则写坏时守门自己先红而不是在空集上假绿。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const TARGETS = [
  'apps/api/scripts/relay-pool-owner-map.ts',
  'apps/api/scripts/relay-account-import.ts',
]

/** 去行注释与块注释(不碰行内,避免误伤 URL/正则字面量里的 //)。 */
function stripComments(text) {
  const out = []
  let inBlock = false
  for (const line of text.split(/\r?\n/)) {
    if (inBlock) {
      if (/\*\//.test(line)) inBlock = false
      continue
    }
    const trimmed = line.trimStart()
    if (trimmed.startsWith('/*')) {
      if (!/\*\//.test(trimmed)) inBlock = true
      continue
    }
    if (trimmed.startsWith('//')) continue
    out.push(line)
  }
  return out.join('\n')
}

function inspect(rel) {
  const code = stripComments(readFileSync(join(ROOT, rel), 'utf8'))
  return {
    rel,
    importsDecrypt:
      /\{\s*decryptCredential\s*\}\s*=\s*await\s+import\s*\(/.test(code) ||
      /import\s*\{[^}]*decryptCredential[^}]*\}/.test(code),
    callsDecrypt: /decryptCredential\s*\(\s*emailRaw\s*\)/.test(code),
  }
}

const rows = TARGETS.map(inspect)

test('① 两个 owner 身份键脚本都真 import 且真调用 decryptCredential(emailRaw)', () => {
  for (const r of rows) {
    assert.ok(r.importsDecrypt, `${r.rel} 未真 import decryptCredential(去注释后判定)`)
    assert.ok(r.callsDecrypt, `${r.rel} 未在写身份键前真调用 decryptCredential(emailRaw)(去注释后判定)`)
  }
})

test('② 反退化:两个已知脚本都在检出集内(正则坏掉时本守门自己先红)', () => {
  assert.equal(rows.length, 2, '检出集不是 2 个目标脚本 —— 目标清单被改坏了')
  for (const rel of TARGETS) {
    assert.ok(rows.some((r) => r.rel === rel), `目标 ${rel} 丢失`)
  }
})

