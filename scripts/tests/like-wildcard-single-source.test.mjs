#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 279(LIKE 通配符转义单源)的镜像测试(§22c 房例)。
 *
 * 判据从门体 import,本文件不复算"什么算转义字面量"(§22c);夹具自带,与门体 --self-test
 * 相互独立(只跑门自己烤的样例等于让被审对象自己出题)。每条放行都配成对反证。
 * 最后两档是**真实面**断言:单源之外的实现数必须为 0,且"0"不得来自"一个文件都没扫到"。
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-like-wildcard-escape.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('判据单源:三件实现都必须由门体导出', () => {
  assert.equal(typeof gate.countViolations, 'function')
  assert.equal(typeof gate.judgeLedger, 'function')
  assert.equal(typeof gate.selfTestRun, 'function')
})

test('本文件自带夹具:D1 与 D2 各自成对', () => {
  const local = 'const t = kw.replace(/[%_\\\\]/g, "\\\\$&")\n'
  assert.equal(gate.countViolations('apps/api/src/db/x.ts', local).d1, 1)
  assert.equal(gate.countViolations(gate.SINGLE_SOURCE, local).d1, 0, '单源文件自己当然可以写')
  assert.equal(gate.countViolations('apps/api/src/db/x.ts', 'const t = asContainsTerm(kw)\n').d1, 0)

  assert.equal(gate.countViolations('a.ts', 'ilike(t.title, `%${kw}%`)\n').d2, 1)
  assert.equal(gate.countViolations('a.ts', "ilike(t.title, '%' + kw + '%')\n").d2, 1)
  assert.equal(gate.countViolations('a.ts', 'ilike(t.title, asContainsTerm(kw))\n').d2, 0)
  // 变异:把已收口的写法抄回内插,D2 必须从 0 翻成非 0
  assert.notEqual(
    gate.countViolations('a.ts', 'ilike(t.title, asContainsTerm(kw))\n').d2,
    gate.countViolations('a.ts', 'ilike(t.title, `%${kw}%`)\n').d2,
  )
})

test('真实台账形状:每条都必须带 anchor/reason/until 且未到期', () => {
  const ledger = JSON.parse(readFileSync(join(ROOT, gate.LEDGER_REL), 'utf8'))
  assert.ok(Array.isArray(ledger.entries) && ledger.entries.length >= 1)
  const today = new Date().toISOString().slice(0, 10)
  for (const e of ledger.entries) {
    assert.ok(typeof e.file === 'string' && e.file.length > 0)
    assert.ok(typeof e.anchor === 'string' && e.anchor.length >= 8, `${e.file} anchor 太短`)
    assert.ok(
      typeof e.reason === 'string' && e.reason.trim().length >= 10,
      `${e.file} reason 缺失/过短`,
    )
    assert.ok(
      /^\d{4}-\d{2}-\d{2}$/.test(e.until) && e.until >= today,
      `${e.file} until 形态坏或已到期`,
    )
  }
})

test('真实面:单源之外不得再有任何一份 LIKE 元字符转义实现', () => {
  // 走工作树(本档在提交链之外跑;门体自己的 HEAD 档另有判序)
  const hits = []
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name)
      if (name.isDirectory()) {
        if (
          [
            'node_modules',
            '.next',
            '.next-blue',
            '.next-green',
            'dist',
            'build',
            'target',
          ].includes(name.name)
        )
          continue
        walk(p)
        continue
      }
      if (!/\.(ts|tsx)$/.test(name.name) || /\btests?\b|__tests__/.test(p)) continue
      const rel = p.slice(ROOT.length + 1).replaceAll('\\', '/')
      const { d1 } = gate.countViolations(rel, readFileSync(p, 'utf8'))
      if (d1 > 0) hits.push(`${rel}:${d1}`)
    }
  }
  for (const top of ['apps', 'packages']) walk(join(ROOT, top))
  assert.deepEqual(hits, [], `又长出本地转义实现 ⇒ 判据必须只在 ${gate.SINGLE_SOURCE}`)
})

test('覆盖面自证:"0 违规"不得来自"一个文件都没扫到"', () => {
  let scanned = 0
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', 'dist', 'build', 'target'].includes(name.name)) continue
      const p = join(dir, name.name)
      if (name.isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name.name)) scanned++
    }
  }
  for (const top of ['apps', 'packages']) walk(join(ROOT, top))
  assert.ok(scanned > 2000, `扫到的 .ts/.tsx 只有 ${scanned} 个 ⇒ 这一轮的"绿"没有意义`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
